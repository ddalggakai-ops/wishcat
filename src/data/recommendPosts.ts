import type { NewItemPayload } from '../services/itemsService';
import type { Role } from '../theme';
import postsJson from './recommendPosts.json';

export interface RecommendSection {
  heading: string;
  body: string;
}

export interface RecommendPost {
  id: string;
  /** 지역 이름 (예: 제주, 부산) */
  region: string;
  /** 피드에서 묶어 보여줄 분류 (예: 국내 여행지 · 해외 여행지 · 축제) */
  group?: string;
  title: string;
  emoji: string;
  /** 커버 그라디언트 색 역할 */
  role: Role;
  /** 피드 카드에 보이는 한 줄 소개 */
  teaser: string;
  readMinutes?: number;
  order?: number;
  sections: RecommendSection[];
  /** 글 마지막에서 '내 목록에 담기'로 이어지는 버킷 추천 항목 */
  items: NewItemPayload[];
}

/** 포스트 목록에서 그룹 순서를 뽑아냅니다 (등장 순서 유지). */
export function deriveRecommendGroups(posts: RecommendPost[]): string[] {
  return posts.reduce<string[]>((acc, p) => {
    const g = p.group || '여행지';
    if (!acc.includes(g)) acc.push(g);
    return acc;
  }, []);
}

/**
 * 내장(기본) 추천 여행 포스팅 — 서버(Firestore `recommendPosts`)에서 못 불러올 때의 폴백입니다.
 * 실제 운영 값은 서버에서 관리하고, 이 JSON은 최초 시드 원본이자 안전망이에요.
 */
export const RECOMMEND_POSTS: RecommendPost[] = (postsJson as unknown as RecommendPost[]);
