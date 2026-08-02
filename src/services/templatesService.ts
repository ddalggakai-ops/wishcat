import { collection, getDocs } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { STARTER_PACKS, STARTER_GROUPS, deriveStarterGroups, type StarterPack } from '../data/starterTemplates';
import { RECOMMEND_POSTS, type RecommendPost } from '../data/recommendPosts';

// 시작 템플릿(추천 버킷 모음)을 서버(Firestore `starterPacks`)에서 불러옵니다.
// 관리자가 앱 재빌드 없이 콘솔/시드로 내용을 갈아끼울 수 있게 하기 위한 구조예요.
// 못 불러오면(규칙 미배포·오프라인·컬렉션 비어있음) 앱에 내장된 기본 팩으로 안전하게 폴백합니다.

let cache: { at: number; packs: StarterPack[]; groups: string[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

const FALLBACK = { packs: STARTER_PACKS, groups: STARTER_GROUPS };

export async function getStarterPacks(opts?: { force?: boolean }): Promise<{ packs: StarterPack[]; groups: string[] }> {
  if (!opts?.force && cache && Date.now() - cache.at < TTL_MS) {
    return { packs: cache.packs, groups: cache.groups };
  }
  try {
    const snap = await getDocs(collection(db, 'starterPacks'));
    const packs = snap.docs
      .map((d) => ({ key: d.id, ...(d.data() as any) }) as StarterPack)
      .filter((p) => p.title && p.group && Array.isArray(p.items) && p.items.length > 0)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    if (!packs.length) return FALLBACK; // 아직 시드 전 → 내장 팩 사용
    const result = { packs, groups: deriveStarterGroups(packs) };
    cache = { at: Date.now(), ...result };
    return result;
  } catch {
    // 규칙 미배포/네트워크 문제 등 → 내장 팩으로 폴백
    return FALLBACK;
  }
}

/** 관리자가 시드/수정 후 즉시 반영하고 싶을 때 캐시를 비웁니다. */
export function clearStarterPacksCache() {
  cache = null;
}

// ── 추천 여행 포스팅 (지역별 가이드 + 담기) ─────────────────────────────────
let postsCache: { at: number; posts: RecommendPost[] } | null = null;

export async function getRecommendPosts(opts?: { force?: boolean }): Promise<RecommendPost[]> {
  if (!opts?.force && postsCache && Date.now() - postsCache.at < TTL_MS) return postsCache.posts;
  try {
    const snap = await getDocs(collection(db, 'recommendPosts'));
    const posts = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }) as RecommendPost)
      .filter((p) => p.title && p.region && Array.isArray(p.items) && p.items.length > 0)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    if (!posts.length) return RECOMMEND_POSTS;
    postsCache = { at: Date.now(), posts };
    return posts;
  } catch {
    return RECOMMEND_POSTS;
  }
}

export function clearRecommendPostsCache() {
  postsCache = null;
}
