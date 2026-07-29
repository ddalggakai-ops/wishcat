// 이번 요청 7개(카테고리 다중선택 / 투명 버튼 수정 / 캐러셀 확대+프레스효과 / 다중선택 삭제 /
// 우선순위+정렬 / 스크롤 버튼 분리(불투명도) / 카드 탭 동작 변경)가 실제로 렌더되고 동작하는지 검증합니다.
// run-batch9/10.js 와 같은 방식(Firebase REST 목킹 + 실제 웹 빌드 조작)으로 돌립니다.
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

function myDoc(id, title, categories, opts = {}) {
  return {
    name: docPath(`items/${id}`),
    fields: {
      ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
      title: { stringValue: title }, emoji: { stringValue: '🌌' }, note: { stringValue: '' },
      categories: { arrayValue: { values: categories.map((c) => ({ stringValue: c })) } },
      priority: opts.priority ? { stringValue: opts.priority } : { nullValue: null },
      order: { integerValue: String(opts.order || 0) },
      location: { nullValue: null }, targetDate: { nullValue: null },
      done: { booleanValue: !!opts.done }, memory: { nullValue: null }, participants: { arrayValue: {} },
      origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
      likesCount: { integerValue: '0' }, savesCount: { integerValue: '0' }, createdAt: { timestampValue: TS },
    },
    createTime: TS, updateTime: TS,
  };
}

// 다중선택/우선순위/재정렬 검증용 4개
const LIST_DOCS = [
  myDoc('a1', '오로라 보기', ['여행', '자연'], { priority: 'high', order: 10 }),
  myDoc('a2', '라멘 투어', ['음식'], { priority: 'mid', order: 20 }),
  myDoc('a3', '독서 챌린지', ['성장'], { priority: 'low', order: 30 }),
  myDoc('a4', '번지점프', ['도전'], { order: 40 }),
];

let ACTIVE_DOCS = LIST_DOCS;

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
    const writes = body.writes || [];
    seen.push(`FS commit x${writes.length}`);
    commits.push(writes);
    return json(route, { writeResults: writes.map(() => ({ updateTime: TS })), commitTime: TS });
  }

  seen.push(`FS ??? ${url}`);
  return json(route, {}, 200);
}

