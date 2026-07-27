// 위시캣은 Firebase(Auth/Firestore/Storage)를 서버로 사용합니다.
// 사진 URL은 Firebase Storage의 다운로드 URL(https://...)로 이미 절대경로이므로 그대로 통과시킵니다.
// (예전 Node 백엔드 시절 상대경로 /uploads/xxx.png 를 절대 URL로 바꿔주던 흔적 — 하위 호환용으로 유지)
export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  return undefined;
}
