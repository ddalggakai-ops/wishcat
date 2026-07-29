// Firebase Auth / Firestore REST 응답을 흉내내서(mock) "로그인 이후 화면"까지 실제로 렌더되는지 검증합니다.
// 이 샌드박스는 Firebase에 네트워크로 닿을 수 없어서, 대신 SDK가 실제로 보내는 REST 요청을 가로채
// 진짜 서버와 같은 모양의 JSON을 돌려줍니다. => lite(REST) SDK의 요청/응답 처리와 화면 렌더를 함께 검증.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const PROJECT = 'wishcat-945d4';
const NOW = 1753000000; // 고정값 (Date.now 대신)

function b64url(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const JWT = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: UID,
    user_id: UID,
    email: EMAIL,
    email_verified: true,
    iat: NOW,
    exp: NOW + 3600,
    auth_time: NOW,
    firebase: { identities: { email: [EMAIL] }, sign_in_provider: 'password' },
  }),
  'sig',
].join('.');

const TS = '2026-07-01T00:00:00.000000Z';
// 앱은 이름 있는 데이터베이스("wishcat")를 쓰도록 설정돼 있습니다.
// SDK가 정말 그 데이터베이스로 요청을 보내는지도 함께 확인합니다.
const DATABASE_ID = 'wishcat';
const docPath = (p) => `projects/${PROJECT}/databases/${DATABASE_ID}/documents/${p}`;

const USER_DOC = {
  name: docPath(`users/${UID}`),
  fields: {
    name: { stringValue: '검증이' },
    bio: { stringValue: '오늘도 꿈을 하나씩 채우는 중' },
    listPublic: { booleanValue: true },
    createdAt: { timestampValue: TS },
  },
  createTime: TS,
  updateTime: TS,
};

const ITEM_DOC = {
  name: docPath('items/item-verify-1'),
  fields: {
    ownerId: { stringValue: UID },
    title: { stringValue: '오로라 보기' },
    emoji: { stringValue: '🌌' },
    note: { stringValue: '아이슬란드에서' },
    category: { nullValue: null },
    location: {
      mapValue: { fields: { name: { stringValue: '아이슬란드' }, region: { stringValue: 'overseas' } } },
    },
    done: { booleanValue: false },
    memory: { nullValue: null },
    participants: { arrayValue: {} },
    origin: { stringValue: 'own' },
    helpedBy: { arrayValue: {} },
    likesCount: { integerValue: '3' },
    savesCount: { integerValue: '0' },
    createdAt: { timestampValue: TS },
  },
  createTime: TS,
  updateTime: TS,
};

// 검색/필터/스크롤 검증용 — 카테고리가 겹치는 항목을 섞어서 12개를 만듭니다.
const MANY_ITEMS_SPEC = [
  { id: 'i1', title: '오로라 보기', emoji: '🌌', category: '여행', done: false },
  { id: 'i2', title: '한강 러닝 완주', emoji: '🏃', category: '액티비티', done: false },
  { id: 'i3', title: '책 50권 읽기', emoji: '📚', category: '성장', done: false },
  { id: 'i4', title: '요가 마스터하기', emoji: '🧘', category: '취미', done: false },
  { id: 'i5', title: '파스타 만들기', emoji: '🍝', category: '음식', done: false },
  { id: 'i6', title: '부모님과 여행가기', emoji: '👨‍👩‍👧', category: '관계', done: false },
  { id: 'i7', title: '북한산 등반', emoji: '⛰️', category: '자연', done: false },
  { id: 'i8', title: '번지점프 도전', emoji: '🪂', category: '도전', done: false },
  { id: 'i9', title: '제주도 한 달 살기', emoji: '🏝️', category: '여행', done: true },
  { id: 'i10', title: '마라톤 완주', emoji: '🏅', category: '액티비티', done: true },
  { id: 'i11', title: '유럽 배낭여행', emoji: '🎒', category: '여행', done: false },
  { id: 'i12', title: '스카이다이빙', emoji: '🪂', category: '도전', done: false },
];
function makeItemDoc(spec) {
  return {
    name: docPath(`items/${spec.id}`),
    fields: {
      ownerId: { stringValue: UID },
      title: { stringValue: spec.title },
      emoji: { stringValue: spec.emoji },
      note: { stringValue: '' },
      category: { stringValue: spec.category },
      location: { nullValue: null },
      done: { booleanValue: spec.done },
      memory: { nullValue: null },
      participants: { arrayValue: {} },
      origin: { stringValue: 'own' },
      helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '0' },
      savesCount: { integerValue: '0' },
      createdAt: { timestampValue: TS },
    },
    createTime: TS,
    updateTime: TS,
  };
}
const MANY_ITEM_DOCS = MANY_ITEMS_SPEC.map(makeItemDoc);

