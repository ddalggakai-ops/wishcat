import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where, arrayUnion, arrayRemove, writeBatch,
} from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { getUserBrief, primeUsersBatch } from './usersService';
import { getMyVisibility } from './visibility';
import { MAX_MEMORY_PHOTOS } from '../api/types';
import type { Item, Location, Priority } from '../api/types';

// 완료/도움 기록에 찍는 날짜 도장 — 'YYYY.MM.DD'.
// 예전엔 new Date().toISOString()(=UTC) 앞 10자리를 썼는데, 한국 시간 새벽 0~9시에 완료하면
// 세계 표준시로는 아직 '어제'라 하루 전 날짜가 찍혔습니다. 기기(로컬) 시간 기준으로 바꿉니다.
function localDateStamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

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

/**
 * 아이템 하나를 hydrate하는 데 필요한 '다른 사람들'의 uid를 전부 모읍니다(소유자·참가자·도움 준
 * 사람·원본 소유자·도움받은 사람). 목록을 hydrate하기 전에 이걸로 모아 primeUsersBatch에 넘기면,
 * hydrateItem 안의 getUserBrief 호출들이 이미 채워진 캐시만 보고 네트워크를 타지 않습니다.
 */
export function relatedUserIds(raw: Pick<RawItem, 'ownerId' | 'participants' | 'helpedBy' | 'sourceOwnerId' | 'helpedForId'>): string[] {
  return [raw.ownerId, ...(raw.participants || []), ...(raw.helpedBy || []), raw.sourceOwnerId, raw.helpedForId].filter(
    (x): x is string => !!x
  );
}

export async function hydrateItem(id: string, raw: RawItem, viewerId?: string): Promise<Item> {
  const primedLikes = viewerId ? likedCache.get(viewerId) : undefined;
  const [owner, participants, helpedBy, likedSnap] = await Promise.all([
    getUserBrief(raw.ownerId),
    Promise.all((raw.participants || []).map(getUserBrief)),
    Promise.all((raw.helpedBy || []).map(getUserBrief)),
    viewerId && !primedLikes ? getDoc(likeDoc(id, viewerId)) : Promise.resolve(null),
  ]);
  // sourceOwnerId가 없으면(예전에 잘못 저장된 도움 기록 등) source를 만들지 않습니다.
  // getUserBrief(undefined)가 doc(db,'users',undefined)에서 그대로 throw해 목록 hydrate 전체가
  // 실패(=목록이 안 뜸)하던 크래시를 막습니다.
  const source = raw.sourceItemId && raw.sourceOwnerId
    ? { ownerId: raw.sourceOwnerId, ownerName: (await getUserBrief(raw.sourceOwnerId)).name, itemId: raw.sourceItemId, title: raw.sourceTitle || '', emoji: raw.sourceEmoji || '' }
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
  const raws = snap.docs.map((d) => ({ id: d.id, data: d.data() as RawItem }));
  // 참가자·도움 준 사람 등도 마찬가지 이유로 배치 프라이밍합니다 — 안 하면 아이템마다 딸린
  // 사람 수만큼 hydrateItem이 개별 조회를 냅니다("내 목록 조회가 느리다"의 실제 원인).
  await primeUsersBatch(raws.flatMap((r) => relatedUserIds(r.data)));
  return Promise.all(raws.map((r) => hydrateItem(r.id, r.data, uid)));
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

/**
 * 여러 개를 한 번에 완료 처리 (다중선택 완료용).
 * 호출부에서 '아직 이루지 않은' 항목만 넘겨줍니다. 아직 기록이 없는 항목을 완료하는 것이라
 * 빈 기록(날짜만)으로 done 처리합니다 — 이미 기록이 있는 이룬 꿈을 덮어쓸 일은 없습니다.
 */
export async function completeItems(ids: string[]): Promise<void> {
  const CHUNK = 400;
  const date = localDateStamp();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = writeBatch(db);
    ids.slice(i, i + CHUNK).forEach((id) =>
      batch.update(itemDoc(id), { done: true, memory: { photo: null, photos: [], text: '', date } }),
    );
    await batch.commit();
  }
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
  // 배치 하나에는 최대 500개 쓰기만 담깁니다. 아직 이루지 않은 항목이 아주 많으면(500개↑)
  // 순서 저장이 통째로 실패했어요. 다른 일괄 작업과 똑같이 400개씩 나눠 커밋합니다.
  const CHUNK = 400;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db);
    updates.slice(i, i + CHUNK).forEach(({ id, order }) => batch.update(itemDoc(id), { order }));
    await batch.commit();
  }
}

