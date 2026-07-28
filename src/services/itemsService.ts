import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where, arrayUnion, arrayRemove, writeBatch,
} from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { getUserBrief } from './usersService';
import { getMyVisibility } from './visibility';
import type { Item, Location } from '../api/types';

export interface NewItemPayload {
  title: string;
  emoji: string;
  note?: string;
  category?: string | null;
  location?: Location | null;
  targetDate?: string | null;
}

interface RawItem {
  ownerId: string;
  title: string;
  emoji: string;
  note: string;
  category: string | null;
  location: Location | null;
  targetDate?: string | null;
  /** users.listPublic을 비정규화한 값. 둘러보기 쿼리가 이 필드 하나로 걸러집니다. */
  ownerPublic?: boolean;
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

// 목록 화면에서 아이템마다 likes/{uid} 문서를 하나씩 읽으면 아이템 수만큼 읽기가 발생합니다.
// 대신 "내가 누른 좋아요"를 컬렉션 그룹 쿼리로 한 번에 받아 두고 메모리에서 판정합니다.
const likedCache = new Map<string, Set<string>>();

export async function primeViewerLikes(viewerId: string): Promise<boolean> {
  try {
    const snap = await getDocs(query(collectionGroup(db, 'likes'), where('userId', '==', viewerId)));
    const set = new Set<string>();
    snap.forEach((d) => { const parent = d.ref.parent.parent; if (parent) set.add(parent.id); });
    likedCache.set(viewerId, set);
    return true;
  } catch {
    // 컬렉션 그룹 색인이 아직 없으면 조용히 예전 방식(아이템별 조회)으로 돌아갑니다.
    likedCache.delete(viewerId);
    return false;
  }
}

export function clearViewerLikes(viewerId?: string) {
  if (viewerId) likedCache.delete(viewerId); else likedCache.clear();
}

export async function hydrateItem(id: string, raw: RawItem, viewerId?: string): Promise<Item> {
  const primedLikes = viewerId ? likedCache.get(viewerId) : undefined;
  const [owner, participants, helpedBy, likedSnap] = await Promise.all([
    getUserBrief(raw.ownerId),
    Promise.all((raw.participants || []).map(getUserBrief)),
    Promise.all((raw.helpedBy || []).map(getUserBrief)),
    viewerId && !primedLikes ? getDoc(likeDoc(id, viewerId)) : Promise.resolve(null),
  ]);
  const source = raw.sourceItemId
    ? { ownerId: raw.sourceOwnerId!, ownerName: (await getUserBrief(raw.sourceOwnerId!)).name, itemId: raw.sourceItemId, title: raw.sourceTitle || '', emoji: raw.sourceEmoji || '' }
    : null;
  const helpedFor = raw.helpedForId ? await getUserBrief(raw.helpedForId) : null;
  const likesCount = raw.likesCount || 0;

  return {
    id, owner, title: raw.title, emoji: raw.emoji, note: raw.note || '',
    category: raw.category || null, location: raw.location || null, targetDate: raw.targetDate || null,
    done: !!raw.done, memory: raw.memory || null,
    participants, origin: raw.origin || 'own', source, helpedFor, helpedBy,
    likesCount, likedByMe: primedLikes ? primedLikes.has(id) : !!likedSnap?.exists(), savesCount: raw.savesCount || 0,
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

export async function addItem(uid: string, payload: NewItemPayload): Promise<Item> {
  const raw: RawItem = {
    ownerId: uid, title: payload.title, emoji: payload.emoji, note: payload.note || '',
    category: payload.category || null, location: payload.location || null,
    targetDate: payload.targetDate || null, ownerPublic: getMyVisibility(),
    done: false, memory: null, participants: [], origin: 'own', helpedBy: [], likesCount: 0, savesCount: 0,
  };
  const ref = await addDoc(itemsCol(), { ...raw, createdAt: serverTimestamp() });
  return hydrateItem(ref.id, raw, uid);
}

// 엑셀/CSV 가져오기로 여러 개를 한 번에 추가.
// Firestore 배치(batch) 하나에는 최대 500개의 쓰기만 담을 수 있어서 넉넉히 400개씩 나눠 커밋합니다.
export async function bulkAddItems(uid: string, payloads: NewItemPayload[]): Promise<number> {
  const CHUNK = 400;
  const ownerPublic = getMyVisibility();
  let added = 0;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const payload of slice) {
      const raw: RawItem = {
        ownerId: uid, title: payload.title, emoji: payload.emoji, note: payload.note || '',
        category: payload.category || null, location: payload.location || null,
        targetDate: payload.targetDate || null, ownerPublic,
        done: false, memory: null, participants: [], origin: 'own', helpedBy: [], likesCount: 0, savesCount: 0,
      };
      batch.set(doc(itemsCol()), { ...raw, createdAt: serverTimestamp() });
    }
    await batch.commit();
    added += slice.length;
  }
  return added;
}

export async function editItem(id: string, uid: string, patch: Partial<{ title: string; emoji: string; note: string; category: string | null; location: Location | null; targetDate: string | null }>): Promise<Item> {
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
      targetDate: null, ownerPublic: getMyVisibility(),
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
    targetDate: null, ownerPublic: getMyVisibility(),
    done: true, memory: { photo: null, text: payload.text || '', date }, participants: [target.ownerId],
    origin: 'helped', helpedForId: target.ownerId, sourceTitle: target.title, sourceEmoji: target.emoji, sourceItemId: targetId,
    helpedBy: [], likesCount: 0, savesCount: 0,
  };
  batch.set(newRef, { ...rec, createdAt: serverTimestamp() });
  await batch.commit();
  return hydrateItem(newRef.id, rec, uid);
}

/**
 * 공개/비공개를 토글하면 내 아이템들의 ownerPublic을 전부 맞춰 줍니다.
 * (둘러보기 쿼리와 보안 규칙이 이 값을 보기 때문에 반드시 따라와야 합니다)
 * 기존에 만들어진, ownerPublic이 아예 없는 문서도 여기서 채워집니다.
 */
export async function backfillOwnerPublic(uid: string, isPublic: boolean): Promise<number> {
  const snap = await getDocs(query(itemsCol(), where('ownerId', '==', uid)));
  const stale = snap.docs.filter((d) => (d.data() as RawItem).ownerPublic !== isPublic);
  const CHUNK = 400;
  for (let i = 0; i < stale.length; i += CHUNK) {
    const batch = writeBatch(db);
    stale.slice(i, i + CHUNK).forEach((d) => batch.update(d.ref, { ownerPublic: isPublic }));
    await batch.commit();
  }
  return stale.length;
}

/** 계정 삭제용 — 내가 만든 아이템을 전부 지웁니다. */
export async function deleteAllMyItems(uid: string): Promise<number> {
  const snap = await getDocs(query(itemsCol(), where('ownerId', '==', uid)));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.docs.length;
}

export async function toggleLike(itemId: string, uid: string): Promise<{ likedByMe: boolean }> {
  const ref = likeDoc(itemId, uid);
  const primed = likedCache.get(uid);
  const wasLiked = primed ? primed.has(itemId) : (await getDoc(ref)).exists();
  const batch = writeBatch(db);
  if (wasLiked) {
    batch.delete(ref);
    batch.update(itemDoc(itemId), { likesCount: increment(-1) });
  } else {
    batch.set(ref, { userId: uid, createdAt: serverTimestamp() });
    batch.update(itemDoc(itemId), { likesCount: increment(1) });
  }
  await batch.commit();
  if (primed) { if (wasLiked) primed.delete(itemId); else primed.add(itemId); }
  return { likedByMe: !wasLiked };
}
