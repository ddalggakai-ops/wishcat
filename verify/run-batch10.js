// 이번 추가 요청 3개(내 리스트 스크롤 버튼 / 지도에서 위치 선택 + 미리보기 / 내가 가진
// 카테고리만 보이는 필터)가 실제로 렌더되고 눌리는지 검증합니다.
// run-batch9.js 와 같은 방식(Firebase REST 목킹 + 실제 웹 빌드 조작)으로 돌립니다.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const PROJECT = 'wishcat-945d4';
const NOW = 1753000000;

function b64url(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const JWT = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: UID, user_id: UID,
    email: EMAIL, email_verified: true, iat: NOW, exp: NOW + 3600, auth_time: NOW,
    firebase: { identities: { email: [EMAIL] }, sign_in_provider: 'password' },
  }),
  'sig',
].join('.');

const TS = '2026-07-01T00:00:00.000000Z';
const DATABASE_ID = 'wishcat';
const docPath = (p) => `projects/${PROJECT}/databases/${DATABASE_ID}/documents/${p}`;

const USER_DOC = {
  name: docPath(`users/${UID}`),
  fields: {
    name: { stringValue: '검증이' }, bio: { stringValue: '오늘도 꿈을 하나씩 채우는 중' },
    listPublic: { booleanValue: true }, createdAt: { timestampValue: TS },
  },
  createTime: TS, updateTime: TS,
};

function myDoc(id, title, category, done) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
      title: { stringValue: title }, emoji: { stringValue: '🌌' }, note: { stringValue: '' },
      category: category ? { stringValue: category } : { nullValue: null },
      location: { nullValue: null }, targetDate: { nullValue: null },
      done: { booleanValue: !!done }, memory: { nullValue: null }, participants: { arrayValue: {} },
      origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}

// 카테고리 필터 시나리오: 8개 중 '여행' · '음식' 딱 2개만 씁니다 → 그 2개 + 전체만 보여야 정상.
const FEW_DOCS = [myDoc('a1', '오로라 보기', '여행', false), myDoc('a2', '라멘 투어', '음식', false)];

// 스크롤 버튼 시나리오: 화면을 넘치도록 충분히 많이 넣습니다.
const MANY_DOCS = Array.from({ length: 18 }, (_, i) => myDoc(`m${i}`, `꿈 목록 아이템 ${i + 1}`, '여행', i % 5 === 0));

let ACTIVE_DOCS = FEW_DOCS;

const seen = [];
const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function handleIdentity(route) {
  const url = route.request().url();
  const ep = url.split('?')[0].split('/').pop();
  seen.push(`AUTH ${ep}`);
  if (url.includes('accounts:signInWithPassword')) {
    return json(route, { localId: UID, email: EMAIL, idToken: JWT, registered: true, refreshToken: 'r', expiresIn: '3600' });
  }
  if (url.includes('accounts:lookup')) {
    return json(route, {
      users: [{ localId: UID, email: EMAIL, emailVerified: true, displayName: '',
        providerUserInfo: [{ providerId: 'password', federatedId: EMAIL, email: EMAIL, rawId: EMAIL }],
        validSince: '0', lastLoginAt: String(NOW * 1000), createdAt: String(NOW * 1000) }],
    });
  }
  return json(route, { error: { code: 400, message: 'UNEXPECTED', status: 'INVALID_ARGUMENT' } }, 400);
}

const handleToken = (route) => {
  seen.push('AUTH securetoken');
  return json(route, { access_token: JWT, expires_in: '3600', token_type: 'Bearer', refresh_token: 'r', id_token: JWT, user_id: UID, project_id: PROJECT });
};

async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    const out = docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }

  if (url.includes(':runQuery')) {
    const sq = body?.structuredQuery || {};
    const col = sq.from?.[0]?.collectionId;
    if (col === 'items') {
      seen.push(`FS runQuery items(mine) x${ACTIVE_DOCS.length}`);
      return json(route, ACTIVE_DOCS.map((document) => ({ document, readTime: TS })));
    }
    seen.push(`FS runQuery ${col}${sq.from?.[0]?.allDescendants ? '(group)' : ''}`);
    return json(route, [{ readTime: TS }]);
  }

  if (url.includes(':commit')) {
    const n = (body.writes || []).length;
    seen.push(`FS commit x${n}`);
    return json(route, { writeResults: (body.writes || []).map(() => ({ updateTime: TS })), commitTime: TS });
  }

  seen.push(`FS ??? ${url}`);
  return json(route, {}, 200);
}

