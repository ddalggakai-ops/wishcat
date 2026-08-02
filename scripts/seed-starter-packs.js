// 서버에서 관리하는 '추천 버킷 모음'(starterPacks)을 Firestore에 심는 스크립트.
//
// src/data/starterPacks.json 을 그대로 읽어 starterPacks/{key} 문서로 씁니다(있으면 덮어씀).
// 앱은 이 컬렉션을 읽어 시작 템플릿을 보여주고, 없으면 내장 JSON으로 폴백합니다.
// 따라서 이 스크립트로 언제든 내용을 갈아끼우면 앱 재빌드 없이 반영됩니다.
//
// 쓰기 권한: firestore.rules 에서 starterPacks 쓰기는 '관리자(admins/{uid} 문서 보유)'만 허용됩니다.
//   1) Firebase 콘솔 > Firestore 에서 admins/{내uid} 문서를 하나 만들어 두세요(내용 아무거나).
//      내 uid 는 Firebase 콘솔 > Authentication 에서 확인할 수 있어요.
//   2) 그 계정의 이메일/비밀번호를 ADMIN_EMAIL / ADMIN_PASSWORD 로 넘겨주세요.
//
// 실행(로컬): ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... node scripts/seed-starter-packs.js
// GitHub Actions: "Seed Starter Packs" 워크플로우에서 시크릿으로 주입합니다.

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const out = { ...process.env };
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  return out;
}
const env = loadEnv();
const API_KEY = env.EXPO_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const DATABASE_ID = env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || '(default)';
const ADMIN_EMAIL = env.ADMIN_EMAIL;
const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

if (!API_KEY || !PROJECT_ID) {
  console.error('EXPO_PUBLIC_FIREBASE_API_KEY / EXPO_PUBLIC_FIREBASE_PROJECT_ID 가 필요합니다.');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('ADMIN_EMAIL / ADMIN_PASSWORD 가 필요합니다(관리자 계정으로 로그인해서 씁니다).');
  process.exit(1);
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// ── JS 값 → Firestore REST 타입 값 인코딩 ────────────────────────────────
function fv(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fv) } };
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } };
  throw new Error('알 수 없는 값 타입: ' + value);
}
function fields(obj) {
  const out = {};
  for (const k of Object.keys(obj)) out[k] = fv(obj[k]);
  return out;
}

async function req(url, opts) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts?.method || 'GET'} ${url} → ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function signIn(email, password) {
  const body = await req(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return { uid: body.localId, idToken: body.idToken };
}

// PATCH 로 문서 전체를 덮어씁니다(있으면 갱신, 없으면 생성).
async function putDoc(collectionPath, docId, data, idToken) {
  const url = `${FIRESTORE_BASE}/${collectionPath}/${encodeURIComponent(docId)}`;
  return req(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: fields(data) }),
  });
}

async function main() {
  const packs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'starterPacks.json'), 'utf8'));
  console.log(`추천 팩 ${packs.length}개를 심습니다 (db: ${DATABASE_ID}).`);

  const { uid, idToken } = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log(`관리자 로그인 완료: ${uid}`);

  let ok = 0;
  for (const p of packs) {
    const { key, ...rest } = p;
    if (!key) { console.warn('key 없는 팩 건너뜀'); continue; }
    await putDoc('starterPacks', key, rest, idToken);
    console.log(`  ✓ ${key} (${rest.title})`);
    ok += 1;
  }
  console.log(`\n완료: ${ok}/${packs.length} 개 반영. 앱은 최대 5분 캐시 후(또는 시트를 다시 열면) 새 값을 보여줍니다.`);
}

main().catch((e) => {
  console.error('\n실패:', e.message);
  if (/PERMISSION_DENIED/.test(e.message)) {
    console.error('→ 관리자 표식이 없을 수 있어요. Firebase 콘솔에서 admins/{내uid} 문서를 만들었는지 확인하세요.');
  }
  process.exit(1);
});
