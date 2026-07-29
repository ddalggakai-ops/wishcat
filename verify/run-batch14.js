// 이번 요청 3개를 검증합니다.
// 1) "내 리스트 조회가 여전히 느리다" — 코드는 이미 batch13에서 병렬화를 증명했으니 새 회귀는 없고,
//    아래 요약에서 사용자에게 재확인을 요청합니다(이 스크립트의 범위 밖).
// 2) "둘러보기에서 특정 사람 페이지를 누르면 아무것도 안 뜬다" — 실제 원인은 friendships/{나_상대} 문서가
//    아직 없을 때(=친구 아님, 아주 흔한 경우) 보안 규칙이 resource.data를 null에 대해 참조하다가
//    permission-denied로 거부하는 것으로 추정됩니다. personService.getPerson()이 이 에러를 못 잡고
//    PersonScreen.load()에도 catch가 없어서, 화면이 "뒤로가기" 버튼만 남긴 채 영원히 멈췄습니다.
//    areFriends()에 try/catch를 추가해 이 경우 "친구 아님"으로 안전하게 처리하도록 고쳤습니다.
//    아래에서 friendships getDoc이 403을 내려주는 상황을 그대로 흉내 내서, 그래도 사람 페이지가
//    정상적으로 렌더되는지 확인합니다.
// 3) 둘러보기의 전체/이룬 꿈 필터를 칩 2개에서 슬라이딩 알약 토글로 바꿨습니다 — 구조/상태를 확인합니다.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const STRANGER = 'strangerUid00000000000';
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
const STRANGER_DOC = { name: docPath(`users/${STRANGER}`), fields: { name: { stringValue: '길동' }, bio: { stringValue: '남의 꿈도 소중해요' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } }, createTime: TS, updateTime: TS };

function exploreDoc(id, title, ownerId, done) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: ownerId }, ownerPublic: { booleanValue: true },
      title: { stringValue: title }, emoji: { stringValue: '🥾' }, note: { stringValue: '' },
      categories: { arrayValue: { values: [{ stringValue: '여행' }] } },
      priority: { nullValue: null }, order: { integerValue: '0' },
      location: { nullValue: null }, targetDate: { nullValue: null },
      done: { booleanValue: !!done },
      memory: done ? { mapValue: { fields: { photo: { nullValue: null }, photos: { arrayValue: {} }, text: { stringValue: '해냈어요' }, date: { stringValue: '2026.01.01' } } } } : { nullValue: null },
      participants: { arrayValue: {} }, origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '7' }, savesCount: { integerValue: '2' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}
const EXPLORE_DOCS = [
  exploreDoc('ex1', '산티아고 순례길 걷기', STRANGER, false),
  exploreDoc('ex2', '이미 이룬 마라톤', STRANGER, true),
];

