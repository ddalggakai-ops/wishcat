export type Region = 'domestic' | 'overseas';

export interface UserBrief {
  id: string;
  name: string;
  avatarColor: string;
  photoUrl: string | null;
}

export interface MeUser extends UserBrief {
  bio: string;
  listPublic: boolean;
  email: string;
}

export interface PublicUser extends UserBrief {
  bio: string;
  listPublic: boolean;
}

/** 버킷 하나에 담을 수 있는 추억 사진 최대 개수 */
export const MAX_MEMORY_PHOTOS = 10;

export interface Memory {
  /** @deprecated 첫 번째 사진의 별칭이에요(예전 버전 호환용). 항상 photos[0]과 같은 값이 들어가요. */
  photo: string | null;
  /** 추억 사진 여러 장 (최대 MAX_MEMORY_PHOTOS장) */
  photos: string[];
  text: string;
  date: string;
}

export interface Location {
  name: string;
  region: Region;
  /** 지도에서 직접 찍은 경우에만 채워집니다. 이름만 입력한 기존 아이템은 없을 수 있어요. */
  lat?: number;
  lng?: number;
}

export interface ItemSource {
  ownerId: string;
  ownerName: string;
  itemId: string;
  title: string;
  emoji: string;
}

export type Priority = 'high' | 'mid' | 'low';

export interface Item {
  id: string;
  owner: UserBrief;
  title: string;
  emoji: string;
  note: string;
  /** 카테고리 여러 개를 붙일 수 있어요. 없으면 빈 배열. */
  categories: string[];
  location: Location | null;
  /** 목표일 (YYYY-MM-DD). 없으면 null */
  targetDate: string | null;
  priority: Priority | null;
  /** 내가 직접 정렬한 순서(작을수록 위). 길게 눌러 순서를 바꾸면 갱신됩니다. */
  order: number;
  done: boolean;
  /** 진행 시작 시각(ISO). null이면 아직 시작 전. done이면 의미 없어요. */
  startedAt: string | null;
  memory: Memory | null;
  participants: UserBrief[];
  origin: 'own' | 'joined' | 'helped';
  source: ItemSource | null;
  helpedFor: UserBrief | null;
  helpedBy: UserBrief[];
  likesCount: number;
  likedByMe: boolean;
  savesCount: number;
  hot: boolean;
  createdAt: string;
}

export interface FriendEntry extends PublicUser {
  itemsCount: number;
  doneCount: number;
  withMeCount: number;
}
