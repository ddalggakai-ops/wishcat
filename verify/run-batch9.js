// 이번 배치(9개 수정)로 새로 생긴 화면/동작이 실제로 렌더되고 눌리는지 검증합니다.
// run-signed-in.js 와 같은 방식(Firebase REST 목킹 + 실제 웹 빌드 조작)으로 돌립니다.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';
const UID = 'verifyUid000000000000';
const OTHER = 'otherUid00000000000000';
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

/** 다른 사람이 올린 전체공개 아이템 — 둘러보기/상세/담기 검증용 */
function exploreDoc(id, title, emoji, opts = {}) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: OTHER },
      ownerPublic: { booleanValue: true },
      title: { stringValue: title },
      emoji: { stringValue: emoji },
      note: { stringValue: '같이 하면 더 재밌어요' },
      category: { stringValue: '여행' },
      location: { nullValue: null },
      targetDate: opts.targetDate ? { stringValue: opts.targetDate } : { nullValue: null },
      done: { booleanValue: !!opts.done },
      memory: { nullValue: null },
      // Firestore 에는 참여자를 uid 문자열 배열로 저장합니다 (RawItem.participants: string[])
      participants: opts.joined
        ? { arrayValue: { values: [{ stringValue: UID }] } }
        : { arrayValue: {} },
      origin: { stringValue: 'own' },
      helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '7' },
      savesCount: { integerValue: '2' },
      createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}

const EXPLORE_DOCS = [
  exploreDoc('ex1', '산티아고 순례길 걷기', '🥾', { targetDate: '2027-05-01' }),
  exploreDoc('ex2', '이미 함께하는 꿈', '🎒', { joined: true }),
];

/** 내 아이템 (목표일 있는 것 하나) */
const MY_DOC = {
  name: docPath('items/mine-1'),
  fields: {
    ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
    title: { stringValue: '오로라 보기' }, emoji: { stringValue: '🌌' }, note: { stringValue: '' },
    category: { stringValue: '여행' }, location: { nullValue: null },
    targetDate: { stringValue: '2027-01-01' },
    done: { booleanValue: false }, memory: { nullValue: null }, participants: { arrayValue: {} },
    origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
    likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
  },
  createTime: TS, updateTime: TS,
};

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
  if (url.includes('accounts:sendOobCode')) return json(route, { email: EMAIL });
  return json(route, { error: { code: 400, message: 'UNEXPECTED', status: 'INVALID_ARGUMENT' } }, 400);
}

const handleToken = (route) => {
  seen.push('AUTH securetoken');
  return json(route, { access_token: JWT, expires_in: '3600', token_type: 'Bearer', refresh_token: 'r', id_token: JWT, user_id: UID, project_id: PROJECT });
};

let MINE_EMPTY = false;

async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    const out = docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS };
      if (p.startsWith('users/')) {
        return { found: { ...USER_DOC, name: full, fields: { ...USER_DOC.fields, name: { stringValue: '길동' } } }, readTime: TS };
      }
      if (p === 'items/mine-1') return { found: MY_DOC, readTime: TS };
      const ex = EXPLORE_DOCS.find((d) => d.name.endsWith(`/${p}`));
      if (ex) return { found: ex, readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }

  if (url.includes(':runQuery')) {
    const sq = body?.structuredQuery || {};
    const col = sq.from?.[0]?.collectionId;
    const filters = JSON.stringify(sq.where || {});
    if (col === 'items') {
      // 둘러보기 쿼리인지(ownerPublic) 내 목록 쿼리인지(ownerId) 구분합니다.
      if (filters.includes('ownerPublic')) {
        seen.push('FS runQuery items(explore)');
        return json(route, EXPLORE_DOCS.map((document) => ({ document, readTime: TS })));
      }
      seen.push('FS runQuery items(mine)');
      if (MINE_EMPTY) return json(route, [{ readTime: TS }]);
      return json(route, [{ document: MY_DOC, readTime: TS }]);
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

async function scenario(browser, label, how, opts = {}) {
  MINE_EMPTY = !!opts.mineEmpty;
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
  const extra = (await how(page)) || {};
  await page.waitForTimeout(2500);

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  const nodes = await page.evaluate(() => document.body.querySelectorAll('*').length);
  await page.screenshot({ path: `verify/b9-${label}.png` });
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));

  console.log(`\n===== ${label} =====`);
  console.log(`노드 ${nodes} | 오류 ${bad.length}${bad.length ? ': ' + bad.slice(0, 3).join(' || ').slice(0, 300) : ''}`);
  console.log(`텍스트: ${JSON.stringify(text).slice(0, 700)}`);
  console.log(`요청: ${seen.join(' | ')}`);
  await ctx.close();
  return { text, nodes, errors: bad, seen: [...seen], ...extra };
}

