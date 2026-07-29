// 위시캣 실제 Firebase 프로젝트에 데모용 가라데이터를 심는 스크립트.
//
// 10명의 페르소나 계정을 실제로 Firebase Auth에 만들고(이메일은 절대 배달되지 않는 예약 TLD
// `@wishcat.test`를 씁니다), 각자 5~30개의 버킷을 Firestore에 실제로 씁니다. 일부 "이룬 꿈"에는
// Storage에 간단한 단색 더미 사진도 올려서 memory.photo에 실제 다운로드 URL을 넣습니다.
//
// 앱(client SDK)이 쓰는 것과 완전히 동일한 REST API(Identity Toolkit / Firestore / Storage)를
// 각 계정의 idToken으로 호출하므로, firestore.rules·storage.rules를 그대로 통과합니다(관리자
// 우회 없음). 실행: node scripts/seed-demo-data.js
//
// 되돌리려면(계정+데이터 삭제) node scripts/delete-seed-data.js 를 만들어 쓰거나, Firebase 콘솔에서
// `@wishcat.test` 이메일 계정들을 지우고 그 uid로 만들어진 items 문서를 지우면 됩니다.
// (이 스크립트가 만든 uid 목록은 scripts/.seed-output.json 에 남습니다.)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── .env 읽기 (별도 패키지 없이 아주 단순한 파서) ──────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const out = {};
  text.split('\n').forEach((line) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  });
  return out;
}
const env = loadEnv();
const API_KEY = env.EXPO_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const DATABASE_ID = env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || '(default)';
const STORAGE_BUCKET = env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
if (!API_KEY || !PROJECT_ID) {
  console.error('EXPO_PUBLIC_FIREBASE_API_KEY / EXPO_PUBLIC_FIREBASE_PROJECT_ID 를 .env 에서 못 읽었어요.');
  process.exit(1);
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const SEED_PASSWORD = 'WishcatDemo2026!';

// ── 아주 작은 단색 PNG 인코더 (외부 패키지 없이) ────────────────────────────
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function makeSolidPng(size, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ── Firestore REST 값 인코딩 ───────────────────────────────────────────
function fv(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fv) } };
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } };
  throw new Error('알 수 없는 값 타입: ' + value);
}
function fields(obj) {
  const out = {};
  for (const k of Object.keys(obj)) out[k] = fv(obj[k]);
  return out;
}

async function req(url, opts) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${opts?.method || 'GET'} ${url} → ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

async function signUp(email, password) {
  const body = await req(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return { uid: body.localId, idToken: body.idToken };
}

async function createDoc(collectionPath, docId, data, idToken) {
  const url = docId
    ? `${FIRESTORE_BASE}/${collectionPath}?documentId=${encodeURIComponent(docId)}`
    : `${FIRESTORE_BASE}/${collectionPath}`;
  return req(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: fields(data) }),
  });
}

