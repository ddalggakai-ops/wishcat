import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where, arrayUnion, arrayRemove, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getUserBrief } from './usersService';
import type { Item, Location, Region } from '../api/types';

interface RawItem {
  ownerId: string;
  title: string;
  emoji: string;
  note: string;
  category: string | null;
  location: Location | null;
  done: boolean;
  memory: { photo: string | null; text: string; date: string } | null;
  participants: string[];
  origin: 'own' | 'joined' | 'helped';
  sourceOwnerId?: string;
  sourceItemId?: string;
  sourceTitle?: string;
  sourceEmoji?: string;
  helpedForId?: string;
  helpedBy: string[];
  likesCount: number;
  savesCount: number;
  createdAt?: any;
}

function itemsCol() { return collection(db, 'items'); }
function itemDoc(id: string) { return doc(db, 'items', id); }
function likeDoc(itemId: string, uid: string) { return doc(db, 'items', itemId, 'likes', uid); }

export async function hydrateItem(id: string, raw: RawItem, viewerId?: string): Promise<Item> {
  const [owner, participants, helpedBy, likedSnap] = await Promise.all([
    getUserBrief(raw.ownerId),
    Promise.all((raw.participants || []).map(getUserBrief)),
    Promise.all((raw.helpedBy || []).map(getUserBrief)),
    viewerId ? getDoc(likeDoc(id, viewerId)) : Promise.resolve(null),
  ]);
  const source = raw.sourceItemId
    ? { ownerId: raw.sourceOwnerId!, ownerName: (await getUserBrief(raw.sourceOwnerId!)).name, itemId: raw.sourceItemId, title: raw.sourceTitle || '', emoji: raw.sourceEmoji || '' }
    : null;
  const helpedFor = raw.helpedForId ? await getUserBrief(raw.helpedForId) : null;
  const likesCount = raw.likesCount || 0;

  return {
    id, owner, title: raw.title, emoji: raw.emoji, note: raw.note || '',
    category: raw.category || null, location: raw.location || null, done: !!raw.done, memory: raw.memory || null,
    participants, origin: raw.origin || 'own', source, helpedFor, helpedBy,
    likesCount, likedByMe: !!likedSnap?.exists(), savesCount: raw.savesCount || 0,
    hot: likesCount >= 15, createdAt: raw.createdAt?.toDate?.().toISOString?.() || '',
  };
}