const seen = [];

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function handleIdentity(route) {
  const url = route.request().url();
  seen.push(`AUTH ${url.split('?')[0].split('/').pop()}`);
  if (url.includes('accounts:signUp')) {
    return json(route, {
      kind: 'identitytoolkit#SignupNewUserResponse',
      localId: UID,
      email: EMAIL,
      idToken: JWT,
      refreshToken: 'fake-refresh-token',
      expiresIn: '3600',
    });
  }
  if (url.includes('accounts:signInWithPassword')) {
    return json(route, {
      kind: 'identitytoolkit#VerifyPasswordResponse',
      localId: UID,
      email: EMAIL,
      displayName: '',
      idToken: JWT,
      registered: true,
      refreshToken: 'fake-refresh-token',
      expiresIn: '3600',
    });
  }
  if (url.includes('accounts:lookup')) {
    return json(route, {
      kind: 'identitytoolkit#GetAccountInfoResponse',
      users: [
        {
          localId: UID,
          email: EMAIL,
          emailVerified: true,
          displayName: '',
          providerUserInfo: [{ providerId: 'password', federatedId: EMAIL, email: EMAIL, rawId: EMAIL }],
          validSince: '0',
          lastLoginAt: String(NOW * 1000),
          createdAt: String(NOW * 1000),
        },
      ],
    });
  }
  return json(route, { error: { code: 400, message: 'UNEXPECTED_ENDPOINT', status: 'INVALID_ARGUMENT' } }, 400);
}

async function handleToken(route) {
  seen.push('AUTH securetoken');
  return json(route, {
    access_token: JWT,
    expires_in: '3600',
    token_type: 'Bearer',
    refresh_token: 'fake-refresh-token',
    id_token: JWT,
    user_id: UID,
    project_id: PROJECT,
  });
}

let FS_MODE = 'ok'; // 'ok' | 'denied' | 'nodb'

async function handleFirestore(route) {
  const url = route.request().url();
  if (FS_MODE === 'nodb') {
    // 사용자가 실제로 겪은 상황: 해당 이름의 데이터베이스가 프로젝트에 없음
    seen.push('FS 404 database-not-found');
    return json(
      route,
      {
        error: {
          code: 404,
          message: `The database (${DATABASE_ID}) does not exist for project ${PROJECT} Please visit https://console.cloud.google.com/datastore/setup?project=${PROJECT} to add a Cloud Datastore or Cloud Firestore database.`,
          status: 'NOT_FOUND',
        },
      },
      404
    );
  }
  if (FS_MODE === 'denied') {
    seen.push('FS 403 permission-denied');
    return json(
      route,
      { error: { code: 403, message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } },
      403
    );
  }
  if (url.includes(`/databases/${DATABASE_ID}/`)) seen.push('FS →wishcat DB');
  else seen.push(`FS →WRONG DB ${url.split('/databases/')[1]?.split('/')[0]}`);

  let body = {};
  try {
    body = JSON.parse(route.request().postData() || '{}');
  } catch {}

  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    seen.push(`FS batchGet ${docs.map((d) => d.split('/documents/')[1]).join(',')}`);
    const out = docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS };
      if (p.startsWith('users/')) {
        return {
          found: { ...USER_DOC, name: full, fields: { ...USER_DOC.fields, name: { stringValue: '친구' } } },
          readTime: TS,
        };
      }
      if (p === 'items/item-verify-1') return { found: ITEM_DOC, readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }

  if (url.includes(':runQuery')) {
    const col = body?.structuredQuery?.from?.[0]?.collectionId;
    seen.push(`FS runQuery ${col}`);
    if (col === 'items') {
      const docs = FS_MODE === 'many' ? MANY_ITEM_DOCS : [ITEM_DOC];
      return json(route, docs.map((document) => ({ document, readTime: TS })));
    }
    return json(route, [{ readTime: TS }]);
  }

  if (url.includes(':commit')) {
    seen.push('FS commit');
    return json(route, { writeResults: [{ updateTime: TS }], commitTime: TS });
  }

  seen.push(`FS ??? ${url}`);
  return json(route, {}, 200);
}