async function uploadPhoto(uid, idToken, pngBuffer) {
  const fname = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const objectPath = `memories/${uid}/${fname}`;
  const url = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${idToken}` },
    body: pngBuffer,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`사진 업로드 실패: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  const token = (body.downloadTokens || '').split(',')[0];
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

// ── 페르소나 & 버킷 소재 ────────────────────────────────────────────────
const PERSONAS = [
  { email: 'persona01@wishcat.test', name: '김민서', bio: '떠날 수 있을 때 떠나자 ✈️', bias: '여행' },
  { email: 'persona02@wishcat.test', name: '이도윤', bio: '몸이 자산이다 💪', bias: '액티비티' },
  { email: 'persona03@wishcat.test', name: '박서연', bio: '디저트는 배가 따로 있어요 🍰', bias: '음식' },
  { email: 'persona04@wishcat.test', name: '최지훈', bio: '주말엔 산으로 갑니다 ⛺', bias: '자연' },
  { email: 'persona05@wishcat.test', name: '정하은', bio: '책 속에 다 있다 📚', bias: '성장' },
  { email: 'persona06@wishcat.test', name: '강태민', bio: '언젠가 내 앨범을 🎸', bias: '취미' },
  { email: 'persona07@wishcat.test', name: '윤소율', bio: '순간을 담는 사람 📷', bias: '취미' },
  { email: 'persona08@wishcat.test', name: '한지우', bio: '우리 콩이랑 못해본 거 다 하기 🐶', bias: '관계' },
  { email: 'persona09@wishcat.test', name: '오세훈', bio: '레시피 없이도 요리하기 🍳', bias: '음식' },
  { email: 'persona10@wishcat.test', name: '서지안', bio: '무서운 거 다 해볼래요 🪂', bias: '도전' },
];

const POOL = [
  { title: '오로라 보러 아이슬란드 가기', emoji: '🌌', categories: ['여행'], location: { name: '아이슬란드', region: 'overseas' } },
  { title: '유럽 배낭여행 한 달', emoji: '🎒', categories: ['여행'] },
  { title: '국내 100대 명산 완등', emoji: '⛰️', categories: ['여행', '자연'] },
  { title: '부산 해운대에서 일출 보기', emoji: '🌅', categories: ['여행'], location: { name: '부산', region: 'domestic' } },
  { title: '제주 한 달 살기', emoji: '🌴', categories: ['여행'], location: { name: '제주', region: 'domestic' } },
  { title: '시베리아 횡단열차 타보기', emoji: '🚂', categories: ['여행'] },
  { title: '산티아고 순례길 완주', emoji: '🥾', categories: ['여행', '도전'] },
  { title: '몰디브에서 스노클링', emoji: '🐠', categories: ['여행', '액티비티'], location: { name: '몰디브', region: 'overseas' } },
  { title: '교토 벚꽃 시즌 여행', emoji: '🌸', categories: ['여행'], location: { name: '교토', region: 'overseas' } },
  { title: '뉴욕 타임스퀘어 가보기', emoji: '🗽', categories: ['여행'], location: { name: '뉴욕', region: 'overseas' } },
  { title: '국내 섬 10곳 도장깨기', emoji: '🏝️', categories: ['여행'] },
  { title: '마라톤 풀코스 완주', emoji: '🏃', categories: ['액티비티', '도전'] },
  { title: '서핑 배우기', emoji: '🏄', categories: ['액티비티'] },
  { title: '스카이다이빙 해보기', emoji: '🪂', categories: ['액티비티', '도전'] },
  { title: '볼링 200점 넘기기', emoji: '🎳', categories: ['액티비티'] },
  { title: '클라이밍 완등하기', emoji: '🧗', categories: ['액티비티'] },
  { title: '한강 자전거 종주', emoji: '🚴', categories: ['액티비티'] },
  { title: '스쿠버다이빙 자격증 따기', emoji: '🤿', categories: ['액티비티'] },
  { title: '스노보드 배우기', emoji: '🏂', categories: ['액티비티'] },
  { title: '철인 3종 완주', emoji: '🏊', categories: ['액티비티', '도전'] },
  { title: '패러글라이딩 해보기', emoji: '🪁', categories: ['액티비티', '도전'] },
  { title: '기타 한 곡 완주하기', emoji: '🎸', categories: ['취미', '성장'] },
  { title: '필름카메라로 사진집 만들기', emoji: '📷', categories: ['취미'] },
  { title: '도자기 공방 다니기', emoji: '🏺', categories: ['취미'] },
  { title: '뜨개질로 목도리 완성', emoji: '🧶', categories: ['취미'] },
  { title: '캘리그라피 배우기', emoji: '✍️', categories: ['취미'] },
  { title: '보드게임 카페 마스터하기', emoji: '🎲', categories: ['취미', '관계'] },
  { title: '홈베이킹 마스터', emoji: '🧁', categories: ['취미', '음식'] },
  { title: '우쿨렐레 배우기', emoji: '🎶', categories: ['취미'] },
  { title: '그림일기 100일 채우기', emoji: '🎨', categories: ['취미', '성장'] },
  { title: '방탈출 20곳 클리어', emoji: '🔐', categories: ['취미', '관계'] },
  { title: '미쉐린 레스토랑 가보기', emoji: '🍽️', categories: ['음식'] },
  { title: '전국 맛집 도장깨기', emoji: '🍜', categories: ['음식'] },
  { title: '직접 담근 김치 만들기', emoji: '🥬', categories: ['음식'] },
  { title: '홈파티 요리 완벽하게 하기', emoji: '🍳', categories: ['음식', '관계'] },
  { title: '라멘 투어', emoji: '🍥', categories: ['음식', '여행'], location: { name: '오사카', region: 'overseas' } },
  { title: '커피 원두 로스팅 배우기', emoji: '☕', categories: ['음식', '취미'] },
  { title: '와인 소믈리에 클래스 듣기', emoji: '🍷', categories: ['음식', '성장'] },
  { title: '디저트 카페 30곳 가보기', emoji: '🍰', categories: ['음식'] },
  { title: '채식 한 달 도전', emoji: '🥗', categories: ['음식', '도전'] },
  { title: '전통주 만들어보기', emoji: '🍶', categories: ['음식'] },
  { title: '부모님과 해외여행 가기', emoji: '👨‍👩‍👧', categories: ['관계', '여행'] },
  { title: '친구들과 우정여행 떠나기', emoji: '👯', categories: ['관계', '여행'] },
  { title: '손편지 10통 쓰기', emoji: '💌', categories: ['관계'] },
  { title: '오랜 친구에게 서프라이즈 해주기', emoji: '🎁', categories: ['관계'] },
  { title: '가족사진 스튜디오에서 찍기', emoji: '📸', categories: ['관계'] },
  { title: '반려견과 여행 가기', emoji: '🐶', categories: ['관계', '여행'] },
  { title: '첫사랑에게 고맙다고 말하기', emoji: '💭', categories: ['관계'] },
  { title: '매달 부모님께 안부 전화하기', emoji: '☎️', categories: ['관계', '성장'] },
  { title: '소중한 사람 결혼식 축가 불러주기', emoji: '🎤', categories: ['관계'] },
  { title: '오랜 짝사랑 고백해보기', emoji: '💘', categories: ['관계', '도전'] },
  { title: '별똥별 보기', emoji: '🌠', categories: ['자연'] },
  { title: '캠핑카로 전국일주', emoji: '🚐', categories: ['자연', '여행'] },
  { title: '반딧불이 보러 가기', emoji: '✨', categories: ['자연'] },
  { title: '첫눈 오는 날 산책하기', emoji: '❄️', categories: ['자연'] },
  { title: '텃밭 가꾸기', emoji: '🌱', categories: ['자연', '성장'] },
  { title: '고래 보러 가기', emoji: '🐋', categories: ['자연', '여행'] },
  { title: '단풍놀이 명소 다 가보기', emoji: '🍁', categories: ['자연', '여행'] },
  { title: '국립공원 야영하기', emoji: '⛺', categories: ['자연', '액티비티'] },
  { title: '은하수 사진 찍기', emoji: '🌌', categories: ['자연', '취미'] },
  { title: '새벽 산 정상에서 일출 보기', emoji: '🌄', categories: ['자연', '도전'] },
  { title: '토익 900점 넘기기', emoji: '📖', categories: ['성장'] },
  { title: '자격증 3개 따기', emoji: '🎓', categories: ['성장'] },
  { title: '매일 아침 6시 기상 100일', emoji: '⏰', categories: ['성장'] },
  { title: '책 50권 읽기', emoji: '📚', categories: ['성장'] },
  { title: '일본어 배우기', emoji: '🗣️', categories: ['성장'] },
  { title: '재테크 공부해서 첫 투자하기', emoji: '💰', categories: ['성장'] },
  { title: '명상 습관 만들기', emoji: '🧘', categories: ['성장'] },
  { title: '블로그 1년 꾸준히 쓰기', emoji: '✍️', categories: ['성장', '취미'] },
  { title: '부업으로 첫 수익 만들기', emoji: '💻', categories: ['성장', '도전'] },
  { title: '목표 체중 달성하기', emoji: '⚖️', categories: ['성장', '액티비티'] },
  { title: '번지점프 뛰기', emoji: '🪂', categories: ['도전'] },
  { title: '나 홀로 해외여행 가기', emoji: '✈️', categories: ['도전', '여행'] },
  { title: '대중 앞에서 스피치하기', emoji: '🎤', categories: ['도전', '성장'] },
  { title: '물구나무서기 성공하기', emoji: '🤸', categories: ['도전', '액티비티'] },
  { title: '낯선 도시 당일치기 여행', emoji: '🗺️', categories: ['도전', '여행'] },
  { title: '유튜브 채널 개설하기', emoji: '🎬', categories: ['도전', '취미'] },
  { title: '매운 음식 챌린지 클리어', emoji: '🌶️', categories: ['도전', '음식'] },
  { title: '오디션 프로그램 도전하기', emoji: '🎙️', categories: ['도전'] },
  { title: '헌혈 10회 채우기', emoji: '🩸', categories: ['도전', '성장'] },
];

const NOTES = ['언젠가 꼭', '버킷리스트 1순위', '올해 안에는 꼭', '친구랑 같이 하고 싶어', '조금씩 준비 중', ''];
const MEMORY_LINES = ['드디어 해냈다!', '생각보다 훨씬 좋았어요', '다음에 또 하고 싶어요', '정말 뿌듯한 순간이었어요', '오래 기억에 남을 것 같아요', '눈물 날 뻔했어요'];
const PHOTO_COLORS = [[113, 120, 229], [252, 157, 142], [255, 123, 166], [253, 197, 79], [150, 166, 238], [253, 217, 138]];

function rnd(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rnd(arr.length)]; }
function pastDate(maxDaysAgo) {
  const d = new Date(Date.now() - rnd(maxDaysAgo) * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '.');
}
function futureDate(maxDaysAhead) {
  const d = new Date(Date.now() + (10 + rnd(maxDaysAhead)) * 86400000);
  return d.toISOString().slice(0, 10);
}
function pastTimestamp(maxDaysAgo) {
  return new Date(Date.now() - rnd(maxDaysAgo) * 86400000).toISOString();
}

