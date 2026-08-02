import type { NewItemPayload } from '../services/itemsService';

export interface StarterPack {
  key: string;
  title: string;
  emoji: string;
  desc: string;
  /** 묶음을 관계별/혼자용으로 그룹핑해서 보여주기 위한 라벨 */
  group: string;
  items: NewItemPayload[];
}

const GROUP_RELATION = '함께하는 버킷리스트';
const GROUP_SOLO = '혼자서도 좋은';

/**
 * 콜드스타트용 시작 템플릿 + 관계별 추천 모음.
 * 처음 들어온 사람이 빈 화면 앞에서 멈추지 않도록, 골라서 한 번에 담을 수 있는 묶음입니다.
 * 특히 연인·부부/가족·친구처럼 '둘 이상'이 함께 담기 좋은 묶음을 앞쪽에 배치해, 초대해서
 * 함께 시작하는 흐름과 이어지도록 했습니다.
 * category 값은 theme.ts 의 CATEGORIES 문자열만 씁니다.
 * (여행 · 액티비티 · 취미 · 음식 · 관계 · 자연 · 성장 · 도전)
 */
export const STARTER_PACKS: StarterPack[] = [
  {
    key: 'couple',
    title: '연인과 함께',
    emoji: '💗',
    desc: '커플 버킷 8개',
    group: GROUP_RELATION,
    items: [
      { title: '둘이 첫 여행 떠나기', emoji: '✈️', categories: ['여행', '관계'] },
      { title: '서로에게 손편지 써서 주기', emoji: '📚', categories: ['관계'] },
      { title: '커플 사진 예쁘게 찍는 날', emoji: '🎨', categories: ['관계'] },
      { title: '같이 요리해서 저녁 차리기', emoji: '🍜', categories: ['음식', '관계'] },
      { title: '손잡고 일몰 보러 가기', emoji: '🌅', categories: ['자연', '관계'] },
      { title: '벚꽃 아래에서 데이트', emoji: '🌅', categories: ['자연'] },
      { title: '둘만의 기념일 만들기', emoji: '🎉', categories: ['관계'] },
      { title: '기념일마다 같은 자리에서 사진 남기기', emoji: '📷', categories: ['관계'] },
    ],
  },
  {
    key: 'together',
    title: '친구들과 함께',
    emoji: '💃',
    desc: '우정 버킷 8개',
    group: GROUP_RELATION,
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
    key: 'family',
    title: '부부·가족과',
    emoji: '🏡',
    desc: '가족 버킷 8개',
    group: GROUP_RELATION,
    items: [
      { title: '온 가족 여행 다녀오기', emoji: '✈️', categories: ['여행', '관계'] },
      { title: '사진관에서 가족사진 찍기', emoji: '📷', categories: ['관계'] },
      { title: '아이와 별 보러 가기', emoji: '🌌', categories: ['자연', '관계'] },
      { title: '명절 음식 같이 만들기', emoji: '🍜', categories: ['음식', '관계'] },
      { title: '부모님께 여행 보내드리기', emoji: '🎁', categories: ['관계'] },
      { title: '가족 캠핑 하룻밤', emoji: '⛺', categories: ['자연'] },
      { title: '매년 같은 날 가족사진 남기기', emoji: '📷', categories: ['관계'] },
      { title: '함께 텃밭이나 화분 키우기', emoji: '🌴', categories: ['취미', '자연'] },
    ],
  },
  {
    key: 'travel',
    title: '언젠가 떠나고 싶어',
    emoji: '✈️',
    desc: '여행 버킷 8개',
    group: GROUP_SOLO,
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
    group: GROUP_SOLO,
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
    key: 'brave',
    title: '한 번쯤은 용기내서',
    emoji: '🪂',
    desc: '도전 8개',
    group: GROUP_SOLO,
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

/** 그룹 등장 순서 (StarterSheet가 이 순서로 묶어서 보여줍니다) */
export const STARTER_GROUPS: string[] = STARTER_PACKS.reduce<string[]>((acc, p) => {
  if (!acc.includes(p.group)) acc.push(p.group);
  return acc;
}, []);
