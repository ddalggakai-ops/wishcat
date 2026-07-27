import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkyBackground from '../components/SkyBackground';
import { Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, register, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const canSubmit = mode === 'login'
    ? email.trim().length > 3 && password.length >= 6
    : email.trim().length > 3 && password.length >= 6 && name.trim().length > 0;

  const submit = async () => {
    clearError();
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
    } catch (e) {
      // 에러 메시지는 AuthContext의 error 상태에 이미 반영됨
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>✦ 위시캣</Text>
          <Text style={styles.tagline}>친구와 함께 지우는 버킷리스트</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{mode === 'login' ? '로그인' : '회원가입'}</Text>

            {mode === 'register' && (
              <>
                <FieldLabel>이름</FieldLabel>
                <Field value={name} onChangeText={setName} placeholder="이름 (예: 현진)" maxLength={12} />
              </>
            )}
            <FieldLabel>이메일</FieldLabel>
            <Field value={email} onChangeText={setEmail} placeholder="you@example.com" />
            <FieldLabel>비밀번호</FieldLabel>
            <Field value={password} onChangeText={setPassword} placeholder="6자 이상" />

            {error ? <Text style={styles.err}>{error}</Text> : null}

            <BubbleButton
              title={mode === 'login' ? '로그인' : '가입하고 시작하기'}
              onPress={submit}
              disabled={!canSubmit}
              loading={loading}
              full
              style={{ marginTop: 22 }}
            />
            <BubbleButton
              title={mode === 'login' ? '계정이 없어요 · 회원가입' : '이미 계정이 있어요 · 로그인'}
              onPress={() => { clearError(); setMode(mode === 'login' ? 'register' : 'login'); }}
              variant="ghost"
              full
              style={{ marginTop: 10 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 28, alignItems: 'stretch' },
  brand: { fontSize: 30, fontWeight: '700', color: '#fff', textAlign: 'center' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,.85)', textAlign: 'center', marginTop: 8, marginBottom: 34 },
  card: { backgroundColor: colors.surface, borderRadius: 26, padding: 22 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  err: { color: colors.like, fontSize: 13, marginTop: 14 },
});
