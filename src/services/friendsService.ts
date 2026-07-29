import { collection, doc, getCount, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { getUserPublicCached } from './usersService';
import { joinItem } from './itemsService';
import type { FriendEntry } from '../api/types';

function friendshipId(owner: string, friend: string) { return `${owner}_${friend}`; }

// 친구 화면을 열 때마다(탭을 왔다갔다 하면 화면이 통째로 다시 마운트돼요) 매번 새로 읽지
// 않도록 최근 결과를 잠깐 기억해 둡니다. 새로고침(pull-to-refresh)은 force로 건너뜁니다.
let friendsCache: { uid: string; at: number; list: FriendEntry[] } | null = null;
const FRIENDS_CACHE_TTL_MS = 15_000;

// 예전에는 친구마다 items 문서를 전부 읽어(제목·메모·사진 URL까지) 개수만 세느라 느렸어요.
// 지금은 문서 내용을 안 받고 개수만 세는 집계 쿼리(getCount)로 바꿔서 같은 걸 훨씬 가볍게 구합니다.
// (withMeCount는 "내가 함께하는 중"인 아이템 수인데, 이건 어차피 내가 이미 가진 목록(origin==='joined')에서
// 바로 셀 수 있어서 여기서 따로 안 읽고 AppContext에서 채워 넣습니다 — 그래서 여기선 0으로 둬요.)
export async function getFriends(uid: string, opts?: { force?: boolean }): Promise<FriendEntry[]> {
  if (!opts?.force && friendsCache && friendsCache.uid === uid && Date.now() - friendsCache.at < FRIENDS_CACHE_TTL_MS) {
    return friendsCache.list;
  }

  const q = query(collection(db, 'friendships'), where('owner', '==', uid));
  const snap = await getDocs(q);
  const friendIds = snap.docs.map((d) => (d.data() as any).friend as string);

  const list = await Promise.all(friendIds.map(async (fid) => {
    const itemsCol = collection(db, 'items');
    const [profile, totalCount, doneCount] = await Promise.all([
      getUserPublicCached(fid),
      getCount(query(itemsCol, where('ownerId', '==', fid))),
      getCount(query(itemsCol, where('ownerId', '==', fid), where('done', '==', true))),
    ]);
    return {
      ...profile,
      itemsCount: totalCount.data().count,
      doneCount: doneCount.data().count,
      withMeCount: 0,
    };
  }));

  friendsCache = { uid, at: Date.now(), list };
  return list;
}

export async function createInvite(uid: string, itemId?: string): Promise<string> {
  const existingQ = itemId
    ? query(collection(db, 'invites'), where('fromUserId', '==', uid), where('itemId', '==', itemId))
    : query(collection(db, 'invites'), where('fromUserId', '==', uid), where('itemId', '==', null));
  const existing = await getDocs(existingQ);
  if (!existing.empty) return existing.docs[0].id;

  const ref = doc(collection(db, 'invites'));
  await setDoc(ref, { fromUserId: uid, itemId: itemId || null, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getInvitePreview(code: string) {
  const snap = await getDoc(doc(db, 'invites', code));
  if (!snap.exists()) throw new Error('유효하지 않은 초대예요');
  const data = snap.data() as any;
  const fromUser = await getUserPublicCached(data.fromUserId);
  let item: { title: string; emoji: string } | null = null;
  if (data.itemId) {
    const itemSnap = await getDoc(doc(db, 'items', data.itemId));
    if (itemSnap.exists()) {
      const idata = itemSnap.data() as any;
      item = { title: idata.title, emoji: idata.emoji };
    }
  }
  return { fromUser, item, fromUserId: data.fromUserId as string, itemId: (data.itemId as string) || null };
}

export async function acceptInvite(code: string, uid: string) {
  const preview = await getInvitePreview(code);
  if (preview.fromUserId === uid) throw new Error('내가 만든 초대는 수락할 수 없어요');

  const batch = writeBatch(db);
  batch.set(doc(db, 'friendships', friendshipId(uid, preview.fromUserId)), { owner: uid, friend: preview.fromUserId, createdAt: serverTimestamp() });
  batch.set(doc(db, 'friendships', friendshipId(preview.fromUserId, uid)), { owner: preview.fromUserId, friend: uid, createdAt: serverTimestamp() });
  await batch.commit();

  if (preview.itemId) {
    await joinItem(preview.itemId, uid).catch(() => {}); // 이미 함께하는 중이면 무시
  }
  return preview.fromUser;
}

export async function areFriends(uidA: string, uidB: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'friendships', friendshipId(uidA, uidB)));
    return snap.exists();
  } catch {
    // 아직 친구가 아닌 사이엔 friendships/{uidA_uidB} 문서 자체가 없는데, 보안 규칙이
    // resource.data를 참조하다 보니 "존재하지 않는 문서 읽기"가 permission-denied로 거부될 수 있어요.
    // (친구 사이면 문서가 있으니 정상적으로 위에서 답이 나오고, 여기로 안 옵니다.)
    // 이 경우는 그냥 "친구 아님"으로 취급하면 되는 정상 상황이라 조용히 false를 돌려줍니다.
    return false;
  }
}
