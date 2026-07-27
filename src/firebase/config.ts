import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';
// getReactNativePersistence 타입은 src/types/firebase-auth-rn.d.ts 에서 보강합니다.
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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

if (!firebaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[wishcat] Firebase 설정이 비어 있어요. .env 파일에 EXPO_PUBLIC_FIREBASE_* 값을 채워주세요 (.env.example 참고).'
  );
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 웹(Expo web)에서는 RN persistence 모듈이 없어서 갈라줌 — 실제 배포 타깃은 iOS/Android(Expo Go)라 여기가 핵심 경로
let authInstance: Auth;
if (Platform.OS === 'web') {
  authInstance = getAuth(app);
} else {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}
export const auth = authInstance;

export const db = getFirestore(app);
export const storage = getStorage(app);
