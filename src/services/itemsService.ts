import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where, arrayUnion, arrayRemove, writeBatch,
} from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { getUserBrief } from './usersService';
import { getMyVisibility } from './visibility';
import { MAX_MEMORY_PHOTOS } from '../api/types';
import type { Item, Location, Priority } from '../api/types';

export interface NewItemPayload {
  title: string;
  emoji: string;
  note?: string;
  /** 카테고리 여러 개 지정 가능. 예전 category(단일) 필드도 계속 받되 내부에서 배열로 합칩니다. */
  categories?: string[];
  category?: string | null;
  location?: Location | null;
  targetDate?: string | null;
  priority?: Priority | null;
}

interface RawItem {
  ownerId: string;
  title: string;
  emoji: string;
  note: string;
  /** 새 문서는 이 필드를 씁니다. */
  categories?: string[];
  /** 다중선택 이전에 만들어진 문서는 이 단일 필드만 있을 수 있어요(읽을 때만 호환 처리). */
  category?: string | null;
  location: Location | null;
  targetDate?: string | null;
  priority?: Priority | null;
  /** 수동 정렬 순서. 없으면 생성일 역순(기본 정렬)을 그대로 따릅니다. */
  order?: number;
  /** users.listPublic을 비정규화한 값. 둘러보기 쿼리가 이 필드 하나로 걸러집니다. */
  ownerPublic?: boolean;
  done: boolean;
  /** 진행 시작 시각. Firestore Timestamp(서버에서 채움) 또는 아직 시작 전이면 null/없음. */
  startedAt?: any;
  memory: { photo: string | null; photos?: string[]; text: string; date: string } | null;
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

/** 새/구 스키마 어느 쪽이든 카테고리 배열로 통일해서 꺼냅니다. */
function rawCategories(raw: Pick<RawItem, 'categories' | 'category'>): string[] {
  if (raw.categories && raw.categories.length) return raw.categories;
  if (raw.category) return [raw.category];
  return [];
}

/** 사진이 여러 장(photos)이든 예전처럼 한 장(photo)뿐이든 배열로 통일해서 꺼냅니다. */
function rawMemoryPhotos(memory: { photo: string | null; photos?: string[] } | null | undefined): string[] {
  if (!memory) return [];
  if (memory.photos && memory.photos.length) return memory.photos;
  return memory.photo ? [memory.photo] : [];
}

function itemsCol() { return collection(db, 'items'); }
function itemDoc(id: string) { return doc(db, 'items', id); }
function likeDoc(itemId: string, uid: string) { return doc(db, 'items', itemId, 'likes', uid); }

// 목록 화면에서 아이템마다 likes/{uid} 문서를 하나씩 읽으면 아이템 수만큼 읽기가 발생합니다.
// 대신 "내가 누른 좋아요"를 컬렉션 그룹 쿼리로 한 번에 받아 두고 메모리에서 판정합니다.
const likedCache = new Map<string, Set<string>>();
// 탭을 왔다갔다 할 때마다(화면이 통째로 다시 마운트되면서) 매번 새로 읽지 않도록,
// 같은 사람 걸 최근에 이미 읽었으면 잠깐 동안은 그 결과를 그대로 씁니다.
const likedPrimedAt = new Map<string, number>();
const LIKED_CACHE_TTL_MS = 30_000;
// 여러 화면이 동시에(같은 프레임에) primeViewerLikes를 부르는 경우 요청을 한 번으로 합칩니다.
const likedPriming = new Map<string, Promise<boolean>>();

export async function primeViewerLikes(viewerId: string, opts?: { force?: boolean }): Promise<boolean> {
  const primedAt = likedPrimedAt.get(viewerId);
  if (!opts?.force && primedAt && Date.now() - primedAt < LIKED_CACHE_TTL_MS) return true;
  const inFlight = likedPriming.get(viewerId);
  if (!opts?.force && inFlight) return inFlight;

  const task = (async () => {
    try {
      const snap = await getDocs(query(collectionGroup(db, 'likes'), where('userId', '==', viewerId)));
      const set = new Set<string>();
      snap.forEach((d) => { const parent = d.ref.parent.parent; if (parent) set.add(parent.id); });
      likedCache.set(viewerId, set);
      likedPrimedAt.set(viewerId, Date.now());
      return true;
    } catch {
      // 컬렉션 그룹 색인이 아직 없으면 조용히 예전 방식(아이템별 조회)으로 돌아갑니다.
      likedCache.delete(viewerId);
      likedPrimedAt.delete(viewerId);
      return false;
    } finally {
      likedPriming.delete(viewerId);
    }
  })();
  likedPriming.set(viewerId, task);
  return task;
}

export function clearViewerLikes(viewerId?: string) {
  if (viewerId) { likedCache.delete(viewerId); likedPrimedAt.delete(viewerId); }
  else { likedCache.clear(); likedPrimedAt.clear(); }
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

  const memoryPhotos = rawMemoryPhotos(raw.memory);

  return {
    id, owner, title: raw.title, emoji: raw.emoji, note: raw.note || '',
    categories: rawCategories(raw), location: raw.location || null, targetDate: raw.targetDate || null,
    priority: raw.priority || null, order: typeof raw.order === 'number' ? raw.order : 0,
    done: !!raw.done, startedAt: raw.startedAt?.toDate?.().toISOString?.() || null,
    memory: raw.memory ? { photo: memoryPhotos[0] || null, photos: memoryPhotos, text: raw.memory.text || '', date: raw.memory.date || '' } : null,
    participants, origin: raw.origin || 'own', source, helpedFor, helpedBy,
    likesCount, likedByMe: primedLikes ? primedLikes.has(id) : !!likedSnap?.exists(), savesCount: raw.savesCount || 0,
    hot: likesCount >= 15, createdAt: raw.createdAt?.toDate?.().toISOString?.() || '',
  };
}

export async function getMyItems(uid: string): Promise<Item[]> {
  const q = query(itemsCol(), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
  // 예전엔 좋아요 여부를 아이템마다 따로 읽어서(안 미리 채워 두면 hydrateItem이 개별 조회로 빠짐),
  // 아이템이 30개면 목록 조회 하나에 좋아요 조회 30개가 딸려왔어요. 목록 조회와 동시에(병렬로)
  // 좋아요를 한 번에 미리 읽어 두면 그 30개가 통째로 사라집니다.
  const [snap] = await Promise.all([getDocs(q), primeViewerLikes(uid)]);
  return Promise.all(snap.docs.map((d) => hydrateItem(d.id, d.data() as RawItem, uid)));
}

export async function getItemById(id: string, viewerId?: string): Promise<Item | null> {
  const snap = await getDoc(itemDoc(id));
  if (!snap.exists()) return null;
  return hydrateItem(id, snap.data() as RawItem, viewerId);
}

/** payload에 categories(배열) 또는 category(단일, 예전 호출부 호환)로 오든 배열로 통일 */
function payloadCategories(payload: Pick<NewItemPayload, 'categories' | 'category'>): string[] {
  if (payload.categories) return payload.categories;
  if (payload.category) return [payload.category];
  return [];
}

export async function addItem(uid: string, payload: NewItemPayload): Promise<Item> {
  const raw: RawItem = {
    ownerId: uid, title: payload.title, emoji: payload.emoji, note: payload.note || '',
    categories: payloadCategories(payload), location: payload.location || null,
    targetDate: payload.targetDate || null, priority: payload.priority || null, order: 0,
    ownerPublic: getMyVisibility(),
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
        categories: payloadCategories(payload), location: payload.location || null,
        targetDate: payload.targetDate || null, priority: payload.priority || null, order: 0, ownerPublic,
        done: false, memory: null, participants: [], origin: 'own', helpedBy: [], likesCount: 0, savesCount: 0,
      };
      batch.set(doc(itemsCol()), { ...raw, createdAt: serverTimestamp() });
    }
    await batch.commit();
    added += slice.length;
  }
  return added;
}

