import { collection, documentId, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { hydrateItem, primeViewerLikes } from './itemsService';
import { primeUserCache } from './usersService';
import { getBlockedIds } from './moderationService';
import type { Item } from '../api/types';

// Firestore 'in' 쿼리는 최대 30개 값까지만 지원
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 한 번에 가져올 최대 아이템 수. 정렬/필터는 이 안에서 이뤄집니다. */
export const EXPLORE_LIMIT = 150;

export async function getExploreItems(viewerUid: string, filter: 'all' | 'done' = 'all'): Promise<Item[]> {
  // 예전 구현은 users 컬렉션 전체를 읽어 공개 사용자를 추린 뒤 ownerId in [...] 쿼리를
  // 30명씩 나눠 던졌습니다. 사용자가 늘어나면 화면 한 번 여는 데 읽기가 선형으로 늘어나요.
  // 지금은 아이템에 비정규화해 둔 ownerPublic 하나로 서버에서 바로 거릅니다.
  const items = collection(db, 'items');
  let docs: { id: string; data: any }[] = [];
  try {
    const snap = await getDocs(query(items, where('ownerPublic', '==', true), orderBy('likesCount', 'desc'), limit(EXPLORE_LIMIT)));
    snap.forEach((d) => docs.push({ id: d.id, data: d.data() }));
  } catch {
    // (ownerPublic, likesCount) 복합 색인이 아직 만들어지지 않았다면
    // 색인이 필요 없는 단일 필드 쿼리로 내려가고 정렬은 아래에서 직접 합니다.
    const snap = await getDocs(query(items, where('ownerPublic', '==', true), limit(EXPLORE_LIMIT)));
    docs = [];
    snap.forEach((d) => docs.push({ id: d.id, data: d.data() }));
  }

  const blocked = await getBlockedIds(viewerUid);
  docs = docs.filter((d) => d.data.ownerId !== viewerUid && !blocked.has(d.data.ownerId));
  if (filter === 'done') docs = docs.filter((d) => !!d.data.done);
  if (docs.length === 0) return [];

  // 소유자 프로필과 "내가 누른 좋아요"를 각각 한 번에 받아 둡니다.
  // (아이템별로 따로 읽던 걸 없애기 위한 사전 적재)
  const ownerIds = Array.from(new Set(docs.map((d) => d.data.ownerId as string)));
  await Promise.all([
    ...chunk(ownerIds, 30).map(async (ids) => {
      const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', ids)));
      snap.forEach((d) => {
        const u = d.data() as any;
        primeUserCache(d.id, { name: u?.name || '알 수 없음', bio: u?.bio, listPublic: u?.listPublic, photoUrl: u?.photoUrl });
      });
    }),
    primeViewerLikes(viewerUid),
  ]);

  const hydrated = await Promise.all(docs.map((d) => hydrateItem(d.id, d.data, viewerUid)));

  hydrated.sort(
    (a, b) =>
      b.likesCount + (b.done ? 5 : 0) + (b.hot ? 10 : 0) - (a.likesCount + (a.done ? 5 : 0) + (a.hot ? 10 : 0))
  );

  return hydrated.slice(0, 100);
}
