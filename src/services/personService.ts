import { collection, getDocs, orderBy, query, where } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { getUserPublicCached, primeUsersBatch } from './usersService';
import { getFriendState, type FriendState } from './friendsService';
import type { Item, PublicUser } from '../api/types';
import { hydrateItem, relatedUserIds } from './itemsService';

export interface PersonResult {
  user: PublicUser;
  isSelf: boolean;
  isFriend: boolean;
  friendState: FriendState;
  withMeCount: number;
  items: Item[] | null;
}

export async function getPerson(targetUid: string, viewerUid: string): Promise<PersonResult> {
  const isSelf = targetUid === viewerUid;
  // 프로필 조회와 친구 상태 확인은 서로 의존하지 않아 동시에 보냅니다(왕복 하나 절약).
  const [user, friendState] = await Promise.all([
    getUserPublicCached(targetUid),
    getFriendState(viewerUid, targetUid),
  ]);
  const isFriend = friendState === 'friends';
  const visible = isSelf || isFriend || user.listPublic;

  let items: Item[] | null = null;
  let withMeCount = 0;
  if (visible) {
    const q = query(collection(db, 'items'), where('ownerId', '==', targetUid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const raws = snap.docs.map((d) => ({ id: d.id, data: d.data() as any }));
    await primeUsersBatch(raws.flatMap((r) => relatedUserIds(r.data)));
    items = await Promise.all(raws.map((r) => hydrateItem(r.id, r.data, viewerUid)));
    withMeCount = items.filter((i) => i.participants.some((p) => p.id === viewerUid)).length;
  }

  return { user, isSelf, isFriend, friendState, withMeCount, items };
}
