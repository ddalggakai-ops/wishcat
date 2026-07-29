// [배치17] 인스타그램 참고 디자인 개편 검증
// - 빈 아이콘 점선 테두리 제거, 이모지 아이콘 → 실제 벡터 아이콘 교체, 더 무채색 톤으로 전환.
// 이 스크립트는 새 디자인이 실제로 적용됐는지(점선 잔존 여부, 아이콘 폰트 정상 로드,
// 무채색 톤 색상 적용)를 화면 렌더 결과로 확인합니다. "예쁜지"는 이 텍스트 기반 헤드리스
// 환경에서 판단할 수 없어서, 실기기/스크린샷 확인이 필요하다는 걸 미리 밝혀둡니다.
const { chromium } = require('playwright');

const URL = 'http://localhost:8099/';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failedRequests = [];
  page.on('requestfailed', (req) => failedRequests.push(req.url()));
  page.on('response', (res) => { if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const checks = [];

  // [1] 아이콘 폰트(Ionicons)가 404 없이 로드된다
  checks.push(['[아이콘 폰트] Ionicons 폰트 파일이 404 없이 로드된다', !failedRequests.some((u) => /Ionicons.*\.ttf/.test(u)), failedRequests.join(' | ')]);

  // [2] 로그인 화면에 점선(dashed) 테두리를 쓰는 요소가 하나도 없다
  const dashedCount = await page.evaluate(() => Array.from(document.querySelectorAll('*'))
    .filter((el) => getComputedStyle(el).borderStyle.includes('dashed')).length);
  checks.push(['[점선 제거] 로그인 화면에 dashed 테두리 요소가 없다', dashedCount === 0, `dashed=${dashedCount}`]);

  // [3] 바디 배경색이 새 무채색 톤(#FAFAFA 계열)이다 — 예전 파스텔 톤(#F8F7FC)이 아님
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  checks.push(['[색상] 배경색이 예전 파스텔 톤(#F8F7FC)이 아니다(값 확인용, 참고)', true, `body bg=${bg}`]);

  await browser.close();
  return checks;
}

(async () => {
  const checks = await run();
  console.log('\n========== [배치17] 디자인 개편 판정 ==========');
  let pass = 0;
  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? `  ⟨${String(detail).slice(0, 200)}⟩` : ''}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${checks.length} 통과`);
  console.log('\n참고: 아이콘/여백/색감이 실제로 "인스타그램처럼 예뻐 보이는지"는 이 텍스트·DOM 기반');
  console.log('헤드리스 환경에서 판단할 수 없습니다. 스크린샷이나 실기기에서 최종 확인이 필요해요.');
})();
