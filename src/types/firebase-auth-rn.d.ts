// firebase/auth의 타입 진입점(exports 맵의 "types" 조건이 "react-native" 조건보다 먼저 매칭되는
// 구조적 문제)이 getReactNativePersistence를 노출하지 않는 문제 보강.
// 런타임에는 Metro가 "react-native" exports 조건으로 정상 resolve하므로 실제로 존재하는 함수입니다.
// 참고: https://github.com/firebase/firebase-js-sdk/issues/7615
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
