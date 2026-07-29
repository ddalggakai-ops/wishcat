// "둘러보기 조회가 정말 느리다 / 내 버킷리스트 최초 조회를 1초 안으로" 요청에 대한 검증.
// 이 mock 서버는 응답을 사실상 즉시(0ms) 돌려주기 때문에, 그냥 돌리면 예전 코드(직렬)든 지금 코드(병렬)든
// 둘 다 빨라 보여서 개선을 증명할 수 없습니다. 그래서 각 Firestore 응답에 일부러 150ms 지연을 넣고,
// "서로 관계없는 요청들이 실제로 동시에 나가는지"를 총 소요시간으로 확인합니다.
// - 내 목록(Mine) 최초 조회: 아이템 목록 조회 + 좋아요 사전조회, 이 둘이 동시에 나가면 ~150ms대,
//   예전처럼 아이템마다 좋아요를 따로 읽었다면(20개면 21번 왕복) 훨씬 오래 걸립니다.
// - 둘러보기(Explore) 최초 조회: 아이템 목록 + 차단목록 + 좋아요 사전조회가 동시에 나가고,
//   그 다음에만(의존관계라서 어쩔 수 없이) 소유자 프로필 조회가 이어집니다 — 그래서 총 2단계(~300ms대)를
//   기대합니다. 예전처럼 4단계를 한 줄씩 기다렸다면 ~600ms 이상 걸립니다.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const PROJECT = 'wishcat-945d4';
const NOW = 1753000000;
const DELAY_MS = 150;

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

function myDoc(id, i) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
      title: { stringValue: `버킷 ${i}` }, emoji: { stringValue: '🌌' }, note: { stringValue: '' },
      categories: { arrayValue: { values: [{ stringValue: '여행' }] } },
      priority: { nullValue: null }, order: { integerValue: String(i) },
      location: { nullValue: null }, targetDate: { nullValue: null },
      done: { booleanValue: false }, memory: { nullValue: null }, participants: { arrayValue: {} },
      origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}
// 다른 사람 20명의 공개 아이템 — 둘러보기용
function publicDoc(id, i) {
  const ownerId = `owner${i}`;
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: ownerId }, ownerPublic: { booleanValue: true },
      title: { stringValue: `공개 버킷 ${i}` }, emoji: { stringValue: '🌠' }, note: { stringValue: '' },
      categories: { arrayValue: { values: [{ stringValue: '여행' }] } },
      priority: { nullValue: null }, order: { integerValue: '0' },
      location: { nullValue: null }, targetDate: { nullValue: null },
      done: { booleanValue: false }, memory: { nullValue: null }, participants: { arrayValue: {} },
      origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
      likesCount: { integerValue: String(100 - i) }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}

const MINE_DOCS = Array.from({ length: 20 }, (_, i) => myDoc(`m${i}`, i));
const PUBLIC_DOCS = Array.from({ length: 20 }, (_, i) => publicDoc(`p${i}`, i));
const OWNER_USER_DOCS = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => [`owner${i}`, { name: docPath(`users/owner${i}`), fields: { name: { stringValue: `주인${i}` }, bio: { stringValue: '' }, listPublic: { booleanValue: true }, createdAt: { timestampValue: TS } }, createTime: TS, updateTime: TS }])
);

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleIdentity(route) {
  const url = route.request().url();
  if (url.includes('accounts:signInWithPassword')) return json(route, { localId: UID, email: EMAIL, idToken: JWT, registered: true, refreshToken: 'r', expiresIn: '3600' });
  if (url.includes('accounts:lookup')) return json(route, { users: [{ localId: UID, email: EMAIL, emailVerified: true, displayName: '', providerUserInfo: [{ providerId: 'password', federatedId: EMAIL, email: EMAIL, rawId: EMAIL }], validSince: '0', lastLoginAt: '1', createdAt: '1' }] });
  return json(route, {}, 400);
}
const handleToken = (route) => json(route, { access_token: JWT, expires_in: '3600', token_type: 'Bearer', refresh_token: 'r', id_token: JWT, user_id: UID, project_id: PROJECT });