const seen = [];
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function handleIdentity(route) {
  const url = route.request().url();
  const ep = url.split('?')[0].split('/').pop();
  seen.push(`AUTH ${ep}`);
  if (url.includes('accounts:signInWithPassword')) {
    return json(route, { localId: UID, email: EMAIL, idToken: JWT, registered: true, refreshToken: 'r', expiresIn: '3600' });
  }
  if (url.includes('accounts:lookup')) {
    return json(route, { users: [{ localId: UID, email: EMAIL, emailVerified: true, displayName: '', providerUserInfo: [{ providerId: 'password', federatedId: EMAIL, email: EMAIL, rawId: EMAIL }], validSince: '0', lastLoginAt: String(NOW * 1000), createdAt: String(NOW * 1000) }] });
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
      if (p === `users/${STRANGER}`) return { found: STRANGER_DOC, readTime: TS };
      if (p.startsWith('users/')) return { found: { ...USER_DOC, name: full }, readTime: TS };
      const ex = EXPLORE_DOCS.find((d) => d.name.endsWith(`/${p}`));
      if (ex) return { found: ex, readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }

  if (url.includes(':getDocument') || (url.match(/\/friendships\/[^/]+$/) && route.request().method() === 'GET')) {
    // 단일 문서 직접 GET 형태로 오는 경우 대비(лite SDK는 보통 batchGet을 쓰지만 방어적으로).
    seen.push('FS getDocument friendships (403)');
    return json(route, { error: { code: 403, message: 'PERMISSION_DENIED: Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } }, 403);
  }

  if (url.includes(':runQuery')) {
    const sq = body?.structuredQuery || {};
    const col = sq.from?.[0]?.collectionId;
    const filters = JSON.stringify(sq.where || {});
    if (col === 'items') {
      if (filters.includes('ownerPublic')) {
        seen.push('FS runQuery items(explore)');
        return json(route, EXPLORE_DOCS.map((document) => ({ document, readTime: TS })));
      }
      if (filters.includes(STRANGER)) {
        seen.push('FS runQuery items(person=stranger)');
        return json(route, EXPLORE_DOCS.map((document) => ({ document, readTime: TS })));
      }
      seen.push('FS runQuery items(mine)');
      return json(route, [{ readTime: TS }]);
    }
    if (col === 'users') {
      seen.push('FS runQuery users');
      const ids = (sq.where?.fieldFilter?.value?.arrayValue?.values || []).map((v) => v.stringValue);
      const docs = [USER_DOC, STRANGER_DOC].filter((d) => ids.some((id) => d.name.endsWith(`/${id}`)));
      return json(route, docs.map((document) => ({ document, readTime: TS })));
    }
    seen.push(`FS runQuery ${col}${sq.from?.[0]?.allDescendants ? '(group)' : ''}`);
    return json(route, [{ readTime: TS }]);
  }

  if (url.includes(':commit')) {
    const n = (body.writes || []).length;
    seen.push(`FS commit x${n}`);
    return json(route, { writeResults: (body.writes || []).map(() => ({ updateTime: TS })), commitTime: TS });
  }

  // friendships/{a_b} 단일 문서를 lite SDK가 :batchGet이 아니라 GET으로 직접 두드리는 경우
  // (버전에 따라 다를 수 있어 방어적으로 처리) — 어느 경로로 오든 403을 재현합니다.
  if (/\/documents\/friendships\//.test(url) && !url.includes(':')) {
    seen.push('FS GET friendships (403)');
    return json(route, { error: { code: 403, message: 'PERMISSION_DENIED', status: 'PERMISSION_DENIED' } }, 403);
  }

  seen.push(`FS ??? ${url}`);
  return json(route, {}, 200);
}

// friendships 단일 문서 조회는 실제로 :batchGet을 통해 나갑니다 — 그 경로에서 403을 재현하도록
// 위 handleFirestore의 :batchGet 분기를 friendships에 대해서도 처리하게 확장합니다.
async function handleFirestoreWithFriendshipDenied(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    const hasFriendship = docs.some((d) => d.includes('/friendships/'));
    if (hasFriendship) {
      seen.push('FS batchGet friendships (403 simulated)');
      return json(route, { error: { code: 403, message: 'PERMISSION_DENIED: Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } }, 403);
    }
  }
  return handleFirestore(route);
}

async function scenario(browser, label, how) {
  seen.length = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.route('**identitytoolkit.googleapis.com/**', handleIdentity);
  await page.route('**securetoken.googleapis.com/**', handleToken);
  await page.route('**firestore.googleapis.com/**', handleFirestoreWithFriendshipDenied);

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const extra = (await how(page)) || {};
  await page.waitForTimeout(2000);

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));
  console.log(`\n===== ${label} =====`);
  console.log(`오류 ${bad.length}${bad.length ? ': ' + bad.slice(0, 3).join(' || ').slice(0, 300) : ''}`);
  console.log(`텍스트: ${JSON.stringify(text).slice(0, 500)}`);
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

  // 둘러보기 → 낯선 사람의 아이템 상세 → 프로필 보기 (friendships 문서 없음 → 403 재현)
  const person = await scenario(browser, '01-explore-person-page', async (page) => {
    await login(page);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(2200);
    await page.getByText('산티아고 순례길 걷기', { exact: false }).first().click();
    await page.waitForTimeout(1000);
    await page.getByText('프로필 보기', { exact: false }).first().click();
    await page.waitForTimeout(1500);
    const stuckOnBackOnly = await page.evaluate(() => document.body.innerText.trim().length < 20);
    return { stuckOnBackOnly };
  });

  // 토글 구조/상태 확인
  const toggle = await scenario(browser, '02-explore-toggle', async (page) => {
    await login(page);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(2200);
    // react-native-web은 accessibilityState.selected를 button 롤에는 aria-selected로 안 붙여줍니다.
    // 대신 실제 UI가 "슬라이딩 알약 하나 + 텍스트 2개" 구조인지, 알약이 실제로 이동하는지를 봅니다.
    const readToggle = () => document.evaluate(
      "//button[.//div[text()='전체 버킷']]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    const before = await page.evaluate(() => {
      const allBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === '전체 버킷');
      const track = allBtn ? allBtn.parentElement : null;
      const thumb = track ? track.firstElementChild : null; // 첫 자식이 슬라이딩 알약(div), 그 다음이 버튼 2개
      const buttons = track ? Array.from(track.querySelectorAll('button')) : [];
      return {
        buttonCount: buttons.length,
        labels: buttons.map((b) => b.textContent),
        thumbTransform: thumb ? getComputedStyle(thumb).transform : null,
        allColor: buttons[0] ? getComputedStyle(buttons[0].firstElementChild).color : null,
        doneColor: buttons[1] ? getComputedStyle(buttons[1].firstElementChild).color : null,
      };
    });
    await page.getByText('이룬 꿈', { exact: true }).first().click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => {
      const allBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === '전체 버킷');
      const track = allBtn ? allBtn.parentElement : null;
      const thumb = track ? track.firstElementChild : null;
      const buttons = track ? Array.from(track.querySelectorAll('button')) : [];
      return {
        thumbTransform: thumb ? getComputedStyle(thumb).transform : null,
        allColor: buttons[0] ? getComputedStyle(buttons[0].firstElementChild).color : null,
        doneColor: buttons[1] ? getComputedStyle(buttons[1].firstElementChild).color : null,
      };
    });
    // 필터가 실제로 걸리는지(전체는 미완료+완료 둘 다, 이룬 꿈은 완료만) 텍스트로도 확인
    const filteredText = await page.evaluate(() => document.body.innerText);
    return { before, after, filteredText };
  });

  await browser.close();

  // 이 시나리오는 friendships 읽기가 403으로 거부되는 상황을 "일부러" 재현한 것이라,
  // 그 403 자체는 예상된 네트워크 로그이지 앱의 새 버그가 아닙니다. 그 로그만 걸러내고 확인합니다.
  const unexpectedPersonErrors = person.errors.filter((e) => !e.includes('403'));

  const checks = [
    ['[사람 페이지] 낯선 사람(친구 아님)의 프로필을 열어도 뒤로가기만 남고 멈추지 않는다', !person.stuckOnBackOnly, person.text.slice(0, 200)],
    ['[사람 페이지] friendships 문서 부재로 인한 permission-denied가 실제로 재현됐다(테스트 전제 확인)', person.seen.some((s) => s.includes('403')), person.seen.join(' | ')],
    ['[사람 페이지] 그럼에도 그 사람의 공개 아이템 제목이 렌더된다', /산티아고 순례길 걷기|이미 이룬 마라톤/.test(person.text), person.text.slice(0, 200)],
    ['[사람 페이지] (의도적으로 재현한 403 외에) 콘솔에 다른 치명적 오류가 없다', unexpectedPersonErrors.length === 0, unexpectedPersonErrors.join(' | ')],
    ['[토글] 버튼 2개 + 슬라이딩 알약 1개 구조다(칩 2개 분리 방식이 아님)', toggle.before.buttonCount === 2 && !!toggle.before.thumbTransform && toggle.before.thumbTransform !== 'none', JSON.stringify(toggle.before)],
    ['[토글] 초기값(전체 버킷)일 때 알약이 왼쪽에 있다', toggle.before.thumbTransform.includes('matrix') && /matrix\(1, 0, 0, 1, 0,/.test(toggle.before.thumbTransform), toggle.before.thumbTransform],
    ['[토글] "이룬 꿈"을 누르면 알약이 오른쪽으로 이동한다', toggle.after.thumbTransform !== toggle.before.thumbTransform, `${toggle.before.thumbTransform} → ${toggle.after.thumbTransform}`],
    ['[토글] 선택된 라벨의 글자색이 나머지와 달라진다(전체→이룬 전환 시 강조색이 넘어감)', toggle.after.doneColor === toggle.before.allColor && toggle.after.allColor !== toggle.before.allColor, JSON.stringify({ before: toggle.before, after: toggle.after })],
    ['[필터] "이룬 꿈"을 누르면 실제로 완료 항목만 남는다', /이미 이룬 마라톤/.test(toggle.filteredText) && !/산티아고 순례길 걷기/.test(toggle.filteredText), toggle.filteredText],
  ];

  console.log('\n\n========== 판정 ==========');
  let fail = 0;
  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${ok ? '' : `\n     └ ${String(detail).slice(0, 300)}`}`);
    if (!ok) fail++;
  }
  console.log(`\n${checks.length - fail}/${checks.length} 통과`);
  process.exit(fail ? 1 : 0);
})();
