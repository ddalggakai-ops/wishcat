// 이번 요청 3개(전체공개/비공개 전환 속도, "이룬 꿈" 통계를 누르면 그 구획으로 스크롤,
// 엑셀로 추가 버튼을 새 꿈 추가 화면 안으로 이동)를 검증합니다.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const PROJECT = 'wishcat-945d4';
const NOW = 1753000000;

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
const JWT = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: UID, user_id: UID, email: EMAIL, email_verified: true, iat: NOW, exp: NOW + 3600, auth_time: NOW, firebase: { identities: { email: [EMAIL] }, sign_in_provider: 'password' } }),
  'sig',
].join('.');

const TS = '2026-07-01T00:00:00.000000Z';
const DATABASE_ID = 'wishcat';
const docPath = (p) => `projects/${PROJECT}/databases/${DATABASE_ID}/documents/${p}`;
const USER_DOC = { name: docPath(`users/${UID}`), fields: { name: { stringValue: '검증이' }, bio: { stringValue: 'b' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } }, createTime: TS, updateTime: TS };

// 아이템 20개(도전 중) + 3개(이룬 꿈) — "이룬 꿈" 구획이 화면 밖에 있을 만큼 충분히 길게.
function myDoc(id, i, done) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
      title: { stringValue: `버킷 ${i}` }, emoji: { stringValue: '🌌' }, note: { stringValue: '' },
      categories: { arrayValue: { values: [{ stringValue: '여행' }] } },
      priority: { nullValue: null }, order: { integerValue: String(i) },
      location: { nullValue: null }, targetDate: { nullValue: null },
      done: { booleanValue: !!done },
      memory: done ? { mapValue: { fields: { photo: { nullValue: null }, photos: { arrayValue: {} }, text: { stringValue: 't' }, date: { stringValue: '2026.01.01' } } } } : { nullValue: null },
      participants: { arrayValue: {} }, origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}
const MY_DOCS = [
  ...Array.from({ length: 20 }, (_, i) => myDoc(`todo${i}`, i, false)),
  ...Array.from({ length: 3 }, (_, i) => myDoc(`done${i}`, i, true)),
];
const MY_IDS = MY_DOCS.map((d) => d.name.split('/').pop());

const seen = [];
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function handleIdentity(route) {
  const url = route.request().url();
  seen.push(`AUTH ${url.split('?')[0].split('/').pop()}`);
  if (url.includes('accounts:signInWithPassword')) return json(route, { localId: UID, email: EMAIL, idToken: JWT, registered: true, refreshToken: 'r', expiresIn: '3600' });
  if (url.includes('accounts:lookup')) return json(route, { users: [{ localId: UID, email: EMAIL, emailVerified: true, displayName: '', providerUserInfo: [{ providerId: 'password', federatedId: EMAIL, email: EMAIL, rawId: EMAIL }], validSince: '0', lastLoginAt: String(NOW * 1000), createdAt: String(NOW * 1000) }] });
  return json(route, { error: { code: 400, message: 'UNEXPECTED', status: 'INVALID_ARGUMENT' } }, 400);
}
const handleToken = (route) => {
  seen.push('AUTH securetoken');
  return json(route, { access_token: JWT, expires_in: '3600', token_type: 'Bearer', refresh_token: 'r', id_token: JWT, user_id: UID, project_id: PROJECT });
};

let currentListPublic = true;

async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    const out = docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (p === `users/${UID}`) return { found: { ...USER_DOC, fields: { ...USER_DOC.fields, listPublic: { booleanValue: currentListPublic } } }, readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }

  if (url.includes(':runQuery')) {
    const sq = body?.structuredQuery || {};
    const col = sq.from?.[0]?.collectionId;
    const filters = JSON.stringify(sq.where || {});
    if (col === 'items') {
      seen.push('FS runQuery items(mine)');
      return json(route, MY_DOCS.map((document) => ({ document, readTime: TS })));
    }
    seen.push(`FS runQuery ${col}${sq.from?.[0]?.allDescendants ? '(group)' : ''}`);
    return json(route, [{ readTime: TS }]);
  }

  if (url.includes(':commit')) {
    const writes = body.writes || [];
    const touchesListPublic = writes.some((w) => (w.updateMask?.fieldPaths || []).includes('listPublic'));
    const ownerPublicWrites = writes.filter((w) => (w.updateMask?.fieldPaths || []).includes('ownerPublic')).length;
    seen.push(`FS commit x${writes.length}${touchesListPublic ? '(listPublic)' : ''}${ownerPublicWrites ? `(ownerPublic x${ownerPublicWrites})` : ''}`);
    return json(route, { writeResults: writes.map(() => ({ updateTime: TS })), commitTime: TS });
  }

  seen.push(`FS ??? ${url}`);
  return json(route, {}, 200);
}