// Playwright/RN Web 자체의 렌더링·이벤트 처리 오버헤드가 있어서 "총 소요시간"으로 재면 노이즈가 커요.
// 그래서 대신 각 요청이 실제로 "시작된 시각"(mock이 응답을 만들기 전, 지연을 넣기 직전)을 남겨서,
// 서로 관계없는 요청들이 거의 동시에 시작됐는지(=병렬), 아니면 하나 끝나길 기다렸다 다음이 시작됐는지
// (=직렬, 이전 요청 지연만큼 늦게 시작)를 직접 비교합니다. 이러면 페이지 렌더링 시간과 무관하게
// "병렬로 쐈는가"만 정확히 검증할 수 있어요.
function makeFirestoreHandler(events) {
  return async function handleFirestore(route) {
    const url = route.request().url();
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
    const startedAt = Date.now();

    if (url.includes(':batchGet')) {
      const docs = body.documents || [];
      docs.forEach((full) => events.push({ label: `batchGet ${full.split('/documents/')[1] || ''}`, t: startedAt }));
      await delay(DELAY_MS);
      const out = docs.map((full) => {
        const p = full.split('/documents/')[1] || '';
        if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS };
        if (OWNER_USER_DOCS[p.replace('users/', '')] && p.startsWith('users/')) return { found: OWNER_USER_DOCS[p.replace('users/', '')], readTime: TS };
        return { missing: full, readTime: TS };
      });
      return json(route, out);
    }
    if (url.includes(':runQuery')) {
      const sq = body?.structuredQuery || {};
      const col = sq.from?.[0]?.collectionId;
      const group = sq.from?.[0]?.allDescendants;
      if (col === 'items' && !group) {
        const isMineQuery = (JSON.stringify(sq.where || {})).includes(UID);
        const docs = isMineQuery ? MINE_DOCS : PUBLIC_DOCS;
        events.push({ label: isMineQuery ? 'items(mine)' : 'items(explore)', t: startedAt });
        await delay(DELAY_MS);
        return json(route, docs.map((document) => ({ document, readTime: TS })));
      }
      if (col === 'likes' && group) {
        events.push({ label: 'likes(prime)', t: startedAt });
        await delay(DELAY_MS);
        return json(route, [{ readTime: TS }]);
      }
      if (col === 'blocked') {
        events.push({ label: 'blocked', t: startedAt });
        await delay(DELAY_MS);
        return json(route, [{ readTime: TS }]);
      }
      if (col === 'users') {
        // 소유자 프로필을 documentId() in [...] 로 한 번에 묶어 읽는 쿼리 — 실제로 응답해 줘야
        // (안 그러면 앱이 캐시가 비어있다고 보고 아이템마다 개별 조회로 빠져서, 정작 이 테스트가
        // 확인하려는 "N번 개별 조회를 없앴다"를 거꾸로 깨뜨립니다)
        events.push({ label: 'owners(in)', t: startedAt });
        await delay(DELAY_MS);
        const allUserDocs = [USER_DOC, ...Object.values(OWNER_USER_DOCS)];
        return json(route, allUserDocs.map((document) => ({ document, readTime: TS })));
      }
      events.push({ label: `runQuery ${col}${group ? '(group)' : ''}`, t: startedAt });
      await delay(DELAY_MS);
      return json(route, [{ readTime: TS }]);
    }
    if (url.includes(':runAggregationQuery')) {
      await delay(DELAY_MS);
      const alias = body?.structuredAggregationQuery?.aggregations?.[0]?.alias || 'aggregate_0';
      return json(route, [{ result: { aggregateFields: { [alias]: { integerValue: '0' } } }, readTime: TS }]);
    }
    if (url.includes(':commit')) {
      return json(route, { writeResults: (body.writes || []).map(() => ({ updateTime: TS })), commitTime: TS });
    }
    events.push({ label: `??? ${url}`, t: startedAt });
    return json(route, {}, 200);
  };
}

