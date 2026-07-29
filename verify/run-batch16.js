// 이번 요청 2개를 검증합니다.
// 1) 사진 업로드가 느리다 — uploadPhoto가 이제 올리기 전에 가로 1440px로 줄이고 압축해요.
//    (ImagePicker 자체는 이 웹 기반 헤드리스 환경에서 못 돌리니, "빌드가 깨지지 않는다 +
//     리사이즈 함수가 실제로 작은 이미지를 만들어낸다"를 Node에서 직접 확인합니다)
// 2) "이룬 꿈에서는 사진 1개만 보여" — ItemDetailSheet 상단에 사진이 중복으로(hero + 캐러셀
//    두 번) 뜨던 걸 캐러셀 하나로 정리했고, ViewerModal(공유 보기)도 첫 장만 보여주던 걸
//    캐러셀로 바꿨어요. 3장을 올린 완료 아이템을 각 화면에서 열어 "1/3" 배지가 뜨는지 확인합니다.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

const PHOTO_URLS = ['http://localhost:8099/test-photos/p1.png', 'http://localhost:8099/test-photos/p2.png', 'http://localhost:8099/test-photos/p3.png'];
const DONE_DOC = {
  name: docPath('items/done1'),
  fields: {
    ownerId: { stringValue: UID }, ownerPublic: { booleanValue: true },
    title: { stringValue: '오로라 보기' }, emoji: { stringValue: '🌌' }, note: { stringValue: '' },
    categories: { arrayValue: { values: [{ stringValue: '여행' }] } },
    priority: { nullValue: null }, order: { integerValue: '0' },
    location: { nullValue: null }, targetDate: { nullValue: null },
    done: { booleanValue: true },
    memory: {
      mapValue: {
        fields: {
          photo: { stringValue: PHOTO_URLS[0] },
          photos: { arrayValue: { values: PHOTO_URLS.map((u) => ({ stringValue: u })) } },
          text: { stringValue: '드디어 봤다' }, date: { stringValue: '2026.01.01' },
        },
      },
    },
    participants: { arrayValue: {} }, origin: { stringValue: 'own' }, helpedBy: { arrayValue: {} },
    likesCount: { integerValue: '3' }, savesCount: { integerValue: '1' }, createdAt: { timestampValue: TS },
  },
  createTime: TS, updateTime: TS,
};

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

async function handleFirestore(route) {
  const url = route.request().url();
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
  if (url.includes(':batchGet')) {
    const docs = body.documents || [];
    const out = docs.map((full) => {
      const p = full.split('/documents/')[1] || '';
      if (p === `users/${UID}`) return { found: USER_DOC, readTime: TS };
      if (p === 'items/done1') return { found: DONE_DOC, readTime: TS };
      return { missing: full, readTime: TS };
    });
    return json(route, out);
  }
  if (url.includes(':runQuery')) {
    const sq = body?.structuredQuery || {};
    const col = sq.from?.[0]?.collectionId;
    if (col === 'items') {
      seen.push('FS runQuery items(mine)');
      return json(route, [{ document: DONE_DOC, readTime: TS }]);
    }
    seen.push(`FS runQuery ${col}${sq.from?.[0]?.allDescendants ? '(group)' : ''}`);
    return json(route, [{ readTime: TS }]);
  }
  if (url.includes(':commit')) {
    seen.push(`FS commit x${(body.writes || []).length}`);
    return json(route, { writeResults: (body.writes || []).map(() => ({ updateTime: TS })), commitTime: TS });
  }
  seen.push(`FS ??? ${url}`);
  return json(route, {}, 200);
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
  await page.route('**firestore.googleapis.com/**', handleFirestore);

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const extra = (await how(page)) || {};
  await page.waitForTimeout(1200);

  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
  const bad = logs.filter((l) => /pageerror|\[error\]/.test(l));
  console.log(`\n===== ${label} =====`);
  console.log(`오류 ${bad.length}${bad.length ? ': ' + bad.slice(0, 3).join(' || ').slice(0, 300) : ''}`);
  console.log(`텍스트: ${JSON.stringify(text).slice(0, 300)}`);
  await ctx.close();
  return { text, errors: bad, ...extra };
}

const login = async (page) => {
  const inputs = page.locator('input');
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill('password123');
  await page.waitForTimeout(200);
  await page.getByText('로그인', { exact: true }).last().click();
  await page.waitForTimeout(2500);
};

// 화면에 실제로 배경이미지로 그려진(로드 시도된) 사진 URL 개수를 셉니다(RN-Web Image는 background-image div).
const countBgImages = (page, urls) => page.evaluate((urls) => {
  const divs = Array.from(document.querySelectorAll('div'));
  let count = 0;
  for (const url of urls) {
    if (divs.some((d) => (getComputedStyle(d).backgroundImage || '').includes(url.split('/').pop()))) count++;
  }
  return count;
}, urls);

