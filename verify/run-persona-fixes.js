// 이번 라운드(버그 8개 + 접근성 + 함께하기 동기화 + 알림)에서 바뀐 동작을 검증합니다.
// Firebase REST를 가로채 상황별로 응답을 바꿔 가며, 화면이 실제로 그렇게 반응하는지 봅니다.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const PROJECT = 'wishcat-945d4';
const NOW = 1753000000;
const TS = '2026-07-01T00:00:00.000000Z';
const DATABASE_ID = 'wishcat';
const docPath = (p) => `projects/${PROJECT}/databases/${DATABASE_ID}/documents/${p}`;

function b64url(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const JWT = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: UID, user_id: UID, email: EMAIL,
    email_verified: true, iat: NOW, exp: NOW + 3600, auth_time: NOW,
    firebase: { identities: { email: [EMAIL] }, sign_in_provider: 'password' },
  }),
  'sig',
].join('.');

const USER_DOC = {
  name: docPath(`users/${UID}`),
  fields: { name: { stringValue: '검증이' }, bio: { stringValue: '' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } },
  createTime: TS, updateTime: TS,
};
const FRIEND_DOC = {
  name: docPath('users/friendUid'),
  fields: { name: { stringValue: '단짝' }, bio: { stringValue: '' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } },
  createTime: TS, updateTime: TS,
};

// 이미 3월에 이룬 꿈 (사진 1장 + 글). 여기에 글을 더 붙였을 때 날짜가 유지되는지 볼 겁니다.
const DONE_ITEM = {
  name: docPath('items/done-1'),
  fields: {
    ownerId: { stringValue: UID }, title: { stringValue: '한라산 등반' }, emoji: { stringValue: '⛰️' },
    note: { stringValue: '' }, category: { nullValue: null }, location: { nullValue: null },
    done: { booleanValue: true },
    memory: { mapValue: { fields: {
      photo: { stringValue: 'https://example.com/a.jpg' },
      photos: { arrayValue: { values: [{ stringValue: 'https://example.com/a.jpg' }] } },
      text: { stringValue: '정상에서' },
      date: { stringValue: '2026.03.14' },
    } } },
    participants: { arrayValue: {} }, origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
    likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
  },
  createTime: TS, updateTime: TS,
};
// 친구에게서 담아온 사본 (origin: joined) — 완료하면 "친구 목록에서도 지울까요?"가 떠야 합니다.
const JOINED_ITEM = {
  name: docPath('items/joined-1'),
  fields: {
    ownerId: { stringValue: UID }, title: { stringValue: '같이 제주도 가기' }, emoji: { stringValue: '🏝️' },
    note: { stringValue: '' }, category: { nullValue: null }, location: { nullValue: null },
    done: { booleanValue: false }, memory: { nullValue: null },
    participants: { arrayValue: { values: [{ stringValue: 'friendUid' }] } },
    origin: { stringValue: 'joined' },
    sourceOwnerId: { stringValue: 'friendUid' }, sourceItemId: { stringValue: 'src-1' },
    sourceTitle: { stringValue: '같이 제주도 가기' }, sourceEmoji: { stringValue: '🏝️' },
    helpedBy: { arrayValue: {} }, likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' },
    createdAt: { timestampValue: TS },
  },
  createTime: TS, updateTime: TS,
};

const commits = [];
function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function handleIdentity(route) {
  const url = route.request().url();
  if (url.includes('accounts:signInWithPassword')) {
    return json(route, { kind: 'x', localId: UID, email: EMAIL, displayName: '', idToken: JWT, registered: true, refreshToken: 'x', expiresIn: '3600' });
  }
  if (url.includes('accounts:lookup')) {
    return json(route, { kind: 'x', users: [{ localId: UID, email: EMAIL, emailVerified: true, displayName: '', providerUserInfo: [], validSince: '0', lastLoginAt: '0', createdAt: '0' }] });
  }
  return json(route, {}, 400);
}
async function handleToken(route) {
  return json(route, { access_token: JWT, expires_in: '3600', token_type: 'Bearer', refresh_token: 'x', id_token: JWT, user_id: UID, project_id: PROJECT });
}

// 시나리오별 설정
let CFG = { itemsFail: false, itemsDelayMs: 0, items: [] };

async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    return json(route, docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS };
      if (p === 'users/friendUid') return { found: FRIEND_DOC, readTime: TS };
      if (p === 'items/done-1') return { found: DONE_ITEM, readTime: TS };
      if (p === 'items/joined-1') return { found: JOINED_ITEM, readTime: TS };
      if (p === 'items/src-1') {
        return { found: { ...JOINED_ITEM, name: docPath('items/src-1'), fields: { ...JOINED_ITEM.fields, ownerId: { stringValue: 'friendUid' }, origin: { stringValue: 'own' } } }, readTime: TS };
      }
      return { missing: full, readTime: TS };
    }));
  }

  if (url.includes(':runQuery')) {
    const col = body?.structuredQuery?.from?.[0]?.collectionId;
    if (col === 'items') {
      if (CFG.itemsDelayMs) await new Promise((r) => setTimeout(r, CFG.itemsDelayMs));
      if (CFG.itemsFail) {
        return json(route, { error: { code: 403, message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } }, 403);
      }
      return json(route, CFG.items.map((document) => ({ document, readTime: TS })));
    }
    return json(route, [{ readTime: TS }]);
  }

  if (url.includes(':commit')) {
    commits.push(body);
    return json(route, { writeResults: [{ updateTime: TS }], commitTime: TS });
  }
  return json(route, {}, 200);
}

