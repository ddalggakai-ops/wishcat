// 위시캣 디자인 토큰 — 웹 프로토타입(별/하늘/구름 + 키치 포인트)과 톤을 맞춤
export const colors = {
  bg: '#DCEBFB',
  bgTop: '#5E97D6',
  bgBottom: '#BBD8F3',
  surface: '#FFFFFF',
  surface2: '#EEF4FC',
  surface3: '#E1EBF8',
  ink: '#1E2E45',
  ink2: '#4A5C7A',
  ink3: '#8797B0',
  line: '#E4EDF8',
  line2: '#D3E0F0',
  accent: '#5B8DEF',
  accentInk: '#3E6BD0',
  accentWash: '#E9F0FE',
  done: '#3FB09A',
  doneWash: '#E5F5F1',
  star: '#F4B740',
  like: '#F0506A',
  info: '#7B84E6',
  infoWash: '#EDEEFC',
  gift: '#D98CB0',
  giftWash: '#FBECF3',
  candyPink: '#FF7FA6',
  candyYellow: '#FFCA4A',
  candyMint: '#4FD8B4',
  candyLavender: '#B49CF2',
  candyCoral: '#FF8B6B',
};

export const CATEGORIES = ['여행', '액티비티', '취미', '음식', '관계', '자연', '성장', '도전'];

export const CAT_COLORS: Record<string, { bg: string; ink: string }> = {
  여행: { bg: '#FFE4D6', ink: '#E4703A' },
  액티비티: { bg: '#DFF5EC', ink: '#1FA37B' },
  취미: { bg: '#EDE7FB', ink: '#7C5CD1' },
  음식: { bg: '#FFF3D2', ink: '#C9900E' },
  관계: { bg: '#FDE3ED', ink: '#E14C82' },
  자연: { bg: '#E1F3E0', ink: '#4A9A4C' },
  성장: { bg: '#E3EEFD', ink: '#3E7BD0' },
  도전: { bg: '#FBE4E4', ink: '#D8544E' },
};
export function catColor(cat?: string | null) {
  return (cat && CAT_COLORS[cat]) || { bg: colors.surface2, ink: colors.ink2 };
}

export const AVATAR_COLORS = ['#7BA7EE', '#6FCFB6', '#F4A9C6', '#C3B5F0', '#F4C860', '#8AD4EC', '#F0A0AE'];
export function colorFor(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i);
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

export const EMOJIS = ['🌴', '🪂', '🏃', '🌌', '🎨', '🍜', '🏔️', '✈️', '🎸', '📚', '🐬', '🍰', '🚗', '💃', '🏄', '🎤', '⛺', '🎢', '🥾', '🌅', '🎬', '🎹'];
export const HELP_EMOJIS = ['🎁', '💘', '🤝', '🥂', '🎉', '💐', '🍾', '🫶', '📷', '🎊', '🌟', '☕'];

// RN 0.86 타입에서 StyleSheet.absoluteFillObject가 빠져서 직접 정의해서 사용
export const absoluteFill = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 };

export const radius = { sm: 12, md: 18, lg: 22, xl: 26, pill: 999 };
export const shadow = {
  sm: { shadowColor: '#34548C', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#34548C', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
};
