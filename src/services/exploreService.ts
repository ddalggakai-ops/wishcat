import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { hydrateItem, primeViewerLikes, relatedUserIds } from './itemsService';
import { primeUsersBatch } from './usersService';
import { getBlockedIds } from './moderationService';
import type { Item } from '../api/types';

/** 한 번에 가져올 최대 아이템 수. 정렬/필터는 이 안에서 이뤄집니다. */
export const EXPLORE_LIMIT = 150;

// 탭을 왔다갔다 할 때마다 화면이 통째로 다시 마운트되면서 매번 전체를 다시 읽지 않도록,
// 같은 필터로 최근에 이미 받아온 결과는 잠깐 그대로 씁니다. pull-to-refresh는 force로 건너뜁니다.
let exploreCache: { key: string; at: number; items: Item[] } | null = null;
const EXPLORE_CACHE_TTL_MS = 20_000;

/** 방금 누군가를 차단했을 때처럼, 캐시된 둘러보기 결과를 즉시 버려야 할 때 부릅니다. */
export function clearExploreCache() {
  exploreCache = null;
}

export async function getExploreItems(viewerUid: string, filter: 'all' | 'done' = 'all', opts?: { force?: boolean }): Promise<Item[]> {
  const cacheKey = `${viewerUid}:${filter}`;
  if (!opts?.force && exploreCache && exploreCache.key === cacheKey && Date.now() - exploreCache.at < EXPLORE_CACHE_TTL_MS) {
    return exploreCache.items;
  }
  // 예전 구현은 users 컬렉션 전체를 읽어 공개 사용자를 추린 뒤 ownerId in [...] 쿼리를
  // 30명씩 나눠 던졌습니다. 사용자가 늘어나면 화면 한 번 여는 데 읽기가 선형으로 늘어나요.
  // 지금은 아이템에 비정규화해 둔 ownerPublic 하나로 서버에서 바로 거릅니다.
  const items = collection(db, 'items');
  async function fetchItemDocs(): Promise<{ id: string; data: any }[]> {
    const out: { id: string; data: any }[] = [];
    try {
      const snap = await getDocs(query(items, where('ownerPublic', '==', true), orderBy('likesCount', 'desc'), limit(EXPLORE_LIMIT)));
      snap.forEach((d) => out.push({ id: d.id, data: d.data() }));
    } catch {
      // (ownerPublic, likesCount) 복합 색인이 아직 만들어지지 않았다면
      // 색인이 필요 없는 단일 필드 쿼리로 내려가고 정렬은 아래에서 직접 합니다.
      const snap = await getDocs(query(items, where('ownerPublic', '==', true), limit(EXPLORE_LIMIT)));
      snap.forEach((d) => out.push({ id: d.id, data: d.data() }));
    }
    return out;
  }

  // 예전엔 "아이템 목록 → 차단 목록 → (소유자 프로필 + 좋아요)"를 한 줄씩 순서대로 기다렸는데,
  // 서로 의존하지 않는 요청(아이템 목록 / 차단 목록 / 내가 누른 좋아요)까지 굳이 줄 세울 이유가 없어서
  // 셋 다 한꺼번에 쏘도록 바꿨습니다. 왕복이 하나 줄어드는 만큼 체감 속도가 빨라져요.
  const [rawDocs, blocked] = await Promise.all([
    fetchItemDocs(),
    getBlockedIds(viewerUid),
    primeViewerLikes(viewerUid, { force: opts?.force }),
  ]);

  let docs = rawDocs.filter((d) => d.data.ownerId !== viewerUid && !blocked.has(d.data.ownerId));
  if (filter === 'done') docs = docs.filter((d) => !!d.data.done);
  if (docs.length === 0) return [];

  // 소유자·참가자·도움 준 사람 프로필을 한 번에 받아 둡니다(아이템별로 따로 읽던 걸 없애기
  // 위한 사전 적재). 좋아요는 위에서 이미 병렬로 미리 읽어 뒀어요.
  await primeUsersBatch(docs.flatMap((d) => relatedUserIds(d.data)));

  const hydrated = await Promise.all(docs.map((d) => hydrateItem(d.id, d.data, viewerUid)));

  hydrated.sort(
    (a, b) =>
      b.likesCount + (b.done ? 5 : 0) + (b.hot ? 10 : 0) - (a.likesCount + (a.done ? 5 : 0) + (a.hot ? 10 : 0))
  );

  const result = hydrated.slice(0, 100);
  exploreCache = { key: cacheKey, at: Date.now(), items: result };
  return result;
}