export async function completeItem(id: string, uid: string, payload: { photos?: string[]; text?: string }): Promise<Item> {
  const photos = (payload.photos || []).slice(0, MAX_MEMORY_PHOTOS);
  const text = (payload.text || '').trim();
  const hasNewRecord = photos.length > 0 || text.length > 0;

  // '이룬 날짜'는 처음 이룬 그 날이어야 합니다. 예전엔 사진/글을 새로 넣을 때마다 오늘 날짜로
  // 덮어써서, 3월에 이룬 꿈에 12월에 사진 한 장을 더하면 달성일이 12월로 바뀌고 되돌릴 수
  // 없었어요(연말에 사진을 정리하면 1년치 연대기가 통째로 12월로 몰렸습니다).
  // 아래 else 분기엔 이미 "기록을 지우지 않는다"는 보호가 있었는데 날짜만 빠져 있었습니다.
  const cur = await getDoc(itemDoc(id));
  const curMemory = cur.exists() ? (cur.data() as RawItem).memory : null;
  const hadRecord = !!(curMemory && (curMemory.text || curMemory.photos?.length || curMemory.photo));

  const patch: Record<string, any> = { done: true };
  if (hasNewRecord) {
    // 사진/글이 있으면 새로 쓰되, 이미 이뤄서 날짜가 찍혀 있으면 그 날짜를 유지합니다.
    patch.memory = { photo: photos[0] || null, photos, text, date: curMemory?.date || localDateStamp() };
  } else {
    // 사진도 글도 없이 '완료만' 하는 경우: 이미 적어둔 기록이 있으면 절대 건드리지 않습니다.
    patch.memory = hadRecord ? curMemory : { photo: null, photos: [], text: '', date: curMemory?.date || localDateStamp() };
  }

  await updateDoc(itemDoc(id), patch);
  const snap = await getDoc(itemDoc(id));
  return hydrateItem(id, snap.data() as RawItem, uid);
}

/**
 * 함께하는 꿈을 이뤘을 때, 상대(원본 주인)의 목록에서도 같이 지워 줍니다.
 *
 * 지금 구조에서 '함께하기'는 공유가 아니라 복제예요 — 내 목록에 별개 문서(사본)가 생기고,
 * 내가 그 사본을 완료해도 상대의 원본은 계속 '도전 중'으로 남습니다. 그래서 둘이 같이 다녀오고
 * 각자 체크했는데도 서로의 목록엔 여전히 미완료로 보이는 일이 생겼어요.
 *
 * 원본 문서를 통째로 바꾸는 건 보안 규칙상(그리고 남의 기록이라) 안 되지만, 이미 열려 있는
 * '도와주기' 경로(done / helpedBy / participants 만 수정 가능)를 그대로 쓰면 규칙을 건드리지 않고
 * 원본도 이룬 것으로 표시할 수 있습니다. 사진·글 같은 기록은 각자 자기 것에만 남습니다.
 *
 * 실패해도(이미 완료됐거나 권한이 없거나) 내 완료 처리는 그대로 유지되도록 조용히 넘어갑니다.
 */
export async function markSourceDone(sourceItemId: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(itemDoc(sourceItemId));
    if (!snap.exists()) return false;
    const target = snap.data() as RawItem;
    if (target.ownerId === uid) return false; // 내 꿈이면 할 일 없음
    if (target.done) return false;            // 이미 이룬 상태면 건드리지 않음
    await updateDoc(itemDoc(sourceItemId), {
      done: true,
      helpedBy: arrayUnion(uid),
      participants: arrayUnion(uid),
    });
    return true;
  } catch {
    return false;
  }
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

