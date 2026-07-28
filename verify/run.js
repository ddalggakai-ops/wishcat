// 브라우저에서 앱을 실제로 띄워 "빈 화면"이 나오지 않는지 확인하는 검증 스크립트.
// (안드로이드 기기를 이 샌드박스에서 돌릴 수 없어서, 같은 React 코드를 web으로 구동해 검증합니다)
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';

function textOf(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function bootPage(browser, label, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  if (opts.route) await page.route(opts.route.pattern, opts.route.handler);
  await page.goto(URL, { waitUntil: 'load' });
  return { ctx, page, logs, label };
}

async function report({ page, logs, label }, screenshot) {
  const body = await page.evaluate(() => {
    const root = document.getElementById('root') || document.body;
    return {
      text: root.innerText,
      nodes: root.querySelectorAll('*').length,
      html: root.innerHTML.length,
    };
  });
  await page.screenshot({ path: `verify/${screenshot}`, fullPage: false });
  console.log(`\n===== ${label} =====`);
  console.log(`DOM 노드 수: ${body.nodes}, innerHTML 길이: ${body.html}`);
  console.log(`화면 텍스트: ${JSON.stringify(textOf(body.text)).slice(0, 700)}`);
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));
  console.log(`콘솔 오류 ${bad.length}건${bad.length ? ':\n  ' + bad.slice(0, 8).join('\n  ') : ''}`);
  return { ...body, text: textOf(body.text), errors: bad };
}

(async () => {
  const browser = await chromium.launch();
  const results = {};

  // 1) 기본 부팅 — Firebase 도달 불가(이 샌드박스의 기본 상태). 로그인 화면이 떠야 함.
  {
    const s = await bootPage(browser, '1) 기본 부팅 (Firebase 네트워크 차단 상태)');
    await s.page.waitForTimeout(4000);
    results.boot = await report(s, '01-boot.png');

    // 2) 진단 화면 진입 + 실행
    const diag = s.page.getByText('🔧 연결 진단', { exact: false }).first();
    if (await diag.count()) {
      await diag.click();
      await s.page.waitForTimeout(800);
      results.diagOpen = await report(s, '02-diagnostics.png');
      const start = s.page.getByText('진단 시작', { exact: false }).first();
      if (await start.count()) {
        await start.click();
        await s.page.waitForTimeout(16000); // 12s 타임아웃 2개가 끝날 시간
        results.diagRun = await report(s, '03-diagnostics-run.png');
      } else {
        console.log('!! 진단 시작 버튼을 찾지 못함');
      }
    } else {
      console.log('!! 진단 링크를 찾지 못함');
    }
    await s.ctx.close();
  }

  // 3) 회원가입 시도 — 사용자가 실제로 겪은 버그(“가입하기 눌렀는데 프로그레스바만 계속 돌아”) 재현 검사.
  //    Firebase에 닿을 수 없는 상태에서 무한 로딩이 아니라 오류 문구로 끝나야 합니다.
  {
    const s = await bootPage(browser, '3) Firebase 불가 상태에서 회원가입 시도');
    await s.page.waitForTimeout(3000);
    await s.page.getByText('계정이 없어요 · 회원가입', { exact: false }).first().click();
    await s.page.waitForTimeout(500);
    const inputs = s.page.locator('input');
    const n = await inputs.count();
    console.log(`\n회원가입 화면 input 개수: ${n} (이름/이메일/비밀번호 = 3이어야 함)`);
    await inputs.nth(0).fill('검증');
    await inputs.nth(1).fill('verify@example.com');
    await inputs.nth(2).fill('password123');
    await s.page.waitForTimeout(300);
    await s.page.getByText('가입하고 시작하기', { exact: false }).first().click();
    // 로딩 표시가 실제로 켜지는지 확인
    await s.page.waitForTimeout(600);
    const midway = textOf(await s.page.evaluate(() => document.body.innerText));
    console.log(`클릭 직후 '가입하고 시작하기' 글자 보임: ${/가입하고 시작하기/.test(midway)}`);
    await s.page.waitForTimeout(25000);
    results.signup = await report(s, '04-signup-attempt.png');
  }

  // 4) AppErrorBoundary — 렌더 중 예외가 나도 빈 화면이 아니라 오류 화면이 떠야 함
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto('http://localhost:8098/', { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    results.boundary = await report({ page, logs, label: '4) 렌더 중 예외 → AppErrorBoundary' }, '05-error-boundary.png');
    await ctx.close();
  }

  await browser.close();

  // ---- 판정 ----
  console.log('\n\n========== 판정 ==========');
  const checks = [];
  const push = (name, pass, detail) => checks.push({ name, pass, detail });

  push('부팅 시 화면이 비어있지 않다', results.boot.nodes > 10, `노드 ${results.boot.nodes}`);
  push('부팅 시 로딩에서 멈추지 않는다', !/준비하고 있어요/.test(results.boot.text), results.boot.text.slice(0, 80));
  push('부팅 시 콘솔 치명적 오류 없음', results.boot.errors.length === 0, results.boot.errors.join(' | ').slice(0, 200));
  if (results.diagRun) {
    push('진단 화면이 렌더된다', /연결 진단/.test(results.diagOpen.text), '');
    push('진단이 결과(✅ 또는 ❌)를 표시한다', /✅|❌/.test(results.diagRun.text), results.diagRun.text.slice(0, 300));
  }
  if (results.signup) {
    push(
      '가입 실패가 무한 로딩이 아니라 오류 메시지로 끝난다',
      /네트워크 연결을 확인해주세요|초 안에 응답하지 않았어요|auth\/|올바르지 않아요/.test(results.signup.text),
      results.signup.text.slice(-260)
    );
    push(
      '가입 버튼이 로딩 상태로 갇혀있지 않다',
      /가입하고 시작하기/.test(results.signup.text),
      ''
    );
  }
  if (results.boundary) {
    push(
      '렌더 예외 시 AppErrorBoundary 오류 화면이 뜬다',
      /앱이 잠깐 넘어졌어요/.test(results.boundary.text) && /검증용 강제 예외/.test(results.boundary.text),
      results.boundary.text.slice(0, 200)
    );
  }
  for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} — ${c.name}${c.detail ? `  ⟨${c.detail}⟩` : ''}`);
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} 통과`);
  process.exit(failed ? 1 : 0);
})();