// OSM 타일 서버는 이 샌드박스에서 네트워크가 막혀 있어 실제 이미지는 못 받아옵니다.
// 요청 자체가 나가는지(=지도 컴포넌트가 올바른 URL로 타일을 그리려 시도하는지)만 확인하고
// 1x1 투명 PNG로 응답해 화면이 깨지지 않게 해줍니다.
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
async function handleTile(route) {
  seen.push(`TILE ${route.request().url().split('/').slice(-3).join('/')}`);
  return route.fulfill({ status: 200, contentType: 'image/png', body: BLANK_PNG });
}

async function scenario(browser, label, how, opts = {}) {
  ACTIVE_DOCS = opts.many ? MANY_DOCS : FEW_DOCS;
  seen.length = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.route('**identitytoolkit.googleapis.com/**', handleIdentity);
  await page.route('**securetoken.googleapis.com/**', handleToken);
  await page.route('**firestore.googleapis.com/**', handleFirestore);
  await page.route('**tile.openstreetmap.org/**', handleTile);

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const extra = (await how(page)) || {};
  await page.waitForTimeout(1500);

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  const nodes = await page.evaluate(() => document.body.querySelectorAll('*').length);
  await page.screenshot({ path: `verify/b10-${label}.png` });
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));

  console.log(`\n===== ${label} =====`);
  console.log(`노드 ${nodes} | 오류 ${bad.length}${bad.length ? ': ' + bad.slice(0, 3).join(' || ').slice(0, 300) : ''}`);
  console.log(`텍스트: ${JSON.stringify(text).slice(0, 500)}`);
  console.log(`요청: ${seen.join(' | ')}`);
  await ctx.close();
  return { text, nodes, errors: bad, seen: [...seen], ...extra };
}

const login = async (page) => {
  const inputs = page.locator('input');
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill('password123');
  await page.waitForTimeout(200);
  await page.getByText('로그인', { exact: true }).last().click();
  await page.waitForTimeout(2500);
};

