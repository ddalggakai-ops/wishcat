import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getUserPublicCached } from './usersService';
import { joinItem } from './itemsService';
import type { FriendEntry } from '../api/types';

function friendshipId(owner: string, friend: string) { return `${owner}_${friend}`; }

export async function getFriends(uid: string): Promise<FriendEntry[]> {
  const q = query(collection(db, 'friendships'), where('owner', '==', uid));
  const snap = await getDocs(q);
  const friendIds = snap.docs.map((d) => (d.data() as any).friend as string);

  return Promise.all(friendIds.map(async (fid) => {
    const profile = await getUserPublicCached(fid);
    const itemsSnap = await getDocs(query(collection(db, 'items'), where('ownerId', '==', fid)));
    let done = 0, withMe = 0;
    itemsSnap.forEach((d) => {
      const data = d.data() as any;
      if (data.done) done++;
      if ((data.participants || []).includes(uid)) withMe++;
    });
    return { ...profile, itemsCount: itemsSnap.size, doneCount: done, withMeCount: withMe };
  }));
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
  const snap = await getDoc(doc(db, 'friendships', friendshipId(uidA, uidB)));
  return snap.exists();
}