// 편향 카테고리를 65% 확률로, 아니면 전체 풀에서 뽑아 페르소나마다 자연스러운 편중을 만듭니다.
function pickItemsFor(bias, count) {
  const biased = POOL.filter((p) => p.categories.includes(bias));
  const chosen = [];
  const usedTitles = new Set();
  let guard = 0;
  while (chosen.length < count && guard < count * 20) {
    guard++;
    const useBias = Math.random() < 0.65 && biased.length > 0;
    const cand = useBias ? pick(biased) : pick(POOL);
    if (usedTitles.has(cand.title)) continue;
    usedTitles.add(cand.title);
    chosen.push(cand);
  }
  return chosen;
}

async function seedPersona(persona, idx) {
  console.log(`\n[${idx + 1}/10] ${persona.name} (${persona.email}) 계정 생성 중...`);
  const { uid, idToken } = await signUp(persona.email, SEED_PASSWORD);

  await createDoc('users', uid, {
    name: persona.name, bio: persona.bio, listPublic: true, createdAt: pastTimestamp(300),
  }, idToken);

  const count = 5 + rnd(26); // 5~30
  const items = pickItemsFor(persona.bias, count);
  console.log(`  버킷 ${items.length}개 작성 중...`);

  let doneCount = 0, photoCount = 0;
  for (const it of items) {
    const isDone = Math.random() < 0.4;
    const hasPriority = Math.random() < 0.5;
    const hasTargetDate = !isDone && Math.random() < 0.3;
    const note = pick(NOTES);

    let memory = null;
    if (isDone) {
      doneCount++;
      let photo = null;
      if (Math.random() < 0.4) {
        try {
          const png = makeSolidPng(600, pick(PHOTO_COLORS));
          photo = await uploadPhoto(uid, idToken, png);
          photoCount++;
        } catch (e) {
          console.warn(`  (사진 업로드 실패, 사진 없이 진행: ${e.message.slice(0, 120)})`);
        }
      }
      memory = { photo, text: pick(MEMORY_LINES), date: pastDate(180) };
    }

    const data = {
      ownerId: uid, title: it.title, emoji: it.emoji, note,
      categories: it.categories, location: it.location || null,
      targetDate: hasTargetDate ? futureDate(300) : null,
      priority: hasPriority ? pick(['high', 'mid', 'low']) : null,
      order: 0, ownerPublic: true,
      done: isDone, memory,
      participants: [], origin: 'own', helpedBy: [],
      likesCount: rnd(20), savesCount: rnd(6),
      createdAt: pastTimestamp(250),
    };
    await createDoc('items', undefined, data, idToken);
  }

  console.log(`  완료 — 이룬 꿈 ${doneCount}개(사진 ${photoCount}장 포함), 도전 중 ${items.length - doneCount}개`);
  return { uid, email: persona.email, name: persona.name, itemCount: items.length, doneCount, photoCount };
}

async function main() {
  console.log(`프로젝트: ${PROJECT_ID} / DB: ${DATABASE_ID}`);
  const results = [];
  for (let i = 0; i < PERSONAS.length; i++) {
    try {
      const r = await seedPersona(PERSONAS[i], i);
      results.push(r);
    } catch (e) {
      console.error(`  ✗ ${PERSONAS[i].name} 실패: ${e.message.slice(0, 300)}`);
    }
  }

  const outPath = path.join(__dirname, '.seed-output.json');
  fs.writeFileSync(outPath, JSON.stringify({ password: SEED_PASSWORD, personas: results }, null, 2));

  const totalItems = results.reduce((s, r) => s + r.itemCount, 0);
  const totalDone = results.reduce((s, r) => s + r.doneCount, 0);
  const totalPhotos = results.reduce((s, r) => s + r.photoCount, 0);
  console.log(`\n===== 완료 =====`);
  console.log(`계정 ${results.length}/10 · 버킷 ${totalItems}개 (이룬 꿈 ${totalDone}, 사진 ${totalPhotos}) · 결과: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
