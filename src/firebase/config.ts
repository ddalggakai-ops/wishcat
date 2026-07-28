import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';
// getReactNativePersistence 타입은 src/types/firebase-auth-rn.d.ts 에서 보강합니다.
// Firestore는 "lite"(순수 REST) 빌드를 씁니다. 이유는 아래 주석 참고.
import { getFirestore, Firestore } from 'firebase/firestore/lite';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
export const firebaseProjectId = firebaseConfig.projectId || '(없음)';

// ── 사용할 Firestore 데이터베이스 ID ─────────────────────────────────────────
// Firestore는 프로젝트 하나에 여러 데이터베이스를 둘 수 있고, 기본 데이터베이스의
// 이름은 괄호까지 포함한 "(default)" 입니다. 콘솔에서 이름을 직접 지어 만든
// 데이터베이스(예: "wishcat")를 쓰려면 SDK에도 그 이름을 알려줘야 합니다.
// 값이 비어 있으면 기본 데이터베이스 "(default)"를 씁니다.
const rawDatabaseId = (process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || '').trim();
export const firebaseDatabaseId = rawDatabaseId || '(default)';
const usingNamedDatabase = !!rawDatabaseId && rawDatabaseId !== '(default)';

// ────────────────────────────────────────────────────────────────────────────
// 이 파일은 "절대 throw하지 않는다"가 규칙입니다.
// 모듈 최상단에서 예외가 나면 React가 마운트되기도 전에 앱이 죽어서
// 화면에 아무것도 안 뜨는(=원인도 알 수 없는) 상태가 됩니다.
// 그래서 모든 초기화를 try/catch로 감싸고, 실패 사유는 firebaseInitError에
// 담아 진단 화면에서 그대로 보여줍니다.
// ────────────────────────────────────────────────────────────────────────────
let initError: string | null = null;
const initLog: string[] = [];

function note(msg: string) {
  initLog.push(msg);
}

function fail(step: string, e: unknown) {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  initError = initError ? `${initError}\n${step}: ${msg}` : `${step}: ${msg}`;
  note(`✗ ${step} — ${msg}`);
}

if (!firebaseConfigured) {
  fail('설정 확인', new Error('EXPO_PUBLIC_FIREBASE_* 값이 비어 있어요 (.env / eas.json 확인)'));
}

// 1) App
let appInstance: FirebaseApp | null = null;
try {
  appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  note(`✓ initializeApp (${firebaseConfig.projectId})`);
} catch (e) {
  fail('initializeApp', e);
}

// 2) Auth — 네이티브는 AsyncStorage 영속화, 웹은 기본 영속화
let authInstance: Auth | null = null;
if (appInstance) {
  try {
    if (Platform.OS === 'web') {
      authInstance = getAuth(appInstance);
      note('✓ getAuth (web)');
    } else {
      authInstance = initializeAuth(appInstance, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
      note('✓ initializeAuth + AsyncStorage 영속화');
    }
  } catch (e) {
    // 이미 초기화됐거나 persistence 모듈이 없을 때 — 최소한 로그인은 되게 폴백
    try {
      authInstance = getAuth(appInstance);
      note(`△ initializeAuth 실패 → getAuth 폴백 (로그인 유지 안 될 수 있음): ${(e as Error)?.message}`);
    } catch (e2) {
      fail('auth 초기화', e2);
    }
  }
}

// 3) Firestore — lite 빌드(순수 REST)
//
// 왜 lite인가:
//   일반 firebase/firestore는 WebChannel(스트리밍) 전송을 쓰는데, React Native/Hermes
//   환경에서는 이게 응답 없이 멈추는 사례가 많습니다(첫 읽기/쓰기가 영원히 pending).
//   experimentalForceLongPolling으로 우회할 수 있다고들 하지만 여전히 불안정합니다.
//   이 앱은 실시간 리스너(onSnapshot)를 전혀 쓰지 않고 전부 단발성 읽기/쓰기라서,
//   lite 빌드(fetch 기반 REST, 스트리밍 없음)로 바꾸면 이 문제가 원천적으로 사라집니다.
//   대가는 오프라인 캐시가 없다는 것뿐인데, 어차피 쓰지 않던 기능입니다.
let dbInstance: Firestore | null = null;
if (appInstance) {
  try {
    dbInstance = usingNamedDatabase ? getFirestore(appInstance, rawDatabaseId) : getFirestore(appInstance);
    note(`✓ getFirestore (lite / REST) — db: ${firebaseDatabaseId}`);
  } catch (e) {
    fail('getFirestore', e);
  }
}

// 4) Storage
let storageInstance: FirebaseStorage | null = null;
if (appInstance) {
  try {
    storageInstance = getStorage(appInstance);
    note('✓ getStorage');
  } catch (e) {
    fail('getStorage', e);
  }
}

export const firebaseInitError = initError;
export const firebaseInitLog = initLog;
export const firebaseReady = !!(appInstance && authInstance && dbInstance);

// 아래 3개는 초기화 실패 시 null이지만, 타입 편의상 non-null로 내보냅니다.
// 실패했다면 firebaseReady가 false이고 화면에 안내가 뜨므로 여기서 쓰이지 않습니다.
export const app = appInstance as FirebaseApp;
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const storage = storageInstance as FirebaseStorage;
