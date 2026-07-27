import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import SkyBackground from './src/components/SkyBackground';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeShell from './src/HomeShell';
import AcceptInviteModal from './src/sheets/AcceptInviteModal';

// wishcat://invite/<code> 형태의 딥링크에서 초대 코드를 추출
function extractInviteCode(url: string | null): string | null {
  if (!url) return null;
  try {
    const { path } = Linking.parse(url);
    const match = path?.match(/invite\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function AuthenticatedApp() {
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const code = extractInviteCode(url);
      if (code) setPendingCode(code);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      const code = extractInviteCode(url);
      if (code) setPendingCode(code);
    });
    return () => sub.remove();
  }, []);

  return (
    <AppProvider>
      <HomeShell />
      <AcceptInviteModal code={pendingCode} onClose={() => setPendingCode(null)} onAccepted={() => setPendingCode(null)} />
    </AppProvider>
  );
}

function Root() {
  const { ready, user, justRegistered, clearJustRegistered } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1 }}>
        <SkyBackground />
        <View style={styles.loading}><ActivityIndicator color="#fff" size="large" /></View>
      </View>
    );
  }

  if (!user) return <AuthScreen />;
  if (justRegistered) return <OnboardingScreen onFinish={clearJustRegistered} />;
  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