async function scenario(browser, label, fsMode, how) {
  FS_MODE = fsMode;
  seen.length = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.route('**identitytoolkit.googleapis.com/**', handleIdentity);
  await page.route('**securetoken.googleapis.com/**', handleToken);
  await page.route('**firestore.googleapis.com/**', handleFirestore);

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await how(page);
  await page.waitForTimeout(9000);

  // body 전체를 봅니다 — Modal(Sheet)은 #root 밖(body 바로 아래)으로 포털되기 때문에,
  // #root만 보면 열려 있는 시트의 내용을 놓칩니다.
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  const nodes = await page.evaluate(() => document.body.querySelectorAll('*').length);
  await page.screenshot({ path: `verify/${label.slice(0, 2)}-shot.png` });
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));

  console.log(`\n===== ${label} =====`);
  console.log(`DOM 노드 수: ${nodes}`);
  console.log(`화면 텍스트: ${JSON.stringify(text).slice(0, 800)}`);
  console.log(`SDK 요청: ${seen.join(' | ')}`);
  console.log(`콘솔 오류 ${bad.length}건${bad.length ? ': ' + bad.slice(0, 4).join(' || ').slice(0, 400) : ''}`);
  await ctx.close();
  return { text, nodes, errors: bad, seen: [...seen] };
}

const loginAs = async (page) => {
  const inputs = page.locator('input');
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill('password123');
  await page.waitForTimeout(300);
  await page.getByText('로그인', { exact: true }).last().click();
};

const openBulkImportAs = async (page) => {
  await loginAs(page);
  await page.waitForTimeout(500);
  // 엑셀로 추가 버튼은 "새로운 꿈" 추가 시트 안으로 옮겨졌어요 — 먼저 + 버튼으로 시트를 엽니다.
  await page.locator('[aria-label="새 꿈 추가"]').first().click();
  await page.waitForTimeout(500);
  await page.getByText('엑셀로 여러 개 한 번에 추가', { exact: false }).first().click();
};

const probe = {};

const searchFilterScrollAs = async (page) => {
  await loginAs(page);
  await page.waitForTimeout(600);

  // 스크롤: 목록 컨테이너가 뷰포트에 갇혀 있고(overflow-y), 내용이 넘쳐서 실제로 스크롤 가능한지 확인.
  // 참고: ScrollView에 style={{flex:1}}을 빼도 react-native-web에서는 기본 CSS 때문에 이 값이 똑같이 나옵니다
  // (RNW가 알아서 flex 처리를 해줌). 그래서 이 체크는 "웹에서도 스크롤이 되는지"의 회귀 방지용일 뿐,
  // 실제 안드로이드 네이티브에서 ScrollView가 style 없이 넘치는 버그(Yoga는 RNW처럼 기본값을 안 줌)를
  // 재현/검증하지는 못합니다. style={{flex:1}}은 네이티브 RN의 표준 권장 수정이라 코드에는 유지합니다.
  probe.scroll = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div'));
    let best = null;
    for (const el of all) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20) {
        if (!best || el.scrollHeight > best.scrollHeight) best = { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
      }
    }
    return best;
  });

  // 검색: 제목이 하나뿐인 검색어로 좁혀지는지 확인
  const search = page.locator('input[placeholder="제목 · 메모 · 장소로 검색"]');
  await search.fill('스카이다이빙');
  await page.waitForTimeout(500);
  probe.searchText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  await search.fill('');
  await page.waitForTimeout(300);

  // 카테고리 필터: "여행" 칩을 누르면 여행 카테고리만 남는지 확인 (칩은 목록보다 먼저 렌더되므로 first()가 칩)
  await page.getByText('여행', { exact: true }).first().click();
  await page.waitForTimeout(500);
  probe.filterText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
};

