# 위시캣(WishCat) 모바일 앱

Expo(React Native) + TypeScript로 만든 위시캣 앱입니다. 이메일 회원가입/로그인, 버킷리스트 등록/수정/삭제, 완료+사진 추억 기록, 친구 초대 딥링크, 함께하기/도와주기, 좋아요, 둘러보기(공개 피드)까지 **Firebase**(Authentication + Firestore + Storage)와 실제로 통신합니다.

타입체크(`tsc --noEmit`)와 Metro 번들링(iOS/Android 둘 다)까지 이 환경에서 확인했지만, 실제 기기/시뮬레이터 화면 확인과 Firebase 프로젝트 자체에 대한 연결 테스트는 이 환경에서는 할 수 없었어요(아래 "왜 여기서 직접 실행해볼 수 없었나요?" 참고). 실제 폰에서 눌러보면서 다듬어야 할 부분이 있을 수 있습니다.

## 시작하기

### 1. Firebase 프로젝트 설정

1. [Firebase 콘솔](https://console.firebase.google.com)에서 사용하실 프로젝트를 엽니다 (이미 있는 프로젝트를 그대로 쓰시면 돼요).
2. **Authentication → Sign-in method**에서 **이메일/비밀번호** 제공업체를 사용 설정합니다.
3. **Firestore Database**를 아직 안 만드셨다면 생성합니다 (지역은 아무 곳이나 괜찮아요, 나중에 못 바꾸니 한 번만 신중히).
4. **Storage**를 사용 설정합니다 (사진 업로드용).
5. **프로젝트 설정 → 일반 → 내 앱**에서 웹 앱을 하나 추가(`</>` 아이콘)하면 `firebaseConfig` 값이 나옵니다. React Native 앱이지만 Firebase JS SDK를 쓰기 때문에 "웹 앱"으로 등록하면 됩니다.
5-1. **Firestore 데이터베이스를 반드시 먼저 만들어주세요.** Authentication만 켜 놓으면 데이터베이스는 아직 없는 상태라, 앱이 `The database (default) does not exist for project ...` 오류를 냅니다. 기본 데이터베이스의 이름은 괄호까지 포함한 `(default)` 이고, 콘솔에서 이름을 직접 지어 만든 데이터베이스(예: `wishcat`)를 쓸 거라면 `.env`와 `eas.json`의 `EXPO_PUBLIC_FIREBASE_DATABASE_ID` 에 그 이름을 똑같이 적어야 합니다. 비워두면 `(default)`를 씁니다.
6. **firestore.rules**, **storage.rules** (이 프로젝트 루트에 포함되어 있어요)를 Firebase 콘솔의 Firestore/Storage "규칙"(최근 콘솔에서는 "보안") 탭에 붙여넣고 배포합니다. 데이터베이스가 여러 개라면 화면 위쪽에서 **앱이 쓰는 데이터베이스를 선택한 뒤에** 게시해야 합니다 — 규칙은 데이터베이스마다 따로 저장돼요. 이 규칙들이 없으면 기본값(모두 거부 또는 테스트 모드로 모두 허용)이라 앱이 정상 동작하지 않거나 보안이 뚫려요.
   - Firebase CLI가 있다면: `firebase deploy --only firestore:rules,storage:rules,firestore:indexes`
7. `firestore.indexes.json`에 정의된 복합 색인들도 함께 배포해주세요(위 명령에 포함되어 있어요). CLI를 안 쓰신다면, 앱을 실제로 써보다가 콘솔에 뜨는 "색인이 필요합니다" 에러 메시지의 링크를 눌러 하나씩 만들어주셔도 됩니다.

### 2. 앱 설정 & 실행

```bash
npm install
cp .env.example .env
# .env 파일을 열어 1번에서 확인한 firebaseConfig 값을 EXPO_PUBLIC_FIREBASE_* 항목에 채워주세요
npx expo start
```

터미널에 뜨는 QR코드를 폰의 **Expo Go** 앱(App Store/Play 스토어에서 설치)으로 스캔하면 바로 실행됩니다. 컴퓨터와 폰이 같은 와이파이에 있을 필요는 없어요 — Firebase는 인터넷을 통해 바로 연결되기 때문에, 예전 자체 백엔드 방식과 달리 같은 네트워크가 아니어도 됩니다.

## 왜 여기서 직접 실행해볼 수 없었나요?

이 앱을 만든 개발 환경(샌드박스)은 보안상 외부 인터넷 접속이 npm 패키지 설치 정도로만 열려 있어서, Expo 개발 서버를 실제 폰과 연결하는 것도, 실제 Firebase 프로젝트에 연결해서 로그인/데이터 읽기쓰기를 실제로 테스트하는 것도 할 수 없었습니다. 대신,

- `npx tsc --noEmit` — 타입 오류 없음 확인
- `npx expo export --platform ios` / `--platform android` — 실제 번들러(Metro)로 전체 앱을 오류 없이 빌드 확인

까지 마쳤어요. 실제 화면 동작과 Firebase 연결은 여러분의 컴퓨터에서 `npx expo start`로 직접 확인해주셔야 합니다. 혹시 로그인/데이터 관련해서 에러가 나면 대부분 (1) `.env`의 firebaseConfig 값 오타, (2) 이메일/비밀번호 로그인 미활성화, (3) firestore.rules/storage.rules 미배포, (4) 복합 색인 미생성 중 하나예요.

## 폴더 구조

```
App.tsx                   진입점 — 인증 상태에 따라 로그인/온보딩/메인 화면 전환
firestore.rules           Firestore 보안 규칙 (Firebase 콘솔에 배포 필요)
storage.rules              Storage 보안 규칙 (Firebase 콘솔에 배포 필요)
firestore.indexes.json    복합 색인 정의
src/
  firebase/               config.ts(SDK 초기화), authErrors.ts(에러 메시지 한글화)
  services/               Firestore/Storage와 직접 통신하는 함수들
    usersService.ts         사용자 프로필 읽기/쓰기 + 캐시
    itemsService.ts         버킷 아이템 CRUD, 함께하기/도와주기/좋아요
    friendsService.ts       친구 목록, 초대 코드 생성/수락
    personService.ts        다른 사람 프로필 페이지 데이터 조합
    exploreService.ts       둘러보기(공개 피드) 조회
    uploadService.ts        Firebase Storage 사진 업로드
  api/                    types.ts(도메인 타입), client.ts(resolveImageUrl만 남음)
  context/                AuthContext(로그인 상태), AppContext(버킷/친구 데이터+액션) — 화면들은 이 두 Context만 통해 데이터를 사용해요
  theme.ts                색상/카테고리/폰트 등 디자인 토큰 (웹 프로토타입과 톤 통일)
  components/             공용 컴포넌트 (SkyBackground, ItemCard, BottomNav, Sheet 등)
  screens/                나/친구/둘러보기/추억/개인페이지/로그인/온보딩
  sheets/                 모달 시트들 (등록/수정, 추억 남기기, 도와주기, 프로필, 초대, 상세보기)
  HomeShell.tsx            로그인 이후 메인 앱 껍데기 (탭+모달 상태 관리)
```

## 보안 규칙에 대한 참고

Cloud Functions(유료 Blaze 요금제 필요) 없이 클라이언트가 Firestore에 직접 쓰는 구조라, "친구의 버킷 아이템에 나를 참가자로 추가하기"처럼 소유자가 아닌 사용자가 문서 일부 필드만 건드릴 수 있어야 하는 상황이 있어요. `firestore.rules`는 이런 경우를 필드 단위로 제한해서 허용합니다 (예: participants/savesCount/likesCount처럼 정해진 필드만, 정해진 방식으로만 바뀌는 경우). 완벽하게 촘촘한 서버 검증(Cloud Functions로 만드는 수준)만큼은 아니지만, 친구끼리 쓰는 앱 규모에서는 합리적인 절충이에요. 나중에 트래픽이 커지거나 더 엄격한 검증이 필요하면 Cloud Functions로 옮기는 걸 권장해요.

## 실제 기기 배포까지 가려면 (App Store / Play 스토어)

지금은 Expo Go로 바로 테스트할 수 있는 상태예요. 실제 스토어에 올리려면 [EAS Build](https://docs.expo.dev/build/introduction/)로 앱을 빌드해야 하는데, 이것도 이 샌드박스에서는 Expo 서버(api.expo.dev)에 접속할 수 없어서 진행할 수 없었습니다. 여러분의 컴퓨터에서:

```bash
npm install -g eas-cli
eas login
eas build --platform ios      # 또는 android
```

를 실행하면 됩니다 (Expo 계정 필요, 무료 플랜 있음). `.env`의 `EXPO_PUBLIC_FIREBASE_*` 값들은 빌드 시 그대로 앱에 포함되므로, EAS의 환경변수 설정에도 동일하게 등록해주세요.

## `wishcat-backend`는 이제 필요 없어요

이전에 함께 드렸던 Node/Express 백엔드(`wishcat-backend`)는 이 Firebase 버전에서는 사용하지 않습니다. 서버 배포/운영을 따로 하지 않아도 Firebase가 그 역할을 대신해요. 폴더는 참고용으로만 남겨두셔도 되고, 삭제하셔도 앱 동작에는 영향 없습니다.

## 웹 프로토타입 대비 달라진/생략된 부분

- **사진 저장**: Firebase Storage에 실제로 업로드/저장됩니다 (웹 프로토타입은 브라우저에만 저장되는 base64였어요).
- **공유 카드**: 웹 프로토타입의 캔버스로 그린 예쁜 공유 이미지는 이번엔 생략하고, 기기의 기본 공유 시트(문자/카카오톡/인스타 등 선택)로 텍스트를 공유하는 방식으로 단순화했어요. 나중에 이미지 카드 생성도 원하시면 말씀해주세요 (`react-native-view-shot`으로 추가 가능).
- **추억 피드**: 웹 프로토타입은 데모 데이터 특성상 다른 사람 항목도 섞여 보였지만, 실제 앱에서는 "추억" 탭이 내가 이룬 것만 보여주는 개인 아카이브로 동작해요.
- **초대 링크**: `wishcat://invite/코드` 형태의 앱 딥링크예요. 앱이 설치된 사람끼리만 바로 열립니다. 앱이 없는 사람도 누를 수 있는 웹 랜딩 페이지가 필요하면 추가로 만들어드릴 수 있어요.
