import { FirebaseError } from 'firebase/app';

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': '이미 가입된 이메일이에요',
  'auth/invalid-email': '이메일 형식을 확인해주세요',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요',
  'auth/missing-password': '비밀번호를 입력해주세요',
  'auth/user-not-found': '가입되지 않은 이메일이에요',
  'auth/wrong-password': '비밀번호가 올바르지 않아요',
  'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않아요',
  'auth/too-many-requests': '너무 많이 시도했어요. 잠시 후 다시 시도해주세요',
  'auth/network-request-failed': '네트워크 연결을 확인해주세요',
};

// Firebase Auth 에러 코드를 사용자에게 보여줄 한국어 메시지로 변환
export function authErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof FirebaseError) return MESSAGES[e.code] || fallback;
  return fallback;
}
