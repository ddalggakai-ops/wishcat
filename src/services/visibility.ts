// 내 목록 공개 여부를 서비스 계층에서 참조하기 위한 아주 작은 저장소입니다.
//
// 둘러보기 쿼리를 "모든 사용자 문서를 읽어서 공개 목록을 추린다"에서
// "items.ownerPublic == true 로 바로 조회한다"로 바꾸면서, 아이템을 만들 때
// 소유자의 공개 여부를 아이템 문서에 같이 적어 둬야 합니다.
// 그 값을 addItem/bulkAddItems 호출부마다 인자로 넘기는 대신 여기서 공유합니다.
// (AuthContext가 로그인/프로필 변경 시점에 setMyVisibility를 호출합니다)

let myListPublic = true;

export function setMyVisibility(isPublic: boolean) {
  myListPublic = isPublic !== false;
}

export function getMyVisibility(): boolean {
  return myListPublic;
}
