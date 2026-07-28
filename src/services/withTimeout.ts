/**
 * 네트워크가 이상할 때 Promise가 영원히 pending으로 남아 화면이 멈추는 걸 막는 안전장치.
 * 어떤 이유로든 정해진 시간 안에 끝나지 않으면 에러로 떨어뜨려서, 최소한 "왜 안 되는지"가
 * 화면에 보이게 합니다.
 */
export const DEFAULT_TIMEOUT_MS = 15000;

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label}이(가) ${Math.round(ms / 1000)}초 안에 응답하지 않았어요. 네트워크 연결을 확인해 주세요.`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(p: Promise<T>, label: string, ms: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
