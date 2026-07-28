# verify — 넘겨주기 전에 돌리는 실제 구동 검증

안드로이드 기기 없이도 "앱이 정말 뜨는지"를 확인하기 위한 스크립트입니다.
같은 React 코드를 `expo export --platform web` 으로 뽑아 Chromium에서 실제로 렌더시키고,
화면에 무엇이 그려졌는지(DOM 텍스트)를 검사합니다.

## 준비

```bash
npm install --no-save react-dom@19.2.3 react-native-web@^0.21.0 @expo/metro-runtime
npx expo export --platform web --output-dir dist-web
npx serve -s dist-web -l 8099 &
```

에러 화면 테스트용 번들 (package.json 의 main 을 잠시 `verify/boom-index.tsx` 로 바꿔서 export):

```bash
npx serve -s dist-boom -l 8098 &
```

## 실행

```bash
node verify/run.js            # 부팅 / 진단화면 / 가입 실패 / ErrorBoundary
node verify/run-signed-in.js  # Firebase REST 응답을 mock 해서 로그인 이후 화면까지
```

`run-signed-in.js` 는 Firebase Auth·Firestore 의 REST 엔드포인트를 가로채
실제 서버와 같은 모양의 JSON을 돌려줍니다. 덕분에 네트워크가 막힌 환경에서도
Firestore lite(REST) SDK가 보내는 요청/받는 응답 처리와 홈 화면 렌더까지 검증할 수 있습니다.

각 스크립트는 통과/실패를 출력하고, 실패가 있으면 exit code 1 로 끝납니다.
스크린샷은 `verify/*.png` 로 저장됩니다(git에는 올리지 않음).
