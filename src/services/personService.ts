import { collection, getDocs, orderBy, query, where } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { getUserPublicCached } from './usersService';
import { getFriendState, type FriendState } from './friendsService';
import type { Item, PublicUser } from '../api/types';
import { hydrateItem } from './itemsService';

export interface PersonResult {
  user: PublicUser;
  isSelf: boolean;
  isFriend: boolean;
  friendState: FriendState;
  withMeCount: number;
  items: Item[] | null;
}

export async function getPerson(targetUid: string, viewerUid: string): Promise<PersonResult> {
  const user = await getUserPublicCached(targetUid);
  const isSelf = targetUid === viewerUid;
  const friendState = await getFriendState(viewerUid, targetUid);
  const isFriend = friendState === 'friends';
  const visible = isSelf || isFriend || user.listPublic;

  let items: Item[] | null = null;
  let withMeCount = 0;
  if (visible) {
    const q = query(collection(db, 'items'), where('ownerId', '==', targetUid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    items = await Promise.all(snap.docs.map((d) => hydrateItem(d.id, d.data() as any, viewerUid)));
    withMeCount = items.filter((i) => i.participants.some((p) => p.id === viewerUid)).length;
  }

  return { user, isSelf, isFriend, friendState, withMeCount, items };
}
