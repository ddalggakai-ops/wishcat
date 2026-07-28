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
const docPath = (p) => `projects/${PROJECT}/databases/(default)/documents/${p}`;

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

let FS_MODE = 'ok'; // 'ok' | 'denied'

async function handleFirestore(route) {
  const url = route.request().url();
  if (FS_MODE === 'denied') {
    seen.push('FS 403 permission-denied');
    return json(
      route,
      { error: { code: 403, message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } },
      403
    );
  }
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
    if (col === 'items') return json(route, [{ document: ITEM_DOC, readTime: TS }]);
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

  const text = (await page.evaluate(() => (document.getElementById('root') || document.body).innerText))
    .replace(/\s+/g, ' ')
    .trim();
  const nodes = await page.evaluate(
    () => (document.getElementById('root') || document.body).querySelectorAll('*').length
  );
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
  await browser.close();

  console.log('\n\n========== 판정 ==========');
  const checks = [
    ['[로그인] 화면이 렌더된다', a.nodes > 30, `노드 ${a.nodes}`],
    ['[로그인] 로그인 화면에 갇혀있지 않다', !/친구와 함께 지우는 버킷리스트/.test(a.text), ''],
    ['[로그인] 로딩에서 멈추지 않는다', !/준비하고 있어요/.test(a.text), ''],
    ['[로그인] 내 프로필을 REST(batchGet)로 읽었다', a.seen.some((s) => s.includes(`batchGet users/${UID}`)), ''],
    ['[로그인] 아이템을 REST(runQuery)로 읽었다', a.seen.includes('FS runQuery items'), ''],
    ['[로그인] 불러온 아이템이 화면에 보인다', /오로라 보기/.test(a.text), a.text.slice(0, 200)],
    ['[로그인] 콘솔 치명적 오류 없음', a.errors.length === 0, a.errors.join(' | ').slice(0, 200)],

    ['[가입] 프로그레스바에서 멈추지 않는다', !/준비하고 있어요/.test(b.text) && b.nodes > 30, `노드 ${b.nodes}`],
    ['[가입] users 문서를 새로 만든다(commit)', b.seen.includes('FS commit'), b.seen.join(' | ')],
    ['[가입] 가입 직후 온보딩/홈으로 넘어간다', !/회원가입 이름 이메일 비밀번호/.test(b.text), b.text.slice(0, 200)],
    ['[가입] 콘솔 치명적 오류 없음', b.errors.length === 0, b.errors.join(' | ').slice(0, 200)],

    ['[403] 빈 화면이 아니다', c.nodes > 30, `노드 ${c.nodes}`],
    ['[403] 로딩에서 멈추지 않는다', !/준비하고 있어요/.test(c.text), ''],
    [
      '[403] 원인을 보여주는 오류 화면이 뜬다',
      /서버에 연결하지 못했어요|권한|permission/i.test(c.text),
      c.text.slice(0, 300),
    ],
    ['[403] 다시 시도 버튼이 있다', /다시 시도/.test(c.text), ''],
  ];
  for (const [n, p, d] of checks) console.log(`${p ? 'PASS' : 'FAIL'} — ${n}${d ? `  ⟨${d}⟩` : ''}`);
  const failed = checks.filter((x) => !x[1]).length;
  console.log(`\n${checks.length - failed}/${checks.length} 통과`);
  process.exit(failed ? 1 : 0);
})();