// 토스트는 2.2초 뒤 스스로 사라지기 때문에, 마지막 한 컷만 찍으면 놓칩니다.
// 지정한 시간 동안 화면 텍스트를 계속 모아서 "그 사이에 떴는지"를 봅니다.
async function captureDuring(page, ms, step = 120) {
  const end = Date.now() + ms;
  let acc = '';
  while (Date.now() < end) {
    acc += ' ' + (await page.evaluate(() => document.body.innerText));
    await page.waitForTimeout(step);
  }
  return acc.replace(/\s+/g, ' ').trim();
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

  // ② 비밀번호 마스킹 · 이메일 키보드 · 재설정
  const auth = await scenario(browser, '01-auth', async (page) => {
    const types = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input')).map((i) => `${i.type}:${i.getAttribute('inputmode') || '-'}:${i.getAttribute('autocomplete') || '-'}`));
    // 눈 아이콘을 눌러 마스킹 해제가 되는지
    await page.getByText('👁', { exact: false }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    const typesAfter = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map((i) => i.type));
    return { types, typesAfter };
  });

  const reset = await scenario(browser, '02-reset', async (page) => {
    await page.getByText('비밀번호를 잊으셨나요?', { exact: false }).first().click();
    await page.waitForTimeout(500);
    await page.locator('input').first().fill(EMAIL);
    await page.waitForTimeout(200);
    await page.getByText('재설정 메일 보내기', { exact: false }).first().click();
  });

  // ⑦ 시작 템플릿
  const starter = await scenario(browser, '03-starter', async (page) => {
    await login(page);
    await page.getByText('시작 템플릿에서 골라 담기', { exact: false }).first().click();
    await page.waitForTimeout(800);
  }, { mineEmpty: true });

  const starterAdd = await scenario(browser, '04-starter-add', async (page) => {
    await login(page);
    await page.getByText('시작 템플릿에서 골라 담기', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByText('전체 해제', { exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.getByText('오로라 보러 가기', { exact: true }).first().click();
    await page.waitForTimeout(300);
    const label = (await page.evaluate(() => document.body.innerText)).match(/(\d+)개 담기/);
    await page.getByText('개 담기', { exact: false }).first().click();
    const toast = await captureDuring(page, 2600);
    return { pickLabel: label ? label[0] : null, toast };
  }, { mineEmpty: true });

  // ⑥ 목표일 입력 UI
  const target = await scenario(browser, '05-targetdate', async (page) => {
    await login(page);
    await page.getByText('＋', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.getByText('3개월 뒤', { exact: true }).first().click();
    await page.waitForTimeout(400);
    const filled = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('input')).find((i) => (i.placeholder || '').includes('YYYY-MM-DD'));
      return el ? el.value : null;
    });
    return { filled };
  });

  // ④ 둘러보기 → 상세 → 담기 / ⑤ 함께하는 중 표시
  const explore = await scenario(browser, '06-explore', async (page) => {
    await login(page);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(2500);
  });

  const detail = await scenario(browser, '07-detail', async (page) => {
    await login(page);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(2500);
    await page.getByText('산티아고 순례길 걷기', { exact: false }).first().click();
    await page.waitForTimeout(1000);
  });

  const detailJoined = await scenario(browser, '08-detail-joined', async (page) => {
    await login(page);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(2500);
    await page.getByText('이미 함께하는 꿈', { exact: false }).first().click();
    await page.waitForTimeout(1000);
  });

  const join = await scenario(browser, '09-join', async (page) => {
    await login(page);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(2500);
    await page.getByText('산티아고 순례길 걷기', { exact: false }).first().click();
    await page.waitForTimeout(1000);
    await page.getByText('내 목록에 담기', { exact: true }).first().click();
    const toast = await captureDuring(page, 3000);
    return { toast };
  });

  // ⑧ 신고/차단
  const report = await scenario(browser, '10-report', async (page) => {
    await login(page);
    await page.getByText('둘러보기', { exact: true }).last().click();
    await page.waitForTimeout(2500);
    await page.getByText('산티아고 순례길 걷기', { exact: false }).first().click();
    await page.waitForTimeout(1000);
    await page.getByText('신고 · 차단하기', { exact: false }).first().click();
    await page.waitForTimeout(1000);
  });

  // ⑧ 계정 삭제
  const del = await scenario(browser, '11-delete', async (page) => {
    await login(page);
    await page.getByText('프로필 편집', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByText('계정 삭제', { exact: true }).first().click();
    await page.waitForTimeout(600);
  });

  await browser.close();

  const checks = [
    ['[②] 비밀번호 칸이 마스킹(type=password)된다', auth.types.some((t) => t.startsWith('password')), auth.types.join(' | ')],
    ['[②] 이메일 칸에 email 자동완성/키보드 힌트가 붙는다', auth.types.some((t) => t.includes('email')), auth.types.join(' | ')],
    ['[②] 👁 를 누르면 비밀번호가 보인다(text로 바뀜)', auth.typesAfter.every((t) => t !== 'password'), auth.typesAfter.join(' | ')],
    ['[②] 로그인 화면에 "비밀번호를 잊으셨나요?"가 있다', /비밀번호를 잊으셨나요/.test(auth.text), ''],
    ['[②] 재설정 화면이 열린다', /재설정 메일 보내기/.test(reset.text), reset.text.slice(0, 200)],
    ['[②] 재설정 메일 요청이 실제로 나간다(sendOobCode)', reset.seen.some((s) => s.includes('sendOobCode')), reset.seen.join(' | ')],
    ['[②] 재설정 후 안내 문구가 뜬다', /메일함|재설정 메일을 보냈어요/.test(reset.text), reset.text.slice(0, 300)],

    ['[⑦] 빈 목록에서 시작 템플릿 버튼이 보인다', /시작 템플릿에서 골라 담기/.test(starterAdd.text) || /시작 템플릿/.test(starter.text), starter.text.slice(0, 200)],
    ['[⑦] 템플릿 시트가 열리고 묶음 4개가 보인다', /언젠가 떠나고 싶어/.test(starter.text) && /올해는 이것만은/.test(starter.text) && /친구랑 같이/.test(starter.text) && /한 번쯤은 용기내서/.test(starter.text), starter.text.slice(0, 300)],
    ['[⑦] 템플릿 항목이 목록으로 뜬다', /오로라 보러 가기/.test(starter.text), ''],
    ['[⑦] 개별 선택이 반영된다(1개 담기)', starterAdd.pickLabel === '1개 담기', String(starterAdd.pickLabel)],
    ['[⑦] 담기를 누르면 실제 쓰기(commit)가 나간다', starterAdd.seen.some((s) => s.startsWith('FS commit x')), starterAdd.seen.join(' | ')],
    ['[⑦] 담은 뒤 안내 토스트가 뜬다', /꿈 \d+개를 담았어요/.test(starterAdd.toast || ''), (starterAdd.toast || '').slice(-200)],

    ['[⑥] 새 꿈 시트에 목표일 입력이 있다', /목표일/.test(target.text), target.text.slice(0, 300)],
    ['[⑥] "3개월 뒤" 프리셋이 날짜를 채운다', !!target.filled && /^\d{4}-\d{2}-\d{2}$/.test(target.filled), String(target.filled)],
    ['[⑥] 목표일 안내 문구가 보인다', /하루 전 오전 9시/.test(target.text), ''],
    ['[⑥] 내 목록 카드에 D-day 배지가 보인다', /D-\d+|D-DAY/.test(explore.text) || /D-\d+/.test(target.text), target.text.slice(0, 400)],

    ['[⑨] 둘러보기가 ownerPublic 쿼리를 쓴다', explore.seen.includes('FS runQuery items(explore)'), explore.seen.join(' | ')],
    ['[⑨] 좋아요를 collectionGroup으로 한 번에 읽으려 시도한다', explore.seen.some((s) => s.includes('likes(group)')), explore.seen.join(' | ')],
    ['[④] 둘러보기에 남의 꿈이 보인다', /산티아고 순례길 걷기/.test(explore.text), explore.text.slice(0, 300)],
    ['[④] 타일을 누르면 상세 시트가 열린다', /님의 꿈/.test(detail.text) && /프로필 보기/.test(detail.text), detail.text.slice(0, 300)],
    ['[④] 상세에 "내 목록에 담기" 버튼이 있다', /내 목록에 담기/.test(detail.text), ''],
    ['[④] 담기를 누르면 실제 쓰기(commit)가 나간다', join.seen.some((s) => s.startsWith('FS commit x')), join.seen.join(' | ')],
    ['[④] 담은 뒤 토스트가 뜬다', /내 목록에 담았어요/.test(join.toast || ''), (join.toast || '').slice(-200)],
    ['[⑤] 이미 함께하는 꿈은 "담았어요"로 표시된다', /이미 내 목록에 담았어요/.test(detailJoined.text), detailJoined.text.slice(0, 400)],
    ['[⑤] 이미 함께하는 꿈에 "함께하기 취소"가 있다', /함께하기 취소/.test(detailJoined.text), ''],
    ['[⑥] 상세에 D-day가 보인다', /D-\d+|D-DAY|일 지남/.test(detail.text), detail.text.slice(0, 400)],

    ['[⑧] 신고 시트가 열린다', /신고하기/.test(report.text), report.text.slice(0, 300)],
    ['[⑧] 신고 사유 목록이 보인다', /괴롭힘이나 혐오 표현/.test(report.text) && /스팸/.test(report.text), ''],
    ['[⑧] 차단 버튼이 있다', /차단하기/.test(report.text), ''],
    ['[⑧] 프로필에 계정 삭제가 있다', /계정 삭제/.test(del.text), del.text.slice(-300)],
    ['[⑧] 계정 삭제를 누르면 비밀번호 확인 UI가 뜬다', /계정 영구 삭제/.test(del.text), del.text.slice(-300)],

    ['[전체] 새 화면들에서 콘솔 치명적 오류 없음',
      [auth, reset, starter, starterAdd, target, explore, detail, detailJoined, join, report, del].every((r) => r.errors.length === 0),
      [auth, reset, starter, starterAdd, target, explore, detail, detailJoined, join, report, del].flatMap((r) => r.errors).join(' || ').slice(0, 400)],
  ];

  console.log('\n\n========== 판정 ==========');
  for (const [n, p, d] of checks) console.log(`${p ? 'PASS' : 'FAIL'} — ${n}${!p && d ? `  ⟨${d}⟩` : ''}`);
  const failed = checks.filter((x) => !x[1]).length;
  console.log(`\n${checks.length - failed}/${checks.length} 통과`);
  process.exit(failed ? 1 : 0);
})();
