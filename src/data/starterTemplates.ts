import type { NewItemPayload } from '../services/itemsService';
import packsJson from './starterPacks.json';

export interface StarterPack {
  key: string;
  title: string;
  emoji: string;
  desc: string;
  /** 묶음을 관계별/혼자용으로 그룹핑해서 보여주기 위한 라벨 */
  group: string;
  /** 정렬 순서 (서버에서 불러올 때 이 값으로 정렬) */
  order?: number;
  items: NewItemPayload[];
}

/**
 * 내장(기본) 시작 템플릿 — 서버(Firestore `starterPacks`)에서 못 불러올 때의 폴백입니다.
 * 실제 운영 값은 서버에서 관리하고(templatesService.getStarterPacks), 이 JSON은 최초 시드의
 * 원본이자 오프라인/규칙 미배포/컬렉션 비어있음 상황의 안전망입니다.
 * category 값은 theme.ts 의 CATEGORIES 문자열만 씁니다.
 */
export const STARTER_PACKS: StarterPack[] = (packsJson as unknown as StarterPack[]);

/** 그룹 등장 순서 */
export const STARTER_GROUPS: string[] = STARTER_PACKS.reduce<string[]>((acc, p) => {
  if (p.group && !acc.includes(p.group)) acc.push(p.group);
  return acc;
}, []);

/** 팩 배열에서 그룹 순서를 뽑아냅니다 (서버에서 불러온 목록에도 재사용). */
export function deriveStarterGroups(packs: StarterPack[]): string[] {
  return packs.reduce<string[]>((acc, p) => {
    if (p.group && !acc.includes(p.group)) acc.push(p.group);
    return acc;
  }, []);
}