// 친구 꿈 함께하기: 대상 아이템의 participants에 나를 추가 + saves 카운트 증가 + 내 목록에 사본 생성.
// 만들어진(또는 이미 있던) 내 사본의 id를 돌려줍니다 — 목표일 알림을 걸 때 씁니다.
export async function joinItem(targetId: string, uid: string): Promise<string> {
  const targetSnap = await getDoc(itemDoc(targetId));
  if (!targetSnap.exists()) throw new Error('꿈을 찾을 수 없어요');
  const target = targetSnap.data() as RawItem;
  if (target.ownerId === uid) throw new Error('내 꿈은 함께하기 할 수 없어요');

  const existing = await getDocs(query(itemsCol(), where('ownerId', '==', uid), where('origin', '==', 'joined'), where('sourceItemId', '==', targetId)));
  const alreadyParticipant = (target.participants || []).includes(uid);

  // 함께하기가 원자적이지 않아서, 통신이 느릴 때 버튼을 두 번 누르면 두 번 다 "아직 안 담았다"고
  // 판단해 같은 꿈이 두 개 담겼습니다. 사본 문서 id를 (사람+원본) 조합으로 고정하면, 동시에 두 번
  // 눌러도 두 write 가 같은 문서를 가리켜 하나만 만들어집니다(두 번째는 덮어쓰기).
  const copyRef = doc(db, 'items', `joined_${uid}_${targetId}`);

  const batch = writeBatch(db);
  if (!alreadyParticipant) {
    batch.update(itemDoc(targetId), { participants: arrayUnion(uid), savesCount: increment(existing.empty ? 1 : 0) });
  }
  if (existing.empty) {
    batch.set(copyRef, {
      ownerId: uid, title: target.title, emoji: target.emoji, note: target.note, categories: rawCategories(target), location: target.location,
      // 목표일·우선순위를 원본에서 그대로 물려받습니다. 예전엔 null로 버려서, 기념일에 맞춰
      // 날짜를 넣어둔 꿈을 상대가 함께해도 그 사람 카드엔 D-day가 안 떴어요(알림도 당연히 없었고요).
      targetDate: target.targetDate || null, priority: target.priority || null,
      order: 0, ownerPublic: getMyVisibility(),
      done: false, memory: null, participants: [target.ownerId], origin: 'joined',
      sourceOwnerId: target.ownerId, sourceItemId: targetId, helpedBy: [], likesCount: 0, savesCount: 0, createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return copyRef.id;
}

export async function leaveItem(targetId: string, uid: string): Promise<void> {
  const targetSnap = await getDoc(itemDoc(targetId));
  if (!targetSnap.exists()) return;
  const target = targetSnap.data() as RawItem;

  const mine = await getDocs(query(itemsCol(), where('ownerId', '==', uid), where('origin', '==', 'joined'), where('sourceItemId', '==', targetId), where('done', '==', false)));

  // savesCount는 '내가 참여자였는지'로 판단해 정확히 1만 내립니다. 예전엔 아직 안 이룬 사본이
  // 있을 때만 내려서, 사본을 이미 완료한 뒤 나가면 참여자에서는 빠지는데 카운트는 안 줄어드는
  // 불일치가 있었어요(담기는 참여자 기준으로 올라갑니다).
  const wasParticipant = (target.participants || []).includes(uid);
  const batch = writeBatch(db);
  batch.update(itemDoc(targetId), { participants: arrayRemove(uid), savesCount: increment(wasParticipant ? -1 : 0) });
  mine.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// 친구 꿈 도와서 이뤄줌: 대상 완료 처리 + 내 기록에 커스텀 제목으로 새 아이템 생성
export async function helpItem(targetId: string, uid: string, payload: { title: string; emoji: string; note?: string; text?: string }): Promise<Item> {
  const targetSnap = await getDoc(itemDoc(targetId));
  if (!targetSnap.exists()) throw new Error('꿈을 찾을 수 없어요');
  const target = targetSnap.data() as RawItem;
  if (target.ownerId === uid) throw new Error('내 꿈은 도와줄 수 없어요');

  const date = localDateStamp();
  const batch = writeBatch(db);
  batch.update(itemDoc(targetId), { done: true, helpedBy: arrayUnion(uid), participants: arrayUnion(uid) });
  const newRef = doc(itemsCol());
  const rec: RawItem = {
    ownerId: uid, title: payload.title, emoji: payload.emoji, note: payload.note || '', categories: [], location: null,
    targetDate: null, priority: null, order: 0, ownerPublic: getMyVisibility(),
    done: true, memory: { photo: null, photos: [], text: payload.text || '', date }, participants: [target.ownerId],
    origin: 'helped', helpedForId: target.ownerId, sourceOwnerId: target.ownerId, sourceTitle: target.title, sourceEmoji: target.emoji, sourceItemId: targetId,
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
 *
 * knownIds를 주면(화면이 이미 내 목록을 불러온 상태라 id를 알고 있으면) 문서를 통째로 다시
 * 읽어서 뭐가 바뀌어야 하는지 알아내는 단계 없이 바로 씁니다 — 이 "매번 전체 재읽기" 단계가
 * "전체공개/비공개 전환이 느리다"는 문제의 진짜 원인이었어요. 같은 값을 한 번 더 써도 안전하니
 * (그냥 같은 값을 한 번 더 쓰는 것뿐) "달라진 것만" 가려낼 필요도 없습니다.
 * knownIds가 없거나(예: 로그인 직후, 아직 내 목록을 안 불러온 상태) 그 목록으로 쓰다가 실패하면
 * (예: 다른 기기에서 방금 삭제해서 이제 없는 문서) 예전처럼 제대로 읽고 쓰는 경로로 다시 시도합니다.
 */
export async function backfillOwnerPublic(uid: string, isPublic: boolean, knownIds?: string[]): Promise<number> {
  const CHUNK = 400;
  if (knownIds && knownIds.length) {
    try {
      for (let i = 0; i < knownIds.length; i += CHUNK) {
        const batch = writeBatch(db);
        knownIds.slice(i, i + CHUNK).forEach((id) => batch.update(itemDoc(id), { ownerPublic: isPublic }));
        await batch.commit();
      }
      return knownIds.length;
    } catch {
      // 아래의 읽고-쓰기 경로로 안전하게 다시 시도
    }
  }
  const snap = await getDocs(query(itemsCol(), where('ownerId', '==', uid)));
  const stale = snap.docs.filter((d) => (d.data() as RawItem).ownerPublic !== isPublic);
  for (let i = 0; i < stale.length; i += CHUNK) {
    const batch = writeBatch(db);
    stale.slice(i, i + CHUNK).forEach((d) => batch.update(d.ref, { ownerPublic: isPublic }));
    await batch.commit();
  }
  return stale.length;
}

/**
 * 예전에 만들어진 내 아이템에 나중에 추가된 필드(ownerPublic, order, participants, helpedBy, categories)가
 * 빠져 있으면 채워 넣습니다. 안 채우면 둘러보기에 안 뜨거나, 순서가 뒤죽박죽이거나, 함께하기/도움
 * 업데이트가 보안 규칙(없는 배열 필드를 참조)에서 거부될 수 있어요. 로그인 직후 한 번 돌립니다.
 * 이미 다 채워진 새 계정은 고칠 게 없어 쓰기가 0건이라 사실상 공짜예요.
 */
export async function migrateLegacyItems(uid: string, isPublic: boolean): Promise<number> {
  const snap = await getDocs(query(itemsCol(), where('ownerId', '==', uid)));
  const CHUNK = 400;
  const stale = snap.docs.filter((d) => {
    const r = d.data() as RawItem;
    return r.ownerPublic !== isPublic
      || typeof r.order !== 'number'
      || !Array.isArray(r.participants)
      || !Array.isArray(r.helpedBy)
      || !Array.isArray((r as any).categories) && !(r as any).category;
  });
  for (let i = 0; i < stale.length; i += CHUNK) {
    const batch = writeBatch(db);
    stale.slice(i, i + CHUNK).forEach((d) => {
      const r = d.data() as RawItem;
      const patch: Record<string, any> = { ownerPublic: isPublic };
      if (typeof r.order !== 'number') patch.order = 0;
      if (!Array.isArray(r.participants)) patch.participants = [];
      if (!Array.isArray(r.helpedBy)) patch.helpedBy = [];
      if (!Array.isArray((r as any).categories) && !(r as any).category) patch.categories = [];
      batch.update(d.ref, patch);
    });
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

/**
 * 계정 삭제용 — 내가 남의 꿈에 눌러 둔 좋아요(items/{any}/likes/{내uid})를 전부 지웁니다.
 * 컬렉션 그룹 색인이 아직 없으면 조용히 건너뜁니다(계정 삭제 흐름을 막지 않기 위해 best-effort).
 */
export async function deleteMyLikes(uid: string): Promise<number> {
  try {
    const snap = await getDocs(query(collectionGroup(db, 'likes'), where('userId', '==', uid)));
    const CHUNK = 400;
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return snap.docs.length;
  } catch {
    return 0;
  }
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
