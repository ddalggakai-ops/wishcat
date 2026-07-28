// 초대 링크의 웹 주소.
//
// 예전에는 wishcat://invite/<code> 형태의 커스텀 스킴만 보냈습니다.
// 그런데 이 링크는 앱이 이미 깔린 사람에게만 통합니다. 카카오톡/문자로 받은 사람 입장에서는
// 눌러도 아무 일도 안 일어나거나 오류가 나요. 초대가 유일한 유입 경로인데 새 사용자를
// 데려올 수 없다는 뜻이라, 누구나 열 수 있는 https 링크를 한 겹 앞에 둡니다.
//
// 이 페이지(GitHub Pages로 서비스)는 앱이 있으면 앱을 열고, 없으면 설치 안내를 보여줍니다.
export const SITE_BASE = 'https://ddalggakai-ops.github.io/wishcat';
export const INVITE_WEB_BASE = `${SITE_BASE}/invite/`;

export function inviteWebUrl(code: string): string {
  return `${INVITE_WEB_BASE}?c=${encodeURIComponent(code)}`;
}

/** 앱이 설치된 기기에서 직접 여는 딥링크 (웹 페이지의 '앱에서 열기' 버튼이 이 주소를 씁니다) */
export function inviteDeepLink(code: string): string {
  return `wishcat://invite/${encodeURIComponent(code)}`;
}