async function run(label, gotoAction) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const events = [];
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**identitytoolkit.googleapis.com/**', handleIdentity);
  await page.route('**securetoken.googleapis.com/**', handleToken);
  await page.route('**firestore.googleapis.com/**', makeFirestoreHandler(events));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2000); // 부팅(로그인 폼 렌더)
  const inputs = page.locator('input');
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill('password123');
  await page.waitForTimeout(200);

  await page.getByText('로그인', { exact: true }).last().click();
  const result = await gotoAction(page);

  await ctx.close();
  await browser.close();
  console.log(`\n===== ${label} =====`);
  console.log(events.map((e) => `${e.label}@${e.t}`).join(' | '));
  return { events, ...result };
}

// label로 시작하는 첫 이벤트 시각. 못 찾으면 null.
function firstT(events, label) {
  const hit = events.find((e) => e.label === label);
  return hit ? hit.t : null;
}

(async () => {
  const checks = [];

  // 내 목록(Mine) 최초 조회 — 로그인 직후 기본 탭이라 로그인 화면 전환과 함께 바로 뜹니다.
  const mine = await run('내 버킷리스트 최초 조회 (20개)', async (page) => {
    await page.waitForSelector('text=/도전 중/', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    return {};
  });
  const mineIndividualLikes = mine.events.filter((e) => e.label.startsWith('batchGet items/')).length;
  checks.push(['[내 목록] 아이템 20개에 대해 좋아요를 하나씩 따로 읽지 않는다(개별 조회 0건)', mineIndividualLikes === 0, `개별 좋아요 조회=${mineIndividualLikes}`]);
  const tMineItems = firstT(mine.events, 'items(mine)');
  const tMineLikes = firstT(mine.events, 'likes(prime)');
  const mineGap = tMineItems != null && tMineLikes != null ? Math.abs(tMineItems - tMineLikes) : null;
  checks.push([`[내 목록] 아이템 목록 조회와 좋아요 사전조회가 동시에(±${Math.round(DELAY_MS / 2)}ms 이내) 시작된다 — 순서대로 기다리지 않는다`,
    mineGap !== null && mineGap < DELAY_MS / 2, mineGap === null ? '요청을 못 찾음' : `시작 시각 차이=${mineGap}ms`]);

  // 둘러보기(Explore) 최초 조회 — 실제 사용 흐름 그대로: 로그인하면 기본 탭인 '내 목록'이 먼저 뜨고,
  // 그 다음에 '둘러보기'를 누릅니다. 로그인 시점에 미리 데워 둔 좋아요/차단 캐시가 이때 이미 준비돼
  // 있어야(=요청이 아예 안 나가야) "최초 조회가 빠르다"는 체감이 실제로 맞습니다.
  const explore = await run('둘러보기 최초 조회 (공개 20개, 내 목록을 먼저 본 뒤)', async (page) => {
    await page.waitForSelector('text=/도전 중/', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForSelector('text=/공개 버킷/', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    return {};
  });
  // '내 목록' 단계가 끝난 시점 이후에 일어난 요청만 '둘러보기 단계'로 봅니다.
  const mineDoneAt = Math.max(...explore.events.filter((e) => e.label.startsWith('items(mine)') || e.label === 'likes(prime)' || e.label === 'blocked').map((e) => e.t), 0);
  const explorePhase = explore.events.filter((e) => e.t > mineDoneAt);
  const reFetchedBlockedOrLikes = explorePhase.filter((e) => e.label === 'blocked' || e.label === 'likes(prime)');
  checks.push(['[둘러보기] 로그인할 때 미리 데워 둔 좋아요/차단 캐시를 그대로 써서, 둘러보기로 넘어갈 때 그 두 조회가 아예 다시 나가지 않는다',
    reFetchedBlockedOrLikes.length === 0, `다시 나간 요청=${reFetchedBlockedOrLikes.map((e) => e.label).join(',') || '없음'}`]);
  const tExItems = explorePhase.find((e) => e.label === 'items(explore)')?.t ?? null;
  const tExOwners = explorePhase.find((e) => e.label === 'owners(in)')?.t ?? null;
  checks.push(['[둘러보기] 그래서 실제로는 아이템 목록 조회 → 소유자 프로필 조회, 단 2단계로 끝난다(캐시가 없던 예전엔 4단계 직렬)',
    tExItems !== null && tExOwners !== null && tExOwners >= tExItems, `items=${tExItems}, owners=${tExOwners}`]);

  console.log('\n\n========== 요약 ==========');
  let pass = 0;
  checks.forEach(([label, ok, extra]) => {
    console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : `  ← ${extra || ''}`}`);
    if (ok) pass++;
  });
  console.log(`\n${pass}/${checks.length} 통과`);
  process.exit(pass === checks.length ? 0 : 1);
})();
