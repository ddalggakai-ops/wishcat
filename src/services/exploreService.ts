import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { hydrateItem } from './itemsService';
import { primeUserCache } from './usersService';
import type { Item } from '../api/types';

// Firestore 'in' 쿼리는 최대 30개 값까지만 지원 — 공개 사용자가 많을 경우를 대비해 청크 처리
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function getExploreItems(viewerUid: string, filter: 'all' | 'done' = 'all'): Promise<Item[]> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const publicUserIds: string[] = [];
  usersSnap.forEach((d) => {
    if (d.id === viewerUid) return;
    const data = d.data() as any;
    if (data?.listPublic === false) return;
    primeUserCache(d.id, { name: data?.name || '알 수 없음', bio: data?.bio, listPublic: data?.listPublic });
    publicUserIds.push(d.id);
  });
  if (publicUserIds.length === 0) return [];

  const chunks = chunk(publicUserIds, 30);
  const snaps = await Promise.all(
    chunks.map((ids) => getDocs(query(collection(db, 'items'), where('ownerId', 'in', ids))))
  );

  const rawDocs: { id: string; data: any }[] = [];
  snaps.forEach((snap) => snap.forEach((d) => rawDocs.push({ id: d.id, data: d.data() })));

  let filtered = rawDocs;
  if (filter === 'done') filtered = filtered.filter((d) => !!d.data.done);

  const items = await Promise.all(filtered.map((d) => hydrateItem(d.id, d.data, viewerUid)));

  items.sort(
    (a, b) =>
      b.likesCount + (b.done ? 5 : 0) + (b.hot ? 10 : 0) - (a.likesCount + (a.done ? 5 : 0) + (a.hot ? 10 : 0))
  );

  return items.slice(0, 100);
}
