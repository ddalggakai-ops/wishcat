// 검증 전용 엔트리(앱에 포함되지 않음).
// 렌더 중 예외가 났을 때 AppErrorBoundary가 정말로 화면을 띄우는지 확인합니다.
import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppErrorBoundary from '../src/components/AppErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('검증용 강제 예외 (render 중)');
}

function BoomApp() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <Boom />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

registerRootComponent(BoomApp);