export async function getMyItems(uid: string): Promise<Item[]> {
  const q = query(itemsCol(), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return Promise.all(snap.docs.map((d) => hydrateItem(d.id, d.data() as RawItem, uid)));
}

export async function getItemById(id: string, viewerId?: string): Promise<Item | null> {
  const snap = await getDoc(itemDoc(id));
  if (!snap.exists()) return null;
  return hydrateItem(id, snap.data() as RawItem, viewerId);
}

export async function addItem(uid: string, payload: { title: string; emoji: string; note?: string; category?: string | null; location?: { name: string; region: Region } | null }): Promise<Item> {
  const raw: RawItem = {
    ownerId: uid, title: payload.title, emoji: payload.emoji, note: payload.note || '',
    category: payload.category || null, location: payload.location || null,
    done: false, memory: null, participants: [], origin: 'own', helpedBy: [], likesCount: 0, savesCount: 0,
  };
  const ref = await addDoc(itemsCol(), { ...raw, createdAt: serverTimestamp() });
  return hydrateItem(ref.id, raw, uid);
}

export async function editItem(id: string, uid: string, patch: Partial<{ title: string; emoji: string; note: string; category: string | null; location: Location | null }>): Promise<Item> {
  await updateDoc(itemDoc(id), patch as any);
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(itemDoc(id));
}

export async function completeItem(id: string, uid: string, payload: { photo?: string | null; text?: string }): Promise<Item> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  await updateDoc(itemDoc(id), { done: true, memory: { photo: payload.photo || null, text: payload.text || '', date } });
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

export async function reopenItem(id: string, uid: string): Promise<Item> {
  await updateDoc(itemDoc(id), { done: false, memory: null });
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

// 친구 꿈 함께하기: 대상 아이템의 participants에 나를 추가 + saves 카운트 증가 + 내 목록에 사본 생성
export async function joinItem(targetId: string, uid: string): Promise<void> {
  const targetSnap = await getDoc(itemDoc(targetId));
  if (!targetSnap.exists()) throw new Error('꿈을 찾을 수 없어요');
  const target = targetSnap.data() as RawItem;
  if (target.ownerId === uid) throw new Error('내 꿈은 함께하기 할 수 없어요');

  const existing = await getDocs(query(itemsCol(), where('ownerId', '==', uid), where('origin', '==', 'joined'), where('sourceItemId', '==', targetId)));
  const alreadyParticipant = (target.participants || []).includes(uid);

  const batch = writeBatch(db);
  if (!alreadyParticipant) {
    batch.update(itemDoc(targetId), { participants: arrayUnion(uid), savesCount: increment(existing.empty ? 1 : 0) });
  }
  if (existing.empty) {
    const newRef = doc(itemsCol());
    batch.set(newRef, {
      ownerId: uid, title: target.title, emoji: target.emoji, note: target.note, category: target.category, location: target.location,
      done: false, memory: null, participants: [target.ownerId], origin: 'joined',
      sourceOwnerId: target.ownerId, sourceItemId: targetId, helpedBy: [], likesCount: 0, savesCount: 0, createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function leaveItem(targetId: string, uid: string): Promise<void> {
  const targetSnap = await getDoc(itemDoc(targetId));
  if (!targetSnap.exists()) return;
  const target = targetSnap.data() as RawItem;

  const mine = await getDocs(query(itemsCol(), where('ownerId', '==', uid), where('origin', '==', 'joined'), where('sourceItemId', '==', targetId), where('done', '==', false)));

  const batch = writeBatch(db);
  batch.update(itemDoc(targetId), { participants: arrayRemove(uid), savesCount: increment(mine.empty ? 0 : -1) });
  mine.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// 친구 꿈 도와서 이뤄줌: 대상 완료 처리 + 내 기록에 커스텀 제목으로 새 아이템 생성
export async function helpItem(targetId: string, uid: string, payload: { title: string; emoji: string; note?: string; text?: string }): Promise<Item> {
  const targetSnap = await getDoc(itemDoc(targetId));
  if (!targetSnap.exists()) throw new Error('꿈을 찾을 수 없어요');
  const target = targetSnap.data() as RawItem;
  if (target.ownerId === uid) throw new Error('내 꿈은 도와줄 수 없어요');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const batch = writeBatch(db);
  batch.update(itemDoc(targetId), { done: true, helpedBy: arrayUnion(uid), participants: arrayUnion(uid) });
  const newRef = doc(itemsCol());
  const rec: RawItem = {
    ownerId: uid, title: payload.title, emoji: payload.emoji, note: payload.note || '', category: null, location: null,
    done: true, memory: { photo: null, text: payload.text || '', date }, participants: [target.ownerId],
    origin: 'helped', helpedForId: target.ownerId, sourceTitle: target.title, sourceEmoji: target.emoji, sourceItemId: targetId,
    helpedBy: [], likesCount: 0, savesCount: 0,
  };
  batch.set(newRef, { ...rec, createdAt: serverTimestamp() });
  await batch.commit();
  return hydrateItem(newRef.id, rec, uid);
}

export async function toggleLike(itemId: string, uid: string): Promise<{ likedByMe: boolean }> {
  const ref = likeDoc(itemId, uid);
  const snap = await getDoc(ref);
  const batch = writeBatch(db);
  if (snap.exists()) {
    batch.delete(ref);
    batch.update(itemDoc(itemId), { likesCount: increment(-1) });
  } else {
    batch.set(ref, { userId: uid, createdAt: serverTimestamp() });
    batch.update(itemDoc(itemId), { likesCount: increment(1) });
  }
  await batch.commit();
  return { likedByMe: !snap.exists() };
}
