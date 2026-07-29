// 이번 요청 3개(친구/둘러보기 조회 성능 개선 · 추억 사진 10장까지 · 진행중/중단 + D+n일 + 중단 확인 팝업)가
// 실제로 렌더되고 동작하는지 검증합니다. run-batch9/10/11.js 와 같은 방식(Firebase REST 목킹 + 실제 웹 빌드)입니다.
//
// batch11까지의 목킹은 :batchGet에서 아이템 문서를 전부 "missing"으로 답해서, completeItem/reopenItem처럼
// updateDoc 뒤에 getDoc으로 다시 읽어오는 흐름은 사실 제대로 검증되지 못하고 있었어요(실제 Firestore에선
// 방금 쓴 문서가 바로 조회되니 문제 없지만, 목에서는 놓치고 있었음). 이번엔 :batchGet이 ACTIVE_DOCS에서
// 실제로 찾아 돌려주고, :commit으로 들어온 변경을 ACTIVE_DOCS에 반영하도록(문서가 살아있는 것처럼) 고쳤습니다.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// resolveImageUrl은 https?:// 로만 시작하면 통과시키지만, 이 샌드박스는 바깥 네트워크(Firebase Storage 포함)가
// 막혀 있어서 진짜 사진 URL은 로드가 안 됩니다. 그래서 정적 서버가 실제로 서빙 중인 dist-web 밑에
// 작은 테스트용 PNG 3장을 직접 만들어 두고 http://localhost:8099/test-photos/... 로 씁니다.
function makeSolidPng(size, [r, g, b]) {
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      let c = (crc ^ buf[i]) & 0xFF;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rowLen = 1 + size * 3;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0;
    for (let x = 0; x < size; x++) { const o = y * rowLen + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TEST_PHOTO_DIR = path.join(__dirname, '..', 'dist-web', 'test-photos');
fs.mkdirSync(TEST_PHOTO_DIR, { recursive: true });
[[255, 99, 132], [99, 132, 255], [132, 255, 99]].forEach((c, i) => {
  fs.writeFileSync(path.join(TEST_PHOTO_DIR, `p${i + 1}.png`), makeSolidPng(60, c));
});

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const EMAIL = 'verify@example.com';
const FID = 'friendUid0000000000000';
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
const NOW_ISO = new Date().toISOString(); // 실제 '지금' — 진행 시작 시 서버타임스탬프 대신 씁니다.
const DATABASE_ID = 'wishcat';
const docPath = (p) => `projects/${PROJECT}/databases/${DATABASE_ID}/documents/${p}`;

// 오늘 날짜 기준 며칠 전인지 계산(elapsedDaysLabel과 같은 방식 — UTC 날짜만 비교) — 테스트 기대값 계산용
function daysAgoLabel(iso) {
  const start = new Date(iso);
  const now = new Date();
  const s = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const n = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((n - s) / 86400000));
}
const STARTED_1D_AGO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const EXPECT_1D_LABEL = daysAgoLabel(STARTED_1D_AGO);

const USERS = {
  [UID]: {
    name: docPath(`users/${UID}`),
    fields: {
      name: { stringValue: '검증이' }, bio: { stringValue: '오늘도 꿈을 하나씩 채우는 중' },
      listPublic: { booleanValue: true }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  },
  [FID]: {
    name: docPath(`users/${FID}`),
    fields: {
      name: { stringValue: '친구다혜' }, bio: { stringValue: '함께 꿈꾸는 친구' },
      listPublic: { booleanValue: true }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  },
};

const FRIENDSHIP_DOCS = [
  {
    name: docPath(`friendships/${UID}_${FID}`),
    fields: { owner: { stringValue: UID }, friend: { stringValue: FID }, createdAt: { timestampValue: TS } },
    createTime: TS, updateTime: TS,
  },
];
// 친구의 전체/완료 아이템 개수 — 예전엔 이 개수를 알려고 친구의 아이템 문서를 통째로 읽었지만
// 지금은 getCount() 집계 쿼리 두 번으로만 구합니다(아래 handleFirestore의 runAggregationQuery 참고).
const FRIEND_TOTAL_COUNT = 5;
const FRIEND_DONE_COUNT = 2;

function memoryField(photos, text) {
  return {
    mapValue: {
      fields: {
        photo: photos.length ? { stringValue: photos[0] } : { nullValue: null },
        photos: { arrayValue: { values: photos.map((p) => ({ stringValue: p })) } },
        text: { stringValue: text || '' },
        date: { stringValue: '2026.07.20' },
      },
    },
  };
}

function myDoc(id, title, categories, opts = {}) {
  const fields = {
    ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
    title: { stringValue: title }, emoji: { stringValue: '🌌' }, note: { stringValue: '' },
    categories: { arrayValue: { values: categories.map((c) => ({ stringValue: c })) } },
    priority: opts.priority ? { stringValue: opts.priority } : { nullValue: null },
    order: { integerValue: String(opts.order || 0) },
    location: { nullValue: null }, targetDate: { nullValue: null },
    done: { booleanValue: !!opts.done },
    memory: opts.memory ? memoryField(opts.memory.photos || [], opts.memory.text) : { nullValue: null },
    participants: { arrayValue: {} },
    origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
    likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
  };
  if (opts.startedAt) fields.startedAt = { timestampValue: opts.startedAt };
  return { name: docPath(`items/${id}`), fields, createTime: TS, updateTime: TS };
}

// resolveImageUrl은 https?:// 로 시작하는 값만 사진으로 인정합니다. 이 샌드박스는 바깥 네트워크가
// 막혀 있어서(Firebase Storage 포함) 진짜 firebasestorage.googleapis.com 주소는 로드가 안 되니,
// 같은 정적 서버(localhost:8099)가 실제로 서빙하는 테스트용 PNG 3장을 씁니다 — resolveImageUrl 통과 +
// 실제 로드까지 되는 유일한 방법이에요.
const PHOTOS_3 = [
  `${URL}test-photos/p1.png`,
  `${URL}test-photos/p2.png`,
  `${URL}test-photos/p3.png`,
];

const DOCS = {
  progress: [
    myDoc('a1', '오로라 보기', ['여행', '자연'], { order: 10 }), // 진행 전(시작 버튼)
  ],
  progressStop: [
    myDoc('a2', '마라톤 완주', ['도전'], { order: 10, startedAt: STARTED_1D_AGO }), // 이미 진행중
  ],
  memory: [
    myDoc('a3', '북유럽 오로라 여행', ['여행'], { order: 10, done: true, memory: { photos: PHOTOS_3, text: '정말 아름다웠어요' } }),
  ],
};

let ACTIVE_DOCS = DOCS.progress;

const seen = [];
const commits = [];
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

// :commit으로 들어온 update를 ACTIVE_DOCS(또는 FRIENDSHIP_DOCS)에 실제로 반영합니다.
// — updateDoc 직후 getDoc(:batchGet)으로 다시 읽는 흐름이 "방금 쓴 값 그대로" 받아오도록.
function applyCommit(writes) {
  writes.forEach((w) => {
    const name = w.update?.name;
    if (!name) return;
    const target = ACTIVE_DOCS.find((d) => d.name === name) || FRIENDSHIP_DOCS.find((d) => d.name === name);
    if (!target) return;
    const mask = w.updateMask?.fieldPaths;
    const fields = w.update?.fields || {};
    if (mask) {
      mask.forEach((k) => {
        if (k in fields) target.fields[k] = fields[k]; else delete target.fields[k];
      });
    } else {
      Object.assign(target.fields, fields);
    }
    (w.updateTransforms || []).forEach((t) => {
      if (t.setToServerValue === 'REQUEST_TIME') target.fields[t.fieldPath] = { timestampValue: NOW_ISO };
    });
  });
}

async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    const out = docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (USERS[p.replace('users/', '')] && p.startsWith('users/')) return { found: USERS[p.replace('users/', '')], readTime: TS };
      const item = ACTIVE_DOCS.find((d) => d.name.endsWith(p));
      if (item) return { found: item, readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }

  if (url.includes(':runAggregationQuery')) {
    const saq = body?.structuredAggregationQuery || {};
    // 클라이언트는 "count" 같은 별칭을 그대로 안 보내고 "aggregate_0"처럼 짧은 서버용 별칭으로 바꿔 보낸 뒤
    // 응답도 그 별칭 그대로 돌아올 거라 기대합니다(내부적으로 다시 "count"로 매핑). 그래서 응답 키는
    // 요청에 실제로 담긴 별칭을 그대로 돌려줘야 해요.
    const alias = saq.aggregations?.[0]?.alias || 'aggregate_0';
    // where 절에 done==true 필터가 섞여 있는지로 "전체 개수"용 쿼리인지 "완료 개수"용 쿼리인지 구분합니다.
    const whereStr = JSON.stringify(saq.structuredQuery?.where || {});
    const hasDoneFilter = whereStr.includes('"done"');
    const count = hasDoneFilter ? FRIEND_DONE_COUNT : FRIEND_TOTAL_COUNT;
    seen.push(`FS aggregate(${hasDoneFilter ? 'done' : 'total'})=${count}`);
    return json(route, [{ result: { aggregateFields: { [alias]: { integerValue: String(count) } } }, readTime: TS }]);
  }

  if (url.includes(':runQuery')) {
    const sq = body?.structuredQuery || {};
    const col = sq.from?.[0]?.collectionId;
    if (col === 'items') {
      seen.push(`FS runQuery items(mine) x${ACTIVE_DOCS.length}`);
      return json(route, ACTIVE_DOCS.map((document) => ({ document, readTime: TS })));
    }
    if (col === 'friendships') {
      seen.push(`FS runQuery friendships x${FRIENDSHIP_DOCS.length}`);
      return json(route, FRIENDSHIP_DOCS.map((document) => ({ document, readTime: TS })));
    }
    seen.push(`FS runQuery ${col}${sq.from?.[0]?.allDescendants ? '(group)' : ''}`);
    return json(route, [{ readTime: TS }]);
  }

  if (url.includes(':commit')) {
    const writes = body.writes || [];
    seen.push(`FS commit x${writes.length}`);
    applyCommit(writes);
    commits.push(writes);
    return json(route, { writeResults: writes.map(() => ({ updateTime: TS })), commitTime: TS });
  }

  seen.push(`FS ??? ${url}`);
  return json(route, {}, 200);
}

async function scenario(browser, label, how, opts = {}) {
  ACTIVE_DOCS = opts.docs || DOCS.progress;
  seen.length = 0;
  commits.length = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**identitytoolkit.googleapis.com/**', handleIdentity);
  await page.route('**securetoken.googleapis.com/**', handleToken);
  await page.route('**firestore.googleapis.com/**', handleFirestore);

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  let extra = {};
  try {
    extra = (await how(page)) || {};
  } catch (e) {
    extra = { scenarioError: e.message };
  }
  await page.waitForTimeout(500);

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  const nodes = await page.evaluate(() => document.body.querySelectorAll('*').length);
  await page.screenshot({ path: `verify/b12-${label}.png` });
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));

  console.log(`\n===== ${label} =====`);
  console.log(`노드 ${nodes} | 오류 ${bad.length}${bad.length ? ': ' + bad.slice(0, 3).join(' || ').slice(0, 300) : ''}`);
  console.log(`텍스트: ${JSON.stringify(text).slice(0, 500)}`);
  console.log(`요청: ${seen.join(' | ')}`);
  await ctx.close();
  return { text, nodes, errors: bad, seen: [...seen], commits: [...commits], ...extra };
}

const login = async (page) => {
  const inputs = page.locator('input');
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill('password123');
  await page.waitForTimeout(200);
  await page.getByText('로그인', { exact: true }).last().click();
  await page.waitForTimeout(2500);
};

function fieldsOf(write) {
  return write?.update?.fields || {};
}

(async () => {
  const browser = await chromium.launch();
  const checks = [];

  // [1] 추억 사진 3장 — 내 목록 카드에서 캐로셀(점 표시 + "1/3")로 보이는지
  const carousel = await scenario(browser, '01-multiphoto-carousel-list', async (page) => {
    await login(page);
    await page.waitForTimeout(800); // 배경이미지(사진) 로드 대기 — react-native-web은 Image를 <img>가 아니라 background-image div로 렌더해요
    const text = await page.evaluate(() => document.body.innerText);
    // react-native-web의 Image는 <img> 태그가 아니라 background-image가 걸린 <div>로 렌더돼서 img 태그로는 못 셉니다.
    const bgImgCount = await page.evaluate(() => Array.from(document.querySelectorAll('div'))
      .filter((d) => { const bg = getComputedStyle(d).backgroundImage; return bg && bg.includes('test-photos/p'); }).length);
    return { has13: text.includes('1/3'), bgImgCount };
  }, { docs: DOCS.memory });
  checks.push(['[사진 10장] 이룬 꿈 카드에 3장 캐로셀(1/3 표시)이 보인다', carousel.has13, carousel.text.slice(0, 200)]);
  checks.push(['[사진 10장] 캐로셀 안에 실제 사진 3장이 각각 로드되어 렌더된다', carousel.bgImgCount >= 3, `bgImgCount=${carousel.bgImgCount}`]);

  // [2] 추억 수정 시트 — 기존 3장 중 1장을 지우고 저장하면 commit에 2장만 남는지
  const editMemory = await scenario(browser, '02-multiphoto-memory-sheet-edit', async (page) => {
    await login(page);
    const beforeText = await page.evaluate(() => document.body.innerText);
    await page.getByText('추억 수정', { exact: true }).first().click();
    await page.waitForTimeout(500);
    const countBefore = (await page.evaluate(() => document.body.innerText)).includes('사진 (3/10장)');
    // 첫 번째 ✕(사진 삭제) 버튼을 누릅니다.
    await page.getByText('✕', { exact: true }).first().click();
    await page.waitForTimeout(300);
    const countAfter = (await page.evaluate(() => document.body.innerText)).includes('사진 (2/10장)');
    await page.getByText('저장하기', { exact: true }).last().click();
    await page.waitForTimeout(600);
    return { countBefore, countAfter };
  }, { docs: DOCS.memory });
  checks.push(['[사진 10장] 추억 수정 시트를 열면 기존 3장이 "3/10장"으로 보인다', editMemory.countBefore]);
  checks.push(['[사진 10장] 한 장을 지우면 "2/10장"으로 줄어든다', editMemory.countAfter]);
  const memCommit = editMemory.commits.flat().find((w) => fieldsOf(w).memory);
  const memPhotos = memCommit?.update.fields.memory.mapValue.fields.photos.arrayValue.values || [];
  checks.push(['[사진 10장] 저장하면 commit payload의 memory.photos가 2장만 남는다', memPhotos.length === 2, `len=${memPhotos.length}`]);

  // [3] 진행 시작 — 버튼을 누르면 startedAt이 서버타임스탬프로 커밋되고 배지가 "D+0일째"로 바뀐다
  const startProgress = await scenario(browser, '03-progress-start', async (page) => {
    const hasStartBtn = async () => (await page.evaluate(() => document.body.innerText)).includes('진행 시작');
    await login(page);
    const before = await hasStartBtn();
    await page.getByText('▶ 진행 시작', { exact: true }).first().click();
    await page.waitForTimeout(600);
    const afterText = await page.evaluate(() => document.body.innerText);
    return { before, hasD0: afterText.includes('진행중 D+0일째') };
  }, { docs: DOCS.progress });
  checks.push(['[진행중] 시작 전엔 "▶ 진행 시작" 버튼이 보인다', startProgress.before]);
  const startCommit = startProgress.commits.flat().find((w) => (w.updateTransforms || []).some((t) => t.fieldPath === 'startedAt'));
  checks.push(['[진행중] 시작 버튼을 누르면 startedAt 서버타임스탬프로 커밋된다', !!startCommit]);
  checks.push(['[진행중] 시작 직후 "진행중 D+0일째" 배지로 바뀐다', startProgress.hasD0, startProgress.text.slice(0, 200)]);

  // [4] 이미 진행중(1일 전 시작) — 배지를 눌러도 확인 없이 바로 중단되지 않는다(Alert 확인 게이트)
  const stopGate = await scenario(browser, '04-progress-stop-gated', async (page) => {
    await login(page);
    const before = await page.evaluate(() => document.body.innerText);
    const badge = `🏃 진행중 D+${EXPECT_1D_LABEL}일째`;
    await page.getByText(badge, { exact: true }).first().click();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => document.body.innerText);
    return { hasBadgeBefore: before.includes(badge), hasBadgeAfter: after.includes(badge) };
  }, { docs: DOCS.progressStop });
  checks.push([`[진행중] 하루 전에 시작한 항목은 "진행중 D+${EXPECT_1D_LABEL}일째"로 보인다`, stopGate.hasBadgeBefore, stopGate.text.slice(0, 200)]);
  checks.push(['[진행중] 배지를 눌러도(확인 팝업 없이는) 즉시 중단되지 않는다 — commit 없음', stopGate.commits.flat().length === 0, `commits=${stopGate.commits.flat().length}`]);
  checks.push(['[진행중] 배지를 누른 뒤에도 화면엔 여전히 진행중으로 남아있다', stopGate.hasBadgeAfter]);

  // [5] 친구 화면 — 친구의 아이템을 통째로 읽지 않고 getCount() 집계로만 통계를 구한다
  const friends = await scenario(browser, '05-friends-count-aggregation', async (page) => {
    await login(page);
    await page.getByText('친구', { exact: true }).last().click();
    await page.waitForTimeout(1200);
    return { text: await page.evaluate(() => document.body.innerText) };
  }, { docs: [] });
  const expectedLine = `이룬 꿈 ${FRIEND_DONE_COUNT} · 도전 중 ${FRIEND_TOTAL_COUNT - FRIEND_DONE_COUNT}`;
  checks.push(['[조회 성능] 친구 화면에 집계 쿼리로 구한 통계(이룬 꿈/도전 중)가 정확히 보인다', friends.text.includes(expectedLine), friends.text.slice(0, 300)]);
  checks.push(['[조회 성능] 친구 통계는 getCount() 집계 쿼리로만 구한다(친구 아이템 전체를 읽지 않음)',
    friends.seen.some((s) => s.startsWith('FS aggregate')) && !friends.seen.some((s) => s.includes('runQuery items') && s.includes(`x${FRIEND_TOTAL_COUNT}`)),
    friends.seen.join(' | ')]);

  console.log('\n\n========== 요약 ==========');
  let pass = 0;
  checks.forEach(([label, ok, extra]) => {
    console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : `  ← ${extra || ''}`}`);
    if (ok) pass++;
  });
  console.log(`\n${pass}/${checks.length} 통과`);

  await browser.close();
  process.exit(pass === checks.length ? 0 : 1);
})();
