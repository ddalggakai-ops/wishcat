// 위시캣 디자인 토큰 — "다이어리 파스텔" 비주얼 디자인 시스템
// (핀터레스트 감성의 파스텔 그라디언트 + 부드러운 그림자, 승인된 wishcat-diary-style.html 기준)

// ── 역할별 그라디언트 팔레트 ────────────────────────────────────────────
export const roleColors = {
  primary: { 1: '#7178E5', 2: '#96A6EE', ink: '#5B62D6', wash: '#ECEDFC' },
  secondary: { 1: '#FC9D8E', 2: '#FDB9A6', ink: '#E06A52', wash: '#FFEDE8' },
  accent: { 1: '#FF7BA6', 2: '#FFA1BF', ink: '#E0447D', wash: '#FFE7F0' },
  highlight: { 1: '#FDC54F', 2: '#FDD68A', ink: '#9C6A0A', wash: '#FFF4DC' },
};
export type Role = keyof typeof roleColors;

// 각 role의 135deg 그라디언트 컬러 스톱 (expo-linear-gradient에 그대로 사용)
export const gradients: Record<Role, [string, string]> = {
  primary: [roleColors.primary[1], roleColors.primary[2]],
  secondary: [roleColors.secondary[1], roleColors.secondary[2]],
  accent: [roleColors.accent[1], roleColors.accent[2]],
  highlight: [roleColors.highlight[1], roleColors.highlight[2]],
};

// 카드 색상 계열에 맞춘 컬러 섀도우 (iOS는 그대로 색상 그림자, Android는 elevation만 회색으로 적용됨 — RN/Android 공통 한계)
export const shadowColors: Record<Role, string> = {
  primary: 'rgba(108,114,224,.35)',
  secondary: 'rgba(252,148,132,.35)',
  accent: 'rgba(255,111,158,.35)',
  highlight: 'rgba(253,197,79,.35)',
};

// ── 기본 톤 ─────────────────────────────────────────────────────────
export const colors = {
  // 배경/표면
  bg: '#F8F7FC',
  bgTop: '#F8F7FC',
  bgBottom: '#F8F7FC',
  surface: '#FFFFFF',
  surface2: '#FBFAFF',
  surface3: '#EAE6F5',
  neutral: '#EAE6F5',
  // 텍스트
  ink: '#2E2A3D',
  ink2: '#8B87A0',
  ink3: '#C7C3DC',
  // 테두리
  line: '#EAE6F5',
  line2: '#EAE6F5',
  // 메인(=Primary) — 기존 accent 자리를 대체
  accent: roleColors.primary[1],
  accentInk: roleColors.primary.ink,
  accentWash: roleColors.primary.wash,
  // 완료/축하 상태는 디자인 시스템 우선순위대로 Accent(마젠타 핑크) 계열 사용
  done: roleColors.accent.ink,
  doneWash: roleColors.accent.wash,
  star: roleColors.highlight[1],
  like: roleColors.accent[1],
  info: roleColors.primary[1],
  infoWash: roleColors.primary.wash,
  gift: roleColors.secondary[1],
  giftWash: roleColors.secondary.wash,
  candyPink: roleColors.accent[1],
  candyYellow: roleColors.highlight[1],
  candyMint: roleColors.primary[2],
  candyLavender: roleColors.primary[1],
  candyCoral: roleColors.secondary[1],
};

// 카테고리는 8개, 4개 역할 색상을 2개씩 번갈아 배정 (균형 있게)
export const CATEGORIES = ['여행', '액티비티', '취미', '음식', '관계', '자연', '성장', '도전'];

const CAT_ROLE: Record<string, Role> = {
  여행: 'secondary',
  액티비티: 'accent',
  취미: 'primary',
  음식: 'highlight',
  관계: 'accent',
  자연: 'primary',
  성장: 'secondary',
  도전: 'highlight',
};

export const CAT_COLORS: Record<string, { bg: string; ink: string }> = Object.fromEntries(
  CATEGORIES.map((c) => {
    const r = roleColors[CAT_ROLE[c]];
    return [c, { bg: r.wash, ink: r.ink }];
  })
);
export function catColor(cat?: string | null) {
  return (cat && CAT_COLORS[cat]) || { bg: colors.surface2, ink: colors.ink2 };
}
export function catRole(cat?: string | null): Role {
  return (cat && CAT_ROLE[cat]) || 'primary';
}

export const AVATAR_COLORS = [
  roleColors.primary[1], roleColors.accent[1], roleColors.secondary[1],
  roleColors.primary[2], roleColors.highlight[1], roleColors.accent[2], roleColors.secondary[2],
];
export function colorFor(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i);
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

export const EMOJIS = ['🌴', '🪂', '🏃', '🌌', '🎨', '🍜', '🏔️', '✈️', '🎸', '📚', '🐬', '🍰', '🚗', '💃', '🏄', '🎤', '⛺', '🎢', '🥾', '🌅', '🎬', '🎹'];
export const HELP_EMOJIS = ['🎁', '💘', '🤝', '🥂', '🎉', '💐', '🍾', '🫶', '📷', '🎊', '🌟', '☕'];

// RN 0.86 타입에서 StyleSheet.absoluteFillObject가 빠져서 직접 정의해서 사용
export const absoluteFill = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 };

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };

// 중립(회색 계열) 그림자 — 리스트 카드, 시트 등 일반 요소용
export const shadow = {
  sm: { shadowColor: '#2E2A3D', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  md: { shadowColor: '#2E2A3D', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  lg: { shadowColor: '#2E2A3D', shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
};

// 역할별 컬러 그림자 — GradientCard 등 메인 포인트 카드용
export function coloredShadow(role: Role) {
  return {
    shadowColor: shadowColors[role],
    shadowOpacity: 1, // shadowColors already carries its own alpha via rgba()
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  };
}