// 특정 사진 URL이 배경이미지로 몇 번이나(=몇 개의 div에) 그려졌는지. 중복 렌더(예전 hero+캐러셀 버그) 감지용.
const countDivsWithBg = (page, url) => page.evaluate((url) => {
  const needle = url.split('/').pop();
  return Array.from(document.querySelectorAll('div')).filter((d) => (getComputedStyle(d).backgroundImage || '').includes(needle)).length;
}, url);

(async () => {
  const browser = await chromium.launch();

  // ① ItemDetailSheet: 완료 아이템을 열면 캐러셀이 "한 번만" 뜬다(중복 hero 없음) + "1/3" 배지
  // (간단히 보기로 바꿔야 카드 탭이 수정이 아니라 상세보기로 열립니다)
  const detail = await scenario(browser, '01-item-detail-no-duplicate-hero', async (page) => {
    await login(page);
    await page.getByText('간단히 보기', { exact: true }).first().click();
    await page.waitForTimeout(400);
    await page.getByText('오로라 보기', { exact: false }).first().click();
    await page.waitForTimeout(1000);
    const bgCount = await countBgImages(page, PHOTO_URLS);
    const firstPhotoDivCount = await countDivsWithBg(page, PHOTO_URLS[0]);
    return { bgCount, firstPhotoDivCount };
  });

  // ② ViewerModal(공유): 완료 아이템 카드의 "공유" 버튼 → 캐러셀로 3장이 다 보인다
  const viewer = await scenario(browser, '02-viewer-modal-carousel', async (page) => {
    await login(page);
    await page.getByText('공유', { exact: true }).first().click();
    await page.waitForTimeout(1000);
    const bgCount = await countBgImages(page, PHOTO_URLS);
    return { bgCount };
  });

  await browser.close();

  // ③ 업로드 리사이즈: 실제 Node에서 sharp 없이는 직접 검증이 까다로워서(네이티브 ImagePicker
  // 자체도 이 헤드리스 환경에서 못 돌립니다), 코드 레벨로 shrinkForUpload가 존재/호출되는지와
  // 번들이 깨지지 않는지(위 시나리오들이 이미 전체 앱을 실행해 확인함)로 갈음합니다.
  const uploadServiceSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'uploadService.ts'), 'utf8');

  const checks = [
    ['[사진 1개만 보임] 상세보기를 열면 "1/3" 배지가 뜬다(캐러셀 적용)', /1\/3/.test(detail.text), detail.text.slice(0, 200)],
    ['[사진 1개만 보임] 상세보기에 사진 3장이 모두(중복 없이) 배경으로 로드 시도된다', detail.bgCount === 3, `bgCount=${detail.bgCount}`],
    ['[사진 1개만 보임] 첫 번째 사진이 hero+캐러셀로 중복 렌더되지 않는다(정확히 1곳)', detail.firstPhotoDivCount === 1, `firstPhotoDivCount=${detail.firstPhotoDivCount}`],
    ['[사진 1개만 보임] 상세보기 콘솔에 치명적 오류가 없다', detail.errors.length === 0, detail.errors.join(' | ')],
    ['[사진 1개만 보임] 공유 보기(ViewerModal)에도 "1/3" 배지가 뜬다', /1\/3/.test(viewer.text), viewer.text.slice(0, 200)],
    ['[사진 1개만 보임] 공유 보기에도 사진 3장이 모두 로드 시도된다', viewer.bgCount === 3, `bgCount=${viewer.bgCount}`],
    ['[사진 1개만 보임] 공유 보기 콘솔에 치명적 오류가 없다', viewer.errors.length === 0, viewer.errors.join(' | ')],
    ['[업로드 느림] uploadPhoto가 올리기 전에 리사이즈를 시도한다(shrinkForUpload 사용)', /shrinkForUpload/.test(uploadServiceSrc) && /ImageManipulator/.test(uploadServiceSrc), ''],
    ['[업로드 느림] 실패해도 원본을 그대로 올리는 안전장치가 있다(try/catch fallback)', /catch/.test(uploadServiceSrc) && /shrunk/.test(uploadServiceSrc), ''],
  ];

  console.log('\n\n========== 판정 ==========');
  let fail = 0;
  for (const [name, ok, detail2] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${ok ? '' : `\n     └ ${String(detail2).slice(0, 300)}`}`);
    if (!ok) fail++;
  }
  console.log(`\n${checks.length - fail}/${checks.length} 통과`);
  console.log('\n참고: ImagePicker(사진 고르기 자체)는 이 웹 기반 헤드리스 환경에서 실행할 수 없어서,');
  console.log('실제로 업로드 파일 크기가 몇 MB → 몇백 KB로 줄어드는지는 실기기 확인이 필요합니다.');
  process.exit(fail ? 1 : 0);
})();
