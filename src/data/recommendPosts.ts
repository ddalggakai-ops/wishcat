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

/**
 * 내장(기본) 추천 여행 포스팅 — 서버(Firestore `recommendPosts`)에서 못 불러올 때의 폴백입니다.
 * 실제 운영 값은 서버에서 관리하고, 이 JSON은 최초 시드 원본이자 안전망이에요.
 */
export const RECOMMEND_POSTS: RecommendPost[] = (postsJson as unknown as RecommendPost[]);
