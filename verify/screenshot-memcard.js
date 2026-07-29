const { chromium } = require('playwright');
const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const PROJECT = 'wishcat-945d4';
const NOW = 1753000000;
function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
const JWT = [b64url({ alg: 'none', typ: 'JWT' }), b64url({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: UID, user_id: UID, email: EMAIL, email_verified: true, iat: NOW, exp: NOW + 3600, auth_time: NOW, firebase: { identities: { email: [EMAIL] }, sign_in_provider: 'password' } }), 'sig'].join('.');
const TS = '2026-07-01T00:00:00.000000Z';
const DATABASE_ID = 'wishcat';
const docPath = (p) => `projects/${PROJECT}/databases/${DATABASE_ID}/documents/${p}`;
const USER_DOC = { name: docPath(`users/${UID}`), fields: { name: { stringValue: '검증이' }, bio: { stringValue: 'x' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } }, createTime: TS, updateTime: TS };

// 1x1 파란 픽셀 PNG를 base64 data URL로 써서 실제 이미지 서버 없이도 사진 있는 케이스를 재현합니다.
const PHOTO_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function doneDoc(id, title, opts) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
      title: { stringValue: title }, emoji: { stringValue: opts.emoji }, note: { stringValue: '' },
      categories: { arrayValue: { values: (opts.categories || []).map((c) => ({ stringValue: c })) } },
      priority: { nullValue: null }, order: { integerValue: '0' },
      location: { nullValue: null }, targetDate: { nullValue: null },
      done: { booleanValue: true },
      memory: opts.memory ? {
        mapValue: { fields: {
          photo: opts.memory.photo ? { stringValue: opts.memory.photo } : { nullValue: null },
          text: { stringValue: opts.memory.text || '' },
          date: { stringValue: opts.memory.date || '2026-07-01' },
        } },
      } : { nullValue: null },
      participants: { arrayValue: {} },
      origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}

const DOCS = [
  doneDoc('a1', '아이슬란드 오로라 보기', { emoji: '🌌', categories: ['여행'], memory: { photo: PHOTO_DATA_URL, text: '드디어 오로라를 봤어요! 상상보다 훨씬 예뻤어요.', date: '2026-06-14' } }),
  doneDoc('a2', '악기 한 곡 완주하기', { emoji: '🎹', categories: ['취미'], memory: { photo: null, text: '연습 3개월 만에 드디어 완주 성공', date: '2026-06-20' } }),
];

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function handleIdentity(route) {
  const url = route.request().url();
  if (url.includes('accounts:signInWithPassword')) return json(route, { localId: UID, email: EMAIL, idToken: JWT, registered: true, refreshToken: 'r', expiresIn: '3600' });
  if (url.includes('accounts:lookup')) return json(route, { users: [{ localId: UID, email: EMAIL, emailVerified: true, displayName: '', providerUserInfo: [{ providerId: 'password', federatedId: EMAIL, email: EMAIL, rawId: EMAIL }], validSince: '0', lastLoginAt: String(NOW * 1000), createdAt: String(NOW * 1000) }] });
  return json(route, {}, 400);
}
const handleToken = (route) => json(route, { access_token: JWT, expires_in: '3600', token_type: 'Bearer', refresh_token: 'r', id_token: JWT, user_id: UID, project_id: PROJECT });
async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    return json(route, docs.map((full) => { const p = full.split('/documents/')[1] || ''; if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS }; return { missing: full, readTime: TS }; }));
  }
  if (url.includes(':runQuery')) {
    const sq = body?.structuredQuery || {};
    const col = sq.from?.[0]?.collectionId;
    if (col === 'items') return json(route, DOCS.map((document) => ({ document, readTime: TS })));
    return json(route, [{ readTime: TS }]);
  }
  if (url.includes(':commit')) return json(route, { writeResults: (body.writes || []).map(() => ({ updateTime: TS })), commitTime: TS });
  return json(route, {}, 200);
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[console.error] ${m.text()}`); });
  await page.route('**identitytoolkit.googleapis.com/**', handleIdentity);
  await page.route('**securetoken.googleapis.com/**', handleToken);
  await page.route('**firestore.googleapis.com/**', handleFirestore);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill('password123');
  await page.waitForTimeout(200);
  await page.getByText('로그인', { exact: true }).last().click();
  await page.waitForTimeout(2500);

  const doneSection = page.getByText('이룬 꿈', { exact: true }).last();
  await doneSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verify/memcard-both.png', fullPage: true });

  const secondCard = page.getByText('악기 한 곡 완주하기', { exact: true }).last();
  await secondCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verify/memcard-second.png', fullPage: true });

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  console.log('TEXT:', text.slice(0, 600));
  await browser.close();
})();
