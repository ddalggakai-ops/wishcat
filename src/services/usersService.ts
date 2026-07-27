import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { colorFor } from '../theme';
import type { MeUser, PublicUser, UserBrief } from '../api/types';

const cache = new Map<string, PublicUser>();

export function primeUserCache(uid: string, data: { name: string; bio?: string; listPublic?: boolean }) {
  const u: PublicUser = { id: uid, name: data.name, avatarColor: colorFor(data.name), bio: data.bio || '', listPublic: data.listPublic !== false };
  cache.set(uid, u);
  return u;
}

export async function getUserBrief(uid: string): Promise<UserBrief> {
  const full = await getUserPublicCached(uid);
  return { id: full.id, name: full.name, avatarColor: full.avatarColor };
}

export async function getUserPublicCached(uid: string): Promise<PublicUser> {
  const hit = cache.get(uid);
  if (hit) return hit;
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data() as any;
  const u: PublicUser = {
    id: uid,
    name: data?.name || '알 수 없음',
    avatarColor: colorFor(data?.name || uid),
    bio: data?.bio || '',
    listPublic: data?.listPublic !== false,
  };
  cache.set(uid, u);
  return u;
}

export async function createUserProfile(uid: string, name: string) {
  const bio = '✦ 오늘도 꿈을 하나씩 채우는 중';
  await setDoc(doc(db, 'users', uid), { name, bio, listPublic: true, createdAt: serverTimestamp() });
  primeUserCache(uid, { name, bio, listPublic: true });
}

export async function fetchMe(uid: string, email: string): Promise<MeUser> {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data() as any;
  const u = primeUserCache(uid, { name: data?.name || '나', bio: data?.bio, listPublic: data?.listPublic });
  return { ...u, email };
}

export async function updateMyProfile(uid: string, patch: Partial<{ name: string; bio: string; listPublic: boolean }>) {
  await updateDoc(doc(db, 'users', uid), patch as any);
  cache.delete(uid); // 다음 조회 때 새로 불러오도록
}
