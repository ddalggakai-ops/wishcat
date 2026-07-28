import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { deleteAllMyItems } from './itemsService';

// 구글 플레이는 계정을 만들 수 있는 앱이면 앱 안에서 계정과 데이터를 지울 수 있어야 한다고 요구합니다.
// 서버가 없으므로 클라이언트가 자기 문서를 순서대로 지웁니다.
// (마지막에 users 문서를 지우는 이유: 중간에 실패해도 users 문서가 남아 있으면 다시 시도할 수 있어서)

async function deleteAll(refs: { ref: any }[]) {
  const CHUNK = 400;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export interface PurgeResult {
  items: number;
  friendships: number;
  invites: number;
}

/** 내 계정과 연결된 Firestore 문서를 모두 지웁니다. Auth 계정 삭제는 호출부에서 이어서 처리하세요. */
export async function purgeMyData(uid: string): Promise<PurgeResult> {
  const items = await deleteAllMyItems(uid);

  const [asOwner, asFriend] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('owner', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('friend', '==', uid))),
  ]);
  await deleteAll([...asOwner.docs, ...asFriend.docs]);

  const invites = await getDocs(query(collection(db, 'invites'), where('fromUserId', '==', uid)));
  await deleteAll(invites.docs);

  const blocked = await getDocs(collection(db, 'blocks', uid, 'blocked')).catch(() => null);
  if (blocked) await deleteAll(blocked.docs);

  await deleteDoc(doc(db, 'users', uid));

  return { items, friendships: asOwner.size + asFriend.size, invites: invites.size };
}
