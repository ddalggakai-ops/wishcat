import { FirebaseError } from 'firebase/app';
import { TimeoutError } from '../services/withTimeout';

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
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인이 꺼져 있어요',
  'auth/api-key-not-valid': 'Firebase API 키가 올바르지 않아요',
  'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해주세요',
  'auth/missing-email': '이메일을 입력해주세요',
  'auth/user-mismatch': '현재 로그인한 계정과 정보가 달라요',
  // Firestore 쪽 코드도 같은 함수로 흘러들어옵니다
  'permission-denied': '접근 권한이 없어요. Firestore 보안 규칙을 확인해주세요',
  unauthenticated: '로그인이 필요해요',
  unavailable: '서버에 연결할 수 없어요. 네트워크를 확인해주세요',
  'failed-precondition': '서버 색인(index)이 필요할 수 있어요',
};

/**
 * Firebase(Auth/Firestore) 에러를 사용자에게 보여줄 한국어 메시지로 변환.
 * 매핑에 없는 코드라도 "무슨 일이 났는지"는 알 수 있게 원문 코드/메시지를 덧붙입니다.
 * 원인을 감춰서 화면이 그냥 멈춘 것처럼 보이는 게 제일 나쁘기 때문입니다.
 */
export function authErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof TimeoutError) return e.message;

  // Firestore 데이터베이스 자체가 만들어져 있지 않은 경우.
  // 코드는 not-found로만 와서 원인을 알기 어려우므로 메시지 원문으로 잡아냅니다.
  const raw = e instanceof Error ? e.message : '';
  if (/does not exist for project/i.test(raw)) {
    return 'Firestore 데이터베이스가 아직 만들어지지 않았어요.\nFirebase 콘솔 > Firestore에서 데이터베이스를 먼저 만들어주세요.';
  }

  if (e instanceof FirebaseError) {
    const known = MESSAGES[e.code];
    if (known) return known;
    return `${fallback}\n(${e.code})`;
  }
  if (e instanceof Error && e.message) return `${fallback}\n(${e.message})`;
  return fallback;
}