const openProfilePhotoPickerAs = async (page) => {
  await loginAs(page);
  await page.waitForTimeout(500);
  await page.getByText('프로필 편집', { exact: false }).first().click();
};

const registerAs = async (page) => {
  await page.getByText('계정이 없어요 · 회원가입', { exact: false }).first().click();
  await page.waitForTimeout(500);
  const inputs = page.locator('input');
  await inputs.nth(0).fill('검증이');
  await inputs.nth(1).fill(EMAIL);
  await inputs.nth(2).fill('password123');
  await page.waitForTimeout(300);
  await page.getByText('가입하고 시작하기', { exact: false }).first().click();
};

(async () => {
  const browser = await chromium.launch();
  const a = await scenario(browser, '05 로그인 성공 후 홈 화면', 'ok', loginAs);
  const b = await scenario(browser, '06 회원가입 성공 후', 'ok', registerAs);
  const c = await scenario(browser, '07 로그인은 되지만 Firestore 권한 거부(403)', 'denied', loginAs);
  const d = await scenario(browser, '08 데이터베이스가 없는 경우(404)', 'nodb', loginAs);
  const e = await scenario(browser, '09 엑셀로 여러 개 추가 시트 열기', 'ok', openBulkImportAs);
  const f = await scenario(browser, '10 검색/필터/스크롤 (아이템 12개)', 'many', searchFilterScrollAs);
  const g = await scenario(browser, '11 프로필 편집 - 사진 선택 UI', 'ok', openProfilePhotoPickerAs);
  await browser.close();

  console.log('\n\n========== 판정 ==========');
  const checks = [
    ['[로그인] 화면이 렌더된다', a.nodes > 30, `노드 ${a.nodes}`],
    ['[로그인] 로그인 화면에 갇혀있지 않다', !/친구와 함께 지우는 버킷리스트/.test(a.text), ''],
    ['[로그인] 로딩에서 멈추지 않는다', !/준비하고 있어요/.test(a.text), ''],
    ['[로그인] 내 프로필을 REST(batchGet)로 읽었다', a.seen.some((s) => s.includes(`batchGet users/${UID}`)), ''],
    ['[로그인] 아이템을 REST(runQuery)로 읽었다', a.seen.includes('FS runQuery items'), ''],
    ['[로그인] 불러온 아이템이 화면에 보인다', /오로라 보기/.test(a.text), a.text.slice(0, 200)],
    [
      '[로그인] 요청이 "wishcat" 데이터베이스로 나간다',
      a.seen.includes('FS →wishcat DB') && !a.seen.some((s) => s.startsWith('FS →WRONG DB')),
      a.seen.filter((s) => s.startsWith('FS →')).join(' | '),
    ],
    ['[로그인] 콘솔 치명적 오류 없음', a.errors.length === 0, a.errors.join(' | ').slice(0, 200)],

    // 아이콘/테두리를 정리한 뒤로 이 화면의 DOM 노드 수가 자연스럽게 줄었어요(장식용 별 스티커 제거 등) —
    // 완전히 빈 화면(수 노드 이하)과 구분되는 정도로 기준을 낮췄습니다.
    ['[가입] 프로그레스바에서 멈추지 않는다', !/준비하고 있어요/.test(b.text) && b.nodes > 15, `노드 ${b.nodes}`],
    ['[가입] users 문서를 새로 만든다(commit)', b.seen.includes('FS commit'), b.seen.join(' | ')],
    ['[가입] 가입 직후 온보딩/홈으로 넘어간다', !/회원가입 이름 이메일 비밀번호/.test(b.text), b.text.slice(0, 200)],
    ['[가입] 콘솔 치명적 오류 없음', b.errors.length === 0, b.errors.join(' | ').slice(0, 200)],

    ['[403] 빈 화면이 아니다', c.nodes > 15, `노드 ${c.nodes}`],
    ['[403] 로딩에서 멈추지 않는다', !/준비하고 있어요/.test(c.text), ''],
    [
      '[403] 원인을 보여주는 오류 화면이 뜬다',
      /서버에 연결하지 못했어요|권한|permission/i.test(c.text),
      c.text.slice(0, 300),
    ],
    ['[403] 다시 시도 버튼이 있다', /다시 시도/.test(c.text), ''],

    ['[DB없음] 빈 화면이 아니고 로딩에서 안 멈춘다', d.nodes > 15 && !/준비하고 있어요/.test(d.text), `노드 ${d.nodes}`],
    [
      '[DB없음] "데이터베이스가 아직 만들어지지 않았어요" 안내가 뜬다',
      /데이터베이스가 아직 만들어지지 않았어요/.test(d.text),
      d.text.slice(0, 300),
    ],
    ['[DB없음] 다시 시도 버튼이 있다', /다시 시도/.test(d.text), ''],

    ['[엑셀] 시트가 열리고 빈 화면이 아니다', e.nodes > 30, `노드 ${e.nodes}`],
    ['[엑셀] 시트 제목이 보인다', /엑셀로 여러 개 추가/.test(e.text), ''],
    ['[엑셀] 형식 안내(헤더 예시)가 보인다', /제목.*이모지.*메모.*카테고리.*장소/s.test(e.text.replace(/\s+/g, '')), e.text.slice(0, 200)],
    ['[엑셀] 파일 선택 버튼이 있다', /엑셀\/CSV 파일 선택/.test(e.text), ''],
    ['[엑셀] 콘솔 치명적 오류 없음', e.errors.length === 0, e.errors.join(' | ').slice(0, 200)],

    [
      '[스크롤] (웹 기준) 목록이 뷰포트 안에 갇혀 있고 내용이 넘쳐서 스크롤 가능하다',
      !!probe.scroll && probe.scroll.scrollHeight > probe.scroll.clientHeight,
      probe.scroll ? `scrollHeight=${probe.scroll.scrollHeight} clientHeight=${probe.scroll.clientHeight}` : '스크롤 가능한 컨테이너를 못 찾음',
    ],
    [
      '[검색] "스카이다이빙" 검색 시 그 항목만 남는다',
      /스카이다이빙/.test(probe.searchText) && !/오로라 보기/.test(probe.searchText) && !/한강 러닝/.test(probe.searchText),
      probe.searchText.slice(0, 300),
    ],
    [
      '[검색] 검색 결과 없을 때는 검색 결과 없음 문구가 아니라(값이 있으므로) 정상 목록',
      !/검색 결과가 없어요/.test(probe.searchText),
      '',
    ],
    [
      '[필터] "여행" 카테고리 칩을 누르면 여행 항목만 남는다',
      /오로라 보기/.test(probe.filterText) && /제주도 한 달 살기/.test(probe.filterText) && !/한강 러닝/.test(probe.filterText) && !/스카이다이빙/.test(probe.filterText),
      probe.filterText.slice(0, 400),
    ],
    ['[검색/필터] 콘솔 치명적 오류 없음', f.errors.length === 0, f.errors.join(' | ').slice(0, 200)],

    ['[프로필사진] 시트가 열리고 빈 화면이 아니다', g.nodes > 30, `노드 ${g.nodes}`],
    ['[프로필사진] "사진 추가하기" 버튼이 보인다', /사진 추가하기/.test(g.text), g.text.slice(0, 200)],
    ['[프로필사진] 콘솔 치명적 오류 없음', g.errors.length === 0, g.errors.join(' | ').slice(0, 200)],
  ];
  for (const [n, p, d] of checks) console.log(`${p ? 'PASS' : 'FAIL'} — ${n}${d ? `  ⟨${d}⟩` : ''}`);
  const failed = checks.filter((x) => !x[1]).length;
  console.log(`\n${checks.length - failed}/${checks.length} 통과`);
  process.exit(failed ? 1 : 0);
})();
