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

export interface Memory {
  photo: string | null;
  text: string;
  date: string;
}

export interface Location {
  name: string;
  region: Region;
}

export interface ItemSource {
  ownerId: string;
  ownerName: string;
  itemId: string;
  title: string;
  emoji: string;
}

export interface Item {
  id: string;
  owner: UserBrief;
  title: string;
  emoji: string;
  note: string;
  category: string | null;
  location: Location | null;
  /** 목표일 (YYYY-MM-DD). 없으면 null */
  targetDate: string | null;
  done: boolean;
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