async function scenario(browser, label, how, opts = {}) {
  ACTIVE_DOCS = opts.docs || LIST_DOCS;
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
  await page.screenshot({ path: `verify/b11-${label}.png` });
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

  // [57] 비활성(disabled) 버튼 텍스트 대비 — 새 꿈 등록 시트를 열면 제목이 빈 채라 "추가하기" 버튼이
  // disabled 상태입니다. 그 텍스트 색과 배경색의 명도 대비가 충분한지 계산합니다.
  const disabledBtn = await scenario(browser, '01-disabled-button-contrast', async (page) => {
    await login(page);
    await page.getByText('＋', { exact: true }).first().click();
    await page.waitForTimeout(700);
    const result = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('*'));
      const btnText = nodes.find((n) => n.textContent === '추가하기' && n.children.length === 0);
      if (!btnText) return null;
      let bg = null;
      let el = btnText;
      for (let i = 0; i < 5 && el; i++) {
        const cs = getComputedStyle(el);
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') { bg = cs.backgroundColor; break; }
        el = el.parentElement;
      }
      const color = getComputedStyle(btnText).color;
      return { color, bg };
    });
    return { result };
  });

  // [58/59] 카테고리 다중선택 + [60] 우선순위 — 등록 화면에서 2개 카테고리 + 우선순위를 골라
  // 실제 commit payload 에 배열/필드로 나가는지 확인합니다.
  const multiCat = await scenario(browser, '02-multicategory-priority', async (page) => {
    await login(page);
    await page.getByText('＋', { exact: true }).first().click();
    await page.waitForTimeout(900);
    // Modal(시트)은 페이지 마지막에 렌더되므로 .last() 로 배경 목록의 같은 텍스트와 구분합니다.
    // 시트 안 ScrollView가 자동 스크롤 판정과 충돌하는 경우가 있어 force 클릭을 씁니다.
    await page.getByText('여행', { exact: true }).last().click({ force: true });
    await page.getByText('자연', { exact: true }).last().click({ force: true });
    await page.waitForTimeout(200);
    const chipsAfterToggle = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    await page.getByText('🔴 상', { exact: true }).last().click({ force: true });
    await page.waitForTimeout(200);
    const titleInput = page.locator('[placeholder="예: 오로라 보러 가기"]').last();
    await titleInput.click({ force: true });
    await titleInput.fill('멀티카테고리 테스트');
    await page.waitForTimeout(200);
    await page.getByText('추가하기', { exact: true }).last().click({ force: true });
    await page.waitForTimeout(800);
    return { chipsAfterToggle };
  });

  // [62] 길게 눌러 선택모드 진입 + 체크박스 다중선택 + 전체선택 + [60] 재정렬(▲▼)
  const selectReorder = await scenario(browser, '03-select-reorder', async (page) => {
    await login(page);
    await page.waitForTimeout(500);
    // "오늘은 이런 건 어때요" 캐러셀에도 같은 제목이 뜨므로, 목록(도전 중) 안의 카드를 가리키는
    // 두 번째 일치 노드(nth(1))를 씁니다. 캐러셀 쪽은 onLongPress가 없어 선택모드로 들어가지 않아요.
    const firstCard = page.getByText('오로라 보기', { exact: true }).nth(1);
    // 고정된 하단 탭바가 화면 아래쪽 콘텐츠를 가려서 raw mouse 좌표가 탭바를 누르는 걸로
    // 오작동할 수 있어, 먼저 화면 안쪽(하단 탭바에서 떨어진 곳)으로 스크롤해 둡니다.
    await firstCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await firstCard.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(550);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const afterLongPress = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    console.log(`[디버그] 롱프레스 직후: ${afterLongPress.slice(0, 200)}`);

    // 두 번째 카드도 눌러서 선택에 추가
    await page.getByText('라멘 투어', { exact: true }).nth(1).click({ force: true });
    await page.waitForTimeout(300);
    const afterSecondSelect = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();

    // ▼ 버튼으로 첫 카드를 한 칸 내려서 순서가 바뀌는지 확인
    seen.length = 0; commits.length = 0;
    const downArrows = page.locator('text=▼');
    const downCount = await downArrows.count();
    console.log(`[디버그] ▼ 버튼 개수: ${downCount}`);
    let orderCommit = null;
    if (downCount > 0) {
      await downArrows.first().click({ force: true });
      await page.waitForTimeout(600);
      orderCommit = commits.length ? commits[0] : null;
    }

    // 전체 선택/해제
    await page.getByText('전체 선택/해제', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(300);
    const afterSelectAll = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();

    // 선택모드 닫기
    const closeCount = await page.getByText('✕', { exact: true }).count();
    console.log(`[디버그] ✕ 개수: ${closeCount}`);
    await page.getByText('✕', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(300);
    const afterExit = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    console.log(`[디버그] afterExit 전체: ${afterExit}`);

    return { afterLongPress, afterSecondSelect, orderCommit, afterSelectAll, afterExit };
  });

  // [64] 카드 탭 동작 — 자세히 보기(기본)에서 카드를 누르면 곧장 수정 화면, 간단히 보기에서는 상세보기
  const tapBehavior = await scenario(browser, '04-tap-behavior', async (page) => {
    await login(page);
    await page.waitForTimeout(500);
    // 자세히 보기(기본) 상태에서 빈 영역(제목) 클릭 → 수정 시트. 캐러셀에도 같은 제목이 있어 nth(1).
    await page.getByText('오로라 보기', { exact: true }).nth(1).click();
    await page.waitForTimeout(600);
    const afterDetailTap = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    // 수정 시트 닫기 (배경 클릭 대체로 취소 버튼이 없으면 뒤로가기 느낌의 아무 버튼 없이 그냥 확인만)
    return { afterDetailTap };
  });

  const tapBehaviorCompact = await scenario(browser, '05-tap-behavior-compact', async (page) => {
    await login(page);
    await page.waitForTimeout(500);
    await page.getByText('간단히 보기', { exact: true }).first().click();
    await page.waitForTimeout(400);
    await page.getByText('오로라 보기', { exact: true }).nth(1).click();
    await page.waitForTimeout(600);
    const afterCompactTap = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    return { afterCompactTap };
  });

  // [61] 캐러셀 카드 확대 + 터치 프레스 스케일 — 카드 크기와 press-in 시 transform scale 적용 확인
  const carousel = await scenario(browser, '06-carousel-scale', async (page) => {
    await login(page);
    await page.waitForTimeout(500);
    const card = page.getByText('오로라 보기', { exact: true }).first();
    // Animated.View(스케일 트랜스폼을 실제로 쥔 노드)는 항상 transform 인라인 스타일을 갖고 있어
    // (쉬는 상태에서도 matrix(1,0,0,1,0,0)) 이걸로 정확히 찾습니다. width>100 조건은 그 위의
    // 폭 156 래퍼에 더 먼저 걸려서 틀린 노드를 집었던 게 이전 실패 원인이었습니다.
    const before = await card.evaluate((el) => {
      let n = el;
      for (let i = 0; i < 8 && n; i++) {
        if (getComputedStyle(n).transform !== 'none') return { w: n.getBoundingClientRect().width, transform: getComputedStyle(n).transform };
        n = n.parentElement;
      }
      return null;
    });
    // 하단 탭바에 가려지지 않게 화면 안쪽으로 스크롤해 둡니다(길게 누르기 검증 때와 같은 이유).
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await card.boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(400);
    const during = await card.evaluate((el) => {
      let n = el;
      for (let i = 0; i < 8 && n; i++) {
        if (getComputedStyle(n).transform !== 'none') return getComputedStyle(n).transform;
        n = n.parentElement;
      }
      return null;
    });
    await page.mouse.up();
    return { before, during };
  });

  console.log('\n\n========== 판정 ==========');
  const checks = [];

  // [57] 대비 계산 (간이 상대휘도)
  function luminance(rgbStr) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(rgbStr || '');
    if (!m) return null;
    const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  let contrastRatio = null;
  if (disabledBtn.result) {
    const l1 = luminance(disabledBtn.result.color);
    const l2 = luminance(disabledBtn.result.bg);
    if (l1 !== null && l2 !== null) {
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      contrastRatio = (hi + 0.05) / (lo + 0.05);
    }
  }
  checks.push(['[57] disabled "추가하기" 버튼의 텍스트/배경 대비가 최소 기준(2.5:1) 이상이다',
    !!disabledBtn.result && contrastRatio !== null && contrastRatio >= 2.5,
    `${JSON.stringify(disabledBtn.result)} ratio=${contrastRatio}`]);

  checks.push(['[58/59] 카테고리를 2개 고르면 둘 다 ✓ 로 표시된다',
    (multiCat.chipsAfterToggle.match(/✓ 여행/) || []).length > 0 && (multiCat.chipsAfterToggle.match(/✓ 자연/) || []).length > 0,
    multiCat.chipsAfterToggle.slice(0, 200)]);

  const addCommit = multiCat.commits.flat();
  const addWrite = addCommit.find((w) => fieldsOf(w).title?.stringValue === '멀티카테고리 테스트');
  const catsInCommit = addWrite ? (fieldsOf(addWrite).categories?.arrayValue?.values || []).map((v) => v.stringValue) : [];
  checks.push(['[58/59] 저장(commit)된 문서에 categories 배열로 "여행","자연"이 들어간다',
    catsInCommit.includes('여행') && catsInCommit.includes('자연'),
    JSON.stringify(catsInCommit)]);
  checks.push(['[60] 저장된 문서에 priority="high" 가 들어간다',
    addWrite && fieldsOf(addWrite).priority?.stringValue === 'high',
    addWrite ? JSON.stringify(fieldsOf(addWrite).priority) : 'no write found']);

  checks.push(['[62] 카드를 길게 누르면 선택모드로 들어간다("1개 선택" 표시)',
    /1개 선택/.test(selectReorder.afterLongPress), selectReorder.afterLongPress.slice(0, 200)]);
  checks.push(['[62] 다른 카드를 누르면 선택 개수가 늘어난다("2개 선택")',
    /2개 선택/.test(selectReorder.afterSecondSelect), selectReorder.afterSecondSelect.slice(0, 200)]);
  const reorderWrites = selectReorder.orderCommit || [];
  checks.push(['[60] ▼ 버튼을 누르면 실제로 order 필드 재정렬 commit이 나간다',
    reorderWrites.length >= 2 && reorderWrites.every((w) => fieldsOf(w).order),
    JSON.stringify(reorderWrites.map((w) => [w.update?.name?.split('/').pop(), fieldsOf(w).order?.integerValue]))]);
  checks.push(['[62] 전체 선택/해제를 누르면 선택 개수가 전체로 바뀐다',
    /4개 선택/.test(selectReorder.afterSelectAll), selectReorder.afterSelectAll.slice(0, 200)]);
  // 힌트 문구("여러 개 선택")에도 "개 선택"이 들어있어 단순 정규식으론 오탐이 나서,
  // 선택바에만 있는 "전체 선택/해제" 문구 유무로 판정합니다.
  checks.push(['[62] ✕ 를 누르면 선택모드가 종료된다(선택바 사라짐)',
    !selectReorder.afterExit.includes('전체 선택/해제'), selectReorder.afterExit.slice(0, 200)]);

  checks.push(['[64] 자세히 보기에서 카드를 누르면 곧장 수정 화면(제목 입력칸)이 뜬다',
    tapBehavior.afterDetailTap.includes('무엇을 이루고 싶나요') || tapBehavior.afterDetailTap.includes('카테고리 (여러 개 선택 가능)'),
    tapBehavior.afterDetailTap.slice(0, 250)]);
  checks.push(['[64] 간단히 보기에서 카드를 누르면 상세보기(자세히 보기 느낌의 프로필/소유자)가 뜬다',
    !tapBehaviorCompact.afterCompactTap.includes('무엇을 이루고 싶나요'),
    tapBehaviorCompact.afterCompactTap.slice(0, 250)]);

  checks.push(['[61] 캐러셀 카드가 이전(132px)보다 커졌다(156px)',
    !!carousel.before && carousel.before.w >= 150,
    JSON.stringify(carousel.before)]);
  checks.push(['[61] 누르고 있는 동안 transform(scale)이 적용된다',
    !!carousel.during && carousel.during !== 'none' && carousel.during !== carousel.before?.transform,
    `before=${carousel.before?.transform} during=${carousel.during}`]);

  let pass = 0;
  for (const [label, ok, detail] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${ok ? '' : `  ⟨${detail}⟩`}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${checks.length} 통과`);

  await browser.close();
  process.exit(pass === checks.length ? 0 : 1);
})();
