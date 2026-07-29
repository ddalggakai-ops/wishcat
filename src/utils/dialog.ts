import { Alert, Platform } from 'react-native';

// react-native-web에서 Alert.alert 은 아무 일도 하지 않는 빈 함수예요.
// 그래서 웹으로 배포하면 삭제/완료/중단 같은 확인 창이 뜨지도, 동작하지도 않았습니다.
// 앱(네이티브)에서는 시스템 창을, 웹에서는 브라우저 confirm/alert 을 쓰는 공통 함수로 감쌉니다.
// 콜백 배열 대신 Promise 를 돌려줘서 호출부에서 await 로 깔끔하게 이어 쓸 수 있어요.

export function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message = '', confirmLabel = '확인', cancelLabel = '취소', destructive } = opts;

  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const ok = typeof globalThis !== 'undefined' && typeof (globalThis as any).confirm === 'function'
      ? (globalThis as any).confirm(text)
      : true;
    return Promise.resolve(!!ok);
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message || undefined,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function alertDialog(title: string, message?: string): Promise<void> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).alert === 'function') {
      (globalThis as any).alert(text);
    }
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message || undefined,
      [{ text: '확인', onPress: () => resolve() }],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });
}
