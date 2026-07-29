import type { NewItemPayload } from '../services/itemsService';

export interface StarterPack {
  key: string;
  title: string;
  emoji: string;
  desc: string;
  items: NewItemPayload[];
}

/**
 * 콜드스타트용 시작 템플릿.
 * 처음 들어온 사람이 빈 화면 앞에서 멈추지 않도록, 골라서 한 번에 담을 수 있는 묶음입니다.
 * category 값은 theme.ts 의 CATEGORIES 에 있는 문자열만 씁니다.
 * (여행 · 액티비티 · 취미 · 음식 · 관계 · 자연 · 성장 · 도전)
 */
export const STARTER_PACKS: StarterPack[] = [
  {
    key: 'travel',
    title: '언젠가 떠나고 싶어',
    emoji: '✈️',
    desc: '여행 버킷 8개',
    items: [
      { title: '오로라 보러 가기', emoji: '🌌', categories: ['여행'], location: { name: '아이슬란드', region: 'overseas' } },
      { title: '제주 올레길 하루 종일 걷기', emoji: '🥾', categories: ['여행'], location: { name: '제주', region: 'domestic' } },
      { title: '벚꽃 절정일 때 진해 가보기', emoji: '🌅', categories: ['자연'], location: { name: '진해', region: 'domestic' } },
      { title: '혼자 떠나는 2박 3일', emoji: '✈️', categories: ['여행'] },
      { title: '야간열차 타보기', emoji: '🚗', categories: ['여행'] },
      { title: '바다 보이는 숙소에서 하룻밤', emoji: '🏄', categories: ['여행'] },
      { title: '해외에서 한 달 살기', emoji: '🌴', categories: ['여행'] },
      { title: '별 보러 산 위에 올라가기', emoji: '🏔️', categories: ['자연'] },
    ],
  },
  {
    key: 'daily',
    title: '올해는 이것만은',
    emoji: '📚',
    desc: '일상 습관 8개',
    items: [
      { title: '아침 6시 기상 30일 채우기', emoji: '🌅', categories: ['성장'] },
      { title: '책 12권 읽기', emoji: '📚', categories: ['성장'] },
      { title: '10km 달리기 완주', emoji: '🏃', categories: ['액티비티'] },
      { title: '한 달 커피값 아껴서 저금하기', emoji: '🍰', categories: ['성장'] },
      { title: '손편지 세 통 쓰기', emoji: '📚', categories: ['관계'] },
      { title: '악기 한 곡 끝까지 연주하기', emoji: '🎹', categories: ['취미'] },
      { title: '요리 레시피 10개 익히기', emoji: '🍜', categories: ['음식'] },
      { title: '휴대폰 없는 하루 보내기', emoji: '⛺', categories: ['성장'] },
    ],
  },
  {
    key: 'together',
    title: '친구랑 같이',
    emoji: '💃',
    desc: '함께하면 좋은 8개',
    items: [
      { title: '같이 일출 보러 가기', emoji: '🌅', categories: ['관계'] },
      { title: '둘이서 요리 대결하기', emoji: '🍜', categories: ['음식'] },
      { title: '노래방 4시간 버티기', emoji: '🎤', categories: ['취미'] },
      { title: '한강에서 자전거 완주', emoji: '🏃', categories: ['액티비티'] },
      { title: '서로 사진 찍어주는 날', emoji: '🎨', categories: ['관계'] },
      { title: '같이 전시회 가기', emoji: '🎨', categories: ['취미'] },
      { title: '캠핑 가서 불멍하기', emoji: '⛺', categories: ['자연'] },
      { title: '10년 뒤에 열어볼 편지 쓰기', emoji: '📚', categories: ['관계'] },
    ],
  },
  {
    key: 'brave',
    title: '한 번쯤은 용기내서',
    emoji: '🪂',
    desc: '도전 8개',
    items: [
      { title: '번지점프 뛰어보기', emoji: '🪂', categories: ['도전'] },
      { title: '스쿠버다이빙 배워보기', emoji: '🐬', categories: ['도전'] },
      { title: '무대에서 발표해보기', emoji: '🎤', categories: ['도전'] },
      { title: '머리 스타일 확 바꾸기', emoji: '💃', categories: ['도전'] },
      { title: '외국어로 대화 5분 하기', emoji: '📚', categories: ['성장'] },
      { title: '마라톤 하프 완주', emoji: '🏃', categories: ['액티비티'] },
      { title: '내 이름으로 글 하나 올리기', emoji: '🎨', categories: ['도전'] },
      { title: '혼자 영화관 가기', emoji: '🎬', categories: ['도전'] },
    ],
  },
];