async function scenario(browser, label, how) {
  seen.length = 0;
  currentListPublic = true;
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
  const extra = (await how(page)) || {};
  await page.waitForTimeout(1500);

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));
  console.log(`\n===== ${label} =====`);
  console.log(`오류 ${bad.length}${bad.length ? ': ' + bad.slice(0, 3).join(' || ').slice(0, 300) : ''}`);
  console.log(`텍스트: ${JSON.stringify(text).slice(0, 300)}`);
  console.log(`요청: ${seen.join(' | ')}`);
  await ctx.close();
  return { text, errors: bad, seen: [...seen], ...extra };
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

  // ① 전체공개 → 비공개 전환: 목록을 이미 불러온 상태라 아이템을 다시 읽지 않고 바로 써야 한다
  const visibility = await scenario(browser, '01-visibility-toggle-speed', async (page) => {
    await login(page);
    const runQueryCountBefore = seen.filter((s) => s.includes('items(mine)')).length;
    await page.getByText('전체공개', { exact: true }).first().click();
    await page.waitForTimeout(1200);
    const runQueryCountAfter = seen.filter((s) => s.includes('items(mine)')).length;
    return { runQueryCountBefore, runQueryCountAfter };
  });

  // ② "이룬 꿈" 통계를 누르면 그 구획으로 스크롤
  const scrollToDone = await scenario(browser, '02-tap-done-stat-scrolls', async (page) => {
    const scrollTop = () => page.evaluate(() => {
      const sv = Array.from(document.querySelectorAll('[data-focusable="true"], div')).find((el) => el.scrollHeight > el.clientHeight + 100);
      return sv ? sv.scrollTop : -1;
    });
    await login(page);
    const before = await scrollTop();
    // 상단 프로필 영역의 "이룬 꿈" 통계(꿈/이룬 꿈 중 두 번째)를 누릅니다.
    await page.getByText('이룬 꿈', { exact: true }).first().click();
    await page.waitForTimeout(900);
    const after = await scrollTop();
    return { before, after };
  });

  // ③ 엑셀로 추가 버튼이 "새로운 꿈" 추가 시트 안에 작게 들어있고, 누르면 엑셀 시트가 열린다
  const bulkImportInAdd = await scenario(browser, '03-bulk-import-in-add-sheet', async (page) => {
    await login(page);
    const mineTextBefore = await page.evaluate(() => document.body.innerText);
    await page.locator('[aria-label="새 꿈 추가"]').first().click();
    await page.waitForTimeout(700);
    const addSheetText = await page.evaluate(() => document.body.innerText);
    await page.getByText('엑셀로 여러 개 한 번에 추가', { exact: false }).first().click();
    await page.waitForTimeout(700);
    const afterClickText = await page.evaluate(() => document.body.innerText);
    return { mineTextBefore, addSheetText, afterClickText };
  });

  // ③b 수정 화면(editingItem 있음)에는 버튼이 없어야 한다
  const bulkImportNotInEdit = await scenario(browser, '04-bulk-import-not-in-edit', async (page) => {
    await login(page);
    await page.getByText('버킷 0', { exact: true }).first().click(); // 상세 진입(compact 기본이라 onEdit로 감)
    await page.waitForTimeout(700);
    const editText = await page.evaluate(() => document.body.innerText);
    return { editText };
  });

  await browser.close();

  const checks = [
    ['[전체공개↔비공개] 목록을 이미 불러온 상태라 토글할 때 아이템을 다시 읽지 않는다(추가 runQuery 0건)', visibility.runQueryCountAfter === visibility.runQueryCountBefore, `before=${visibility.runQueryCountBefore} after=${visibility.runQueryCountAfter} · ${visibility.seen.join(' | ')}`],
    ['[전체공개↔비공개] 대신 알고 있는 아이템 id에 바로 ownerPublic을 쓴다(23개)', visibility.seen.some((s) => s.includes(`ownerPublic x`)), visibility.seen.join(' | ')],
    ['[전체공개↔비공개] listPublic 프로필 필드도 함께 커밋된다', visibility.seen.some((s) => s.includes('(listPublic)')), visibility.seen.join(' | ')],
    ['[이룬 꿈 스크롤] "이룬 꿈"을 누르면 실제로 스크롤 위치가 바뀐다', scrollToDone.after >= 0 && scrollToDone.after > scrollToDone.before, `before=${scrollToDone.before} after=${scrollToDone.after}`],
    ['[엑셀 추가 이동] 내 목록 화면(둘러보기 전)엔 "엑셀로 추가" 문구가 없다', !/엑셀로 (추가|여러)/.test(bulkImportInAdd.mineTextBefore), bulkImportInAdd.mineTextBefore.slice(0, 200)],
    ['[엑셀 추가 이동] "새로운 꿈" 추가 시트를 열면 작은 "엑셀로 여러 개 한 번에 추가" 버튼이 있다', /엑셀로 여러 개 한 번에 추가/.test(bulkImportInAdd.addSheetText), bulkImportInAdd.addSheetText.slice(0, 200)],
    ['[엑셀 추가 이동] 그 버튼을 누르면 엑셀 업로드 시트가 열린다', /엑셀\(\.xlsx\)|엑셀\/CSV 파일 선택/.test(bulkImportInAdd.afterClickText), bulkImportInAdd.afterClickText.slice(0, 200)],
    ['[엑셀 추가 이동] 수정 화면에는 그 버튼이 없다(추가 전용)', !/엑셀로 여러 개 한 번에 추가/.test(bulkImportNotInEdit.editText), bulkImportNotInEdit.editText.slice(0, 200)],
  ];

  console.log('\n\n========== 판정 ==========');
  let fail = 0;
  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${ok ? '' : `\n     └ ${String(detail).slice(0, 400)}`}`);
    if (!ok) fail++;
  }
  console.log(`\n${checks.length - fail}/${checks.length} 통과`);
  process.exit(fail ? 1 : 0);
})();