async function open(browser, cfg) {
  CFG = { itemsFail: false, itemsDelayMs: 0, items: [], ...cfg };
  commits.length = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => d.accept()); // window.confirm(웹용 confirmDialog)은 수락 처리
  await page.route('**identitytoolkit.googleapis.com/**', handleIdentity);
  await page.route('**securetoken.googleapis.com/**', handleToken);
  await page.route('**firestore.googleapis.com/**', handleFirestore);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill('password123');
  await page.waitForTimeout(300);
  await page.getByText('로그인', { exact: true }).last().click();
  return { ctx, page, logs };
}
const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

(async () => {
  const browser = await chromium.launch();
  const results = {};

  // ── A. 내 목록 불러오기 실패 → '아직 꿈이 없어요'가 아니라 실패 안내가 떠야 함
  {
    const { ctx, page } = await open(browser, { itemsFail: true });
    await page.waitForTimeout(5000);
    results.errorText = await txt(page);
    await page.screenshot({ path: 'verify/pf-a-offline.png' });
    await ctx.close();
  }

  // ── B. 둘러보기 최초 로딩 중 → '해당하는 버킷이 없어요'가 뜨면 안 됨
  {
    const { ctx, page } = await open(browser, { items: [DONE_ITEM], itemsDelayMs: 4000 });
    await page.waitForTimeout(6000);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(1200); // 아직 응답 오기 전
    results.exploreLoadingText = await txt(page);
    await page.screenshot({ path: 'verify/pf-b-explore-loading.png' });
    await ctx.close();
  }

  // ── C. 이미 이룬 꿈에 글을 더 붙여도 달성 날짜가 유지돼야 함
  {
    const { ctx, page } = await open(browser, { items: [DONE_ITEM] });
    await page.waitForTimeout(5000);
    await page.getByText('추억 수정', { exact: false }).first().click();
    await page.waitForTimeout(900);
    const areas = page.locator('textarea, input');
    const n = await areas.count();
    for (let i = 0; i < n; i++) {
      const ph = await areas.nth(i).getAttribute('placeholder');
      if (ph && /기록|어땠|남기/.test(ph)) { await areas.nth(i).fill('나중에 덧붙인 글'); break; }
    }
    await page.waitForTimeout(300);
    await page.getByText('저장', { exact: false }).last().click();
    await page.waitForTimeout(2500);
    results.commits = JSON.parse(JSON.stringify(commits));
    await ctx.close();
  }

  // ── D. 추천 탭 카드 글자색이 흰색이 아니어야 함(딥톤으로 바뀌었는지)
  {
    const { ctx, page } = await open(browser, { items: [] });
    await page.waitForTimeout(5000);
    await page.getByText('추천', { exact: true }).last().click();
    await page.waitForTimeout(1500);
    results.recommendColors = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('div').forEach((el) => {
        const t = (el.textContent || '').trim();
        if (/^읽고 담기/.test(t) && t.length < 20) out.push(getComputedStyle(el).color);
      });
      return out.slice(0, 6);
    });
    await page.screenshot({ path: 'verify/pf-d-recommend.png' });
    await ctx.close();
  }

  await browser.close();

  // ── 판정
  const c = results.commits || [];
  const memoryWrites = [];
  for (const b of c) {
    for (const w of b.writes || []) {
      const f = w.update?.fields?.memory?.mapValue?.fields;
      if (f) memoryWrites.push({ date: f.date?.stringValue, text: f.text?.stringValue });
    }
  }

  const checks = [
    ['[오프라인] "아직 꿈이 없어요"가 뜨지 않는다', !/아직 꿈이 없어요/.test(results.errorText), results.errorText.slice(0, 200)],
    ['[오프라인] "목록을 불러오지 못했어요" 안내가 뜬다', /불러오지 못했어요/.test(results.errorText), results.errorText.slice(0, 200)],
    ['[오프라인] 다시 시도 버튼이 있다', /다시 시도/.test(results.errorText), ''],
    ['[오프라인] 시작 템플릿 유도가 뜨지 않는다', !/시작 템플릿에서 골라 담기/.test(results.errorText), ''],

    ['[둘러보기] 로딩 중 "해당하는 버킷이 없어요"가 안 뜬다', !/해당하는 버킷이 없어요/.test(results.exploreLoadingText), results.exploreLoadingText.slice(0, 200)],

    ['[달성일] 기록 수정 시 commit이 발생했다', memoryWrites.length > 0, `memory 쓰기 ${memoryWrites.length}건`],
    ['[달성일] 원래 날짜 2026.03.14가 유지된다', memoryWrites.some((m) => m.date === '2026.03.14'), JSON.stringify(memoryWrites)],
    ['[달성일] 오늘 날짜로 덮어쓰지 않는다', !memoryWrites.some((m) => m.date && m.date !== '2026.03.14'), JSON.stringify(memoryWrites)],

    ['[대비] 추천 카드 CTA가 흰 글씨가 아니다', results.recommendColors.length > 0 && results.recommendColors.every((c) => c !== 'rgb(255, 255, 255)'), JSON.stringify(results.recommendColors)],
  ];
  for (const [n, p, d] of checks) console.log(`${p ? 'PASS' : 'FAIL'} — ${n}${d ? `  ⟨${d}⟩` : ''}`);
  const failed = checks.filter((x) => !x[1]).length;
  console.log(`\n${checks.length - failed}/${checks.length} 통과`);
  process.exit(failed ? 1 : 0);
})();