export async function editItem(id: string, uid: string, patch: Partial<{ title: string; emoji: string; note: string; categories: string[]; location: Location | null; targetDate: string | null; priority: Priority | null }>): Promise<Item> {
  await updateDoc(itemDoc(id), patch as any);
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(itemDoc(id));
}

/** 여러 개를 한 번에 삭제 (다중선택 삭제용) */
export async function deleteItems(ids: string[]): Promise<void> {
  const CHUNK = 400;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = writeBatch(db);
    ids.slice(i, i + CHUNK).forEach((id) => batch.delete(itemDoc(id)));
    await batch.commit();
  }
}

/** 수동 정렬 순서를 한 번에 반영 (위/아래로 옮기기) */
export async function reorderItems(updates: { id: string; order: number }[]): Promise<void> {
  const batch = writeBatch(db);
  updates.forEach(({ id, order }) => batch.update(itemDoc(id), { order }));
  await batch.commit();
}

export async function completeItem(id: string, uid: string, payload: { photos?: string[]; text?: string }): Promise<Item> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const photos = (payload.photos || []).slice(0, MAX_MEMORY_PHOTOS);
  await updateDoc(itemDoc(id), { done: true, memory: { photo: photos[0] || null, photos, text: payload.text || '', date } });
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

export async function reopenItem(id: string, uid: string): Promise<Item> {
  await updateDoc(itemDoc(id), { done: false, memory: null });
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

/** 진행 시작 — "진행중" 배지가 뜨고, 시작일 기준으로 D+n일이 표시됩니다. */
export async function startItem(id: string, uid: string): Promise<Item> {
  await updateDoc(itemDoc(id), { startedAt: serverTimestamp() });
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

/** 진행 중단 — 시작일 기록을 지웁니다(다시 누르면 D+0부터 새로 시작). */
export async function stopItem(id: string, uid: string): Promise<Item> {
  await updateDoc(itemDoc(id), { startedAt: null });
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
      ownerId: uid, title: target.title, emoji: target.emoji, note: target.note, categories: rawCategories(target), location: target.location,
      targetDate: null, priority: null, order: 0, ownerPublic: getMyVisibility(),
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
    ownerId: uid, title: payload.title, emoji: payload.emoji, note: payload.note || '', categories: [], location: null,
    targetDate: null, priority: null, order: 0, ownerPublic: getMyVisibility(),
    done: true, memory: { photo: null, photos: [], text: payload.text || '', date }, participants: [target.ownerId],
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
