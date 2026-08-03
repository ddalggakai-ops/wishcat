// 이번 성능 수정(참가자/도움 준 사람 등을 개별 조회 대신 'in' 배치 조회로 한 번에 채워 넣기)을
// 검증합니다. items 문서 여러 개에 서로 다른 참가자·도움 준 사람 uid를 넣어 두고,
// "각 사람마다 따로 batchGet이 나가지 않고, users 컬렉션에 대한 runQuery(in) 한 번으로 끝나는지" 확인합니다.
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
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: UID, user_id: UID, email: EMAIL,
    email_verified: true, iat: NOW, exp: NOW + 3600, auth_time: NOW,
    firebase: { identities: { email: [EMAIL] }, sign_in_provider: 'password' },
  }),
  'sig',
].join('.');

const TS = '2026-07-01T00:00:00.000000Z';
const DATABASE_ID = 'wishcat';
const docPath = (p) => `projects/${PROJECT}/databases/${DATABASE_ID}/documents/${p}`;

const USER_DOC = {
  name: docPath(`users/${UID}`),
  fields: { name: { stringValue: '검증이' }, bio: { stringValue: '' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } },
  createTime: TS, updateTime: TS,
};

// 친구 6명을 풀로 두고, 아이템 5개에 서로 다른 조합의 participants/helpedBy로 나눠 넣습니다.
const FRIEND_IDS = ['friendA', 'friendB', 'friendC', 'friendD', 'friendE', 'friendF'];
function friendDoc(id) {
  return {
    name: docPath(`users/${id}`),
    fields: { name: { stringValue: `친구-${id}` }, bio: { stringValue: '' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } },
    createTime: TS, updateTime: TS,
  };
}

function itemDoc(id, participants, helpedBy) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: UID }, title: { stringValue: `아이템 ${id}` }, emoji: { stringValue: '✦' },
      note: { stringValue: '' }, category: { nullValue: null }, location: { nullValue: null },
      done: { booleanValue: false }, memory: { nullValue: null },
      participants: { arrayValue: { values: participants.map((p) => ({ stringValue: p })) } },
      origin: { stringValue: 'own' },
      helpedBy: { arrayValue: { values: helpedBy.map((p) => ({ stringValue: p })) } },
      likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}
const ITEM_DOCS = [
  itemDoc('p1', ['friendA', 'friendB'], []),
  itemDoc('p2', ['friendC'], ['friendD']),
  itemDoc('p3', [], ['friendE']),
  itemDoc('p4', ['friendF'], []),
  itemDoc('p5', ['friendA'], ['friendB']), // friendA/B 재등장 — 캐시 히트로 처리돼야 함
];

const seen = [];
function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function handleIdentity(route) {
  const url = route.request().url();
  if (url.includes('accounts:signInWithPassword')) {
    return json(route, { kind: 'identitytoolkit#VerifyPasswordResponse', localId: UID, email: EMAIL, displayName: '', idToken: JWT, registered: true, refreshToken: 'x', expiresIn: '3600' });
  }
  if (url.includes('accounts:lookup')) {
    return json(route, { kind: 'identitytoolkit#GetAccountInfoResponse', users: [{ localId: UID, email: EMAIL, emailVerified: true, displayName: '', providerUserInfo: [], validSince: '0', lastLoginAt: '0', createdAt: '0' }] });
  }
  return json(route, {}, 400);
}
async function handleToken(route) {
  return json(route, { access_token: JWT, expires_in: '3600', token_type: 'Bearer', refresh_token: 'x', id_token: JWT, user_id: UID, project_id: PROJECT });
}

function extractInIds(structuredQuery) {
  const w = structuredQuery?.where;
  const ff = w?.fieldFilter || (w?.compositeFilter?.filters || []).map((f) => f.fieldFilter).find((f) => f?.op === 'IN');
  if (!ff || ff.op !== 'IN') return null;
  const values = ff.value?.arrayValue?.values || [];
  return values.map((v) => (v.referenceValue || '').split('/').pop()).filter(Boolean);
}

async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    docs.forEach((full) => {
      const p = full.split('/documents/')[1] || '';
      seen.push(`batchGet ${p}`);
    });
    const out = docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS };
      const fid = p.startsWith('users/') ? p.slice('users/'.length) : null;
      if (fid && FRIEND_IDS.includes(fid)) return { found: friendDoc(fid), readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }

  if (url.includes(':runQuery')) {
    const col = body?.structuredQuery?.from?.[0]?.collectionId;
    if (col === 'items') {
      seen.push('runQuery items');
      return json(route, ITEM_DOCS.map((document) => ({ document, readTime: TS })));
    }
    if (col === 'users') {
      const ids = extractInIds(body.structuredQuery) || [];
      seen.push(`runQuery users in=[${ids.sort().join(',')}]`);
      const docs = ids.filter((id) => FRIEND_IDS.includes(id)).map((id) => ({ document: friendDoc(id), readTime: TS }));
      return json(route, docs.length ? docs : [{ readTime: TS }]);
    }
    seen.push(`runQuery ${col}`);
    return json(route, [{ readTime: TS }]);
  }

  if (url.includes(':commit')) return json(route, { writeResults: [{ updateTime: TS }], commitTime: TS });
  return json(route, {}, 200);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
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
  await page.waitForTimeout(4000);

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  await page.screenshot({ path: 'verify/perf-users-batch.png' });
  await ctx.close();
  await browser.close();

  console.log('===== SDK 요청 로그 =====');
  console.log(seen.join('\n'));

  const individualFriendBatchGets = seen.filter((s) => s.startsWith('batchGet users/') && FRIEND_IDS.some((f) => s.endsWith(`users/${f}`)));
  const usersRunQueries = seen.filter((s) => s.startsWith('runQuery users'));
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));

  const checks = [
    ['화면에 아이템 5개가 다 보인다', ['p1', 'p2', 'p3', 'p4', 'p5'].every((id) => text.includes(`아이템 ${id}`)), ''],
    ['users 컬렉션에 대해 배치(in) 쿼리가 최소 1번 나갔다', usersRunQueries.length >= 1, seen.join(' | ')],
    ['친구 uid마다 따로 batchGet이 나가지 않는다(0건이어야 함)', individualFriendBatchGets.length === 0, individualFriendBatchGets.join(' | ') || '(없음 — 통과)'],
    ['콘솔 치명적 오류 없음', bad.length === 0, bad.join(' | ').slice(0, 300)],
  ];
  for (const [n, p, d] of checks) console.log(`${p ? 'PASS' : 'FAIL'} — ${n}${d ? `  ⟨${d}⟩` : ''}`);
  const failed = checks.filter((x) => !x[1]).length;
  console.log(`\n${checks.length - failed}/${checks.length} 통과`);
  process.exit(failed ? 1 : 0);
})();
