import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import SkyBackground from './src/components/SkyBackground';
import ErrorScreen from './src/components/ErrorScreen';
import AuthScreen from './src/screens/AuthScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeShell from './src/HomeShell';
import AcceptInviteModal from './src/sheets/AcceptInviteModal';
import { usePendingInvite } from './src/hooks/usePendingInvite';
import { colors } from './src/theme';

function AuthenticatedApp({ pendingCode, onDone }: { pendingCode: string | null; onDone: () => void }) {
  return (
    <AppProvider>
      <HomeShell />
      <AcceptInviteModal code={pendingCode} onClose={onDone} onAccepted={onDone} />
    </AppProvider>
  );
}

/** 로딩 화면 — 흰 스피너가 배경에 묻혀 "아무것도 안 뜬" 것처럼 보이던 문제를 고쳐서, 글씨까지 함께 보여줍니다. */
function LoadingScreen() {
  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <View style={styles.loading}>
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>위시캣을 준비하고 있어요…</Text>
        </View>
      </View>
    </View>
  );
}

/** 로그인 전 화면 아래쪽에 조용히 붙는 진단 버튼 */
function DiagLink({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} style={[styles.diagLink, { bottom: insets.bottom + 10 }]} hitSlop={12}>
      <Text style={styles.diagLinkText}>🔧 연결 진단</Text>
    </Pressable>
  );
}

function Root() {
  const { ready, user, startupError, retryStartup, justRegistered, clearJustRegistered } = useAuth();
  const [showDiag, setShowDiag] = useState(false);
  // 초대 코드는 로그인 여부와 무관하게 여기서 붙잡습니다.
  // (로그인 화면에서 링크를 받아도 가입 후에 그대로 이어지도록)
  const { code: pendingCode, clear: clearInvite } = usePendingInvite();

  if (showDiag) return <DiagnosticsScreen onClose={() => setShowDiag(false)} />;

  if (!ready) {
    return (
      <View style={{ flex: 1 }}>
        <LoadingScreen />
        <DiagLink onPress={() => setShowDiag(true)} />
      </View>
    );
  }

  // 로그인은 됐지만 프로필/서버 연결이 안 되는 상태 — 예전엔 여기서 화면이 텅 비었어요.
  if (startupError) {
    return (
      <ErrorScreen
        title="서버에 연결하지 못했어요"
        message={startupError}
        detail="Wi-Fi/데이터 연결을 확인한 뒤 다시 시도해 주세요. 계속 같은 오류가 나면 아래 '연결 진단'을 눌러 어디서 막히는지 확인할 수 있어요."
        primaryLabel="다시 시도"
        onPrimary={retryStartup}
        secondaryLabel="🔧 연결 진단 열기"
        onSecondary={() => setShowDiag(true)}
      />
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1 }}>
        <AuthScreen pendingInvite={!!pendingCode} />
        <DiagLink onPress={() => setShowDiag(true)} />
      </View>
    );
  }
  if (justRegistered) return <OnboardingScreen onFinish={clearJustRegistered} />;
  return <AuthenticatedApp pendingCode={pendingCode} onDone={clearInvite} />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingCard: {
    backgroundColor: 'rgba(255,255,255,.92)',
    paddingHorizontal: 26,
    paddingVertical: 22,
    borderRadius: 22,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  diagLink: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  diagLinkText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,.85)' },
});
