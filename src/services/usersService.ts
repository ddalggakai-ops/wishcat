import { collection, doc, documentId, getDoc, getDocs, query, setDoc, updateDoc, serverTimestamp, where } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { colorFor } from '../theme';
import { withTimeout } from './withTimeout';
import type { MeUser, PublicUser, UserBrief } from '../api/types';

export const DEFAULT_BIO = '✦ 오늘도 꿈을 하나씩 채우는 중';

const cache = new Map<string, PublicUser>();
// 같은 uid를 여러 곳에서 동시에(아직 캐시에 없는 상태로) 요청하면 예전엔 요청마다 따로
// 네트워크를 탔어요(예: 아이템 20개가 같은 참가자를 참조하면 20번 요청). 진행 중인 요청을
// 여기 저장해 두고 재사용하면 같은 uid는 딱 한 번만 서버에 갑니다.
const inFlight = new Map<string, Promise<PublicUser>>();

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 로그아웃/계정 전환 시 호출 — 이전 계정 세션의 프로필(이름·공개여부 등)이 다음 계정에 남지 않게 비웁니다. */
export function clearUserCache() {
  cache.clear();
}

export function primeUserCache(uid: string, data: { name: string; bio?: string; listPublic?: boolean; photoUrl?: string | null }) {
  const u: PublicUser = {
    id: uid, name: data.name, avatarColor: colorFor(data.name),
    bio: data.bio || '', listPublic: data.listPublic !== false, photoUrl: data.photoUrl || null,
  };
  cache.set(uid, u);
  return u;
}

export async function getUserBrief(uid: string): Promise<UserBrief> {
  const full = await getUserPublicCached(uid);
  return { id: full.id, name: full.name, avatarColor: full.avatarColor, photoUrl: full.photoUrl };
}

export async function getUserPublicCached(uid: string): Promise<PublicUser> {
  const hit = cache.get(uid);
  if (hit) return hit;
  const pending = inFlight.get(uid);
  if (pending) return pending;
  const task = (async () => {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.data() as any;
    const u: PublicUser = {
      id: uid,
      name: data?.name || '알 수 없음',
      avatarColor: colorFor(data?.name || uid),
      bio: data?.bio || '',
      listPublic: data?.listPublic !== false,
      photoUrl: data?.photoUrl || null,
    };
    cache.set(uid, u);
    return u;
  })();
  inFlight.set(uid, task);
  try {
    return await task;
  } finally {
    inFlight.delete(uid);
  }
}

/**
 * 여러 uid를 한꺼번에 캐시에 채워 넣습니다. 목록 화면(내 목록·둘러보기·사람 페이지)에서
 * 아이템마다 소유자·참가자·도움 준 사람을 한 명씩 따로 읽으면 아이템 수만큼 왕복이 생겨요
 * (Firestore Lite는 REST라 매 조회가 왕복 하나). 이미 캐시에 없는 uid만 모아 'in' 쿼리로
 * 최대 30개씩 나눠 한 번에 가져오면, 개별 조회 N번이 배치 조회 ceil(N/30)번으로 줄어듭니다.
 */
export async function primeUsersBatch(uids: (string | null | undefined)[]): Promise<void> {
  const need = Array.from(new Set(uids.filter((id): id is string => !!id && !cache.has(id))));
  if (!need.length) return;
  await Promise.all(
    chunk(need, 30).map(async (ids) => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', ids)));
        snap.forEach((d) => {
          const u = d.data() as any;
          primeUserCache(d.id, { name: u?.name || '알 수 없음', bio: u?.bio, listPublic: u?.listPublic, photoUrl: u?.photoUrl });
        });
      } catch {
        // 배치 조회가 실패해도(색인·권한 등) hydrateItem이 필요할 때 개별 조회로 다시 시도하니 조용히 넘어갑니다.
      }
    })
  );
}

export async function createUserProfile(uid: string, name: string) {
  const bio = DEFAULT_BIO;
  await withTimeout(
    setDoc(doc(db, 'users', uid), { name, bio, listPublic: true, photoUrl: null, createdAt: serverTimestamp() }),
    '프로필 저장'
  );
  primeUserCache(uid, { name, bio, listPublic: true, photoUrl: null });
}

export async function fetchMe(uid: string, email: string, fallbackName?: string): Promise<MeUser> {
  const snap = await withTimeout(getDoc(doc(db, 'users', uid)), '내 프로필 불러오기');

  // Auth 계정은 있는데 users 문서가 없는 경우(예: 예전 가입이 중간에 끊긴 계정)를
  // 여기서 스스로 복구합니다. 안 그러면 그 계정은 영구히 앱을 못 쓰게 돼요.
  if (!snap.exists()) {
    const name = (fallbackName || email.split('@')[0] || '나').slice(0, 12);
    await createUserProfile(uid, name);
    return { id: uid, name, avatarColor: colorFor(name), bio: DEFAULT_BIO, listPublic: true, photoUrl: null, email };
  }

  const data = snap.data() as any;
  const u = primeUserCache(uid, { name: data?.name || '나', bio: data?.bio, listPublic: data?.listPublic, photoUrl: data?.photoUrl });
  return { ...u, email };
}

export async function updateMyProfile(uid: string, patch: Partial<{ name: string; bio: string; listPublic: boolean; photoUrl: string | null }>) {
  await updateDoc(doc(db, 'users', uid), patch as any);
  cache.delete(uid); // 다음 조회 때 새로 불러오도록
}