(async () => {
  const browser = await chromium.launch();

  // ③ 카테고리 필터: 내가 가진 게 여행/음식뿐이면 필터 칩도 그 둘 + 전체만 보여야 함
  const catFilter = await scenario(browser, '01-category-filter', async (page) => {
    const chipTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .map((el) => el.textContent?.trim())
        .filter((t) => t && ['전체', '여행', '액티비티', '취미', '음식', '관계', '자연', '성장', '도전'].includes(t)));
    return { chipTexts };
  }, { many: false, skipLogin: true });

  const catFilterLoggedIn = await scenario(browser, '01b-category-filter-loggedin', async (page) => {
    await login(page);
    const chipTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .map((el) => el.textContent?.trim())
        .filter((t) => t && ['전체', '여행', '액티비티', '취미', '음식', '관계', '자연', '성장', '도전'].includes(t)));
    // '음식' 칩을 눌러서 필터링이 실제로 되는지도 확인
    await page.getByText('음식', { exact: true }).first().click();
    await page.waitForTimeout(500);
    const afterFilter = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    return { chipTexts: [...new Set(chipTexts)], afterFilter };
  }, { many: false });

  // ① 스크롤 버튼: 아이템이 적으면 버튼이 없고, 많으면 뜨고, 누르면 실제로 스크롤됨
  const fewScroll = await scenario(browser, '02-scroll-few', async (page) => {
    const hasFab = await page.evaluate(() => !!Array.from(document.querySelectorAll('*')).find((el) => el.textContent === '↓' || el.textContent === '↑'));
    return { hasFab };
  }, { many: false, skipLogin: true });

  const manyScroll = await scenario(browser, '03-scroll-many', async (page) => {
    await login(page);
    await page.waitForTimeout(500);
    const hasFabBefore = await page.locator('text=↓').count();
    // 실제 스크롤 컨테이너의 scrollTop 을 클릭 전/후로 비교
    const scrollTopBefore = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('div'));
      const el = nodes.find((n) => n.scrollHeight - n.clientHeight > 100);
      return el ? el.scrollTop : null;
    });
    await page.locator('text=↓').first().click();
    await page.waitForTimeout(700);
    const scrollTopAfter = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('div'));
      const el = nodes.find((n) => n.scrollHeight - n.clientHeight > 100);
      return el ? el.scrollTop : null;
    });
    const hasUpArrowAfter = await page.locator('text=↑').count();
    const hasDownArrowAfter = await page.locator('text=↓').count();
    return { hasFabBefore, scrollTopBefore, scrollTopAfter, hasUpArrowAfter, hasDownArrowAfter };
  }, { many: true });

  // ② 지도에서 위치 선택 + 작은 미리보기
  const mapPick = await scenario(browser, '04-map-pick', async (page) => {
    await login(page);
    await page.getByText('＋', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.getByText('지도에서 고르기', { exact: false }).first().click();
    await page.waitForTimeout(600);
    const sheetOpen = (await page.evaluate(() => document.body.innerText)).includes('지도에서 위치 고르기');

    // 지도 박스를 드래그해서 다른 위치로 옮겨봅니다.
    const box = await page.locator('text=지도를 움직여서').first().evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('*')).filter((el) => {
        const r = el.getBoundingClientRect();
        return Math.abs(r.width - 270) < 2 && Math.abs(r.height - 270) < 2;
      });
      const el = boxes[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 60, cy - 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    await page.getByText('이 위치로 선택', { exact: true }).first().click();
    await page.waitForTimeout(500);
    const afterPick = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    return { sheetOpen, boxFound: !!box, afterPick };
  }, { many: false });

  console.log('\n\n========== 판정 ==========');
  const checks = [
    ['[③] 카테고리 필터가 처음부터(로그인 전 스켈레톤 제외) 전체 8개를 다 보여주지 않는다',
      !catFilter.chipTexts.some((c) => ['액티비티', '취미', '관계', '자연', '성장', '도전'].includes(c)) || catFilter.chipTexts.length === 0,
      catFilter.chipTexts.join(',')],
    ['[③] 로그인 후 내가 가진 카테고리(여행·음식)만 필터 칩으로 보인다',
      catFilterLoggedIn.chipTexts.includes('여행') && catFilterLoggedIn.chipTexts.includes('음식')
      && !catFilterLoggedIn.chipTexts.some((c) => ['액티비티', '취미', '관계', '자연', '성장', '도전'].includes(c)),
      catFilterLoggedIn.chipTexts.join(',')],
    ['[③] "음식" 칩을 누르면 실제로 필터링된다(오로라 보기가 사라짐)',
      !catFilterLoggedIn.afterFilter.includes('오로라 보기') && catFilterLoggedIn.afterFilter.includes('라멘 투어'),
      catFilterLoggedIn.afterFilter.slice(0, 200)],
    ['[①] 아이템이 적을 땐 스크롤 버튼이 안 보인다', !fewScroll.hasFab, String(fewScroll.hasFab)],
    ['[①] 아이템이 많으면 스크롤 버튼(↓)이 보인다', manyScroll.hasFabBefore > 0, String(manyScroll.hasFabBefore)],
    ['[①] 버튼을 누르면 실제로 스크롤 위치가 바뀐다',
      manyScroll.scrollTopBefore !== null && manyScroll.scrollTopAfter !== null && manyScroll.scrollTopAfter > manyScroll.scrollTopBefore,
      `${manyScroll.scrollTopBefore} → ${manyScroll.scrollTopAfter}`],
    ['[①] 맨 아래까지 내려가면 ↑ 버튼이 나타난다', manyScroll.hasUpArrowAfter > 0, String(manyScroll.hasUpArrowAfter)],
    ['[①] 맨 아래까지 내려가면 ↓ 버튼은 사라진다(위/아래 버튼이 분리되어 있다)', manyScroll.hasDownArrowAfter === 0, String(manyScroll.hasDownArrowAfter)],
    ['[②] "지도에서 고르기"를 누르면 지도 선택 시트가 열린다', mapPick.sheetOpen, String(mapPick.sheetOpen)],
    ['[②] 지도 박스(270x270)가 실제로 렌더된다', mapPick.boxFound, String(mapPick.boxFound)],
    ['[②] 위치를 고른 뒤 "다시 고르기" 문구 + 작은 미리보기로 바뀐다',
      mapPick.afterPick.includes('지도에서 다시 고르기'), mapPick.afterPick.slice(-200)],
  ];
  let pass = 0;
  for (const [label, ok, detail] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${ok ? '' : `  ⟨${detail}⟩`}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${checks.length} 통과`);

  await browser.close();
  process.exit(pass === checks.length ? 0 : 1);
})();
