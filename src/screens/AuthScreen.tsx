import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkyBackground from '../components/SkyBackground';
import NatureBadge from '../components/NatureBadge';
import { Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen({ pendingInvite }: { pendingInvite?: boolean }) {
  const insets = useSafeAreaInsets();
  const { login, register, resetPassword, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const canSubmit = mode === 'reset'
    ? emailOk
    : mode === 'login'
      ? emailOk && password.length >= 6
      : emailOk && password.length >= 6 && name.trim().length > 0;

  const go = (next: 'login' | 'register' | 'reset') => {
    clearError();
    setNotice(null);
    setMode(next);
  };

  const submit = async () => {
    if (loading) return; // 이미 처리 중이면(키보드 '완료'로) 중복 제출 방지
    clearError();
    setNotice(null);
    try {
      if (mode === 'reset') {
        await resetPassword(email.trim());
        setNotice(`${email.trim()} 으로 비밀번호 재설정 메일을 보냈어요.\n메일함(스팸함도)을 확인해주세요.`);
      } else if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim());
      }
    } catch (e) {
      // 에러 메시지는 AuthContext의 error 상태에 이미 반영됨
    }
  };

  const title = mode === 'login' ? '로그인' : mode === 'register' ? '회원가입' : '비밀번호 재설정';

  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.badgeWrap}>
            <NatureBadge size={74} />
          </View>
          <Text style={styles.brand}>위시캣</Text>
          <Text style={styles.tagline}>친구와 함께 지우는 버킷리스트</Text>

          {pendingInvite ? (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteText}>💌 초대를 받았어요! 로그인하거나 가입하면 바로 친구가 돼요.</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>

            {mode === 'register' && (
              <>
                <FieldLabel>이름</FieldLabel>
                <Field
                  value={name}
                  onChangeText={setName}
                  placeholder="이름 (예: 현진)"
                  maxLength={12}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="name"
                />
              </>
            )}
            <FieldLabel>이메일</FieldLabel>
            <Field
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
            {mode !== 'reset' && (
              <>
                <FieldLabel>비밀번호</FieldLabel>
                <Field
                  value={password}
                  onChangeText={setPassword}
                  placeholder="6자 이상"
                  secure
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'login' ? 'password' : 'newPassword'}
                  returnKeyType="go"
                  onSubmitEditing={() => { if (canSubmit && !loading) submit(); }}
                />
              </>
            )}

            {mode === 'reset' ? (
              <Text style={styles.hint}>가입할 때 쓴 이메일을 넣으면 재설정 링크를 보내드려요.</Text>
            ) : null}

            {error ? <Text style={styles.err}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <BubbleButton
              title={mode === 'login' ? '로그인' : mode === 'register' ? '가입하고 시작하기' : '재설정 메일 보내기'}
              onPress={submit}
              disabled={!canSubmit}
              loading={loading}
              full
              style={{ marginTop: 22 }}
            />
            {mode === 'reset' ? (
              <BubbleButton title="‹ 로그인으로 돌아가기" onPress={() => go('login')} variant="ghost" full style={{ marginTop: 10 }} />
            ) : (
              <>
                <BubbleButton
                  title={mode === 'login' ? '계정이 없어요 · 회원가입' : '이미 계정이 있어요 · 로그인'}
                  onPress={() => go(mode === 'login' ? 'register' : 'login')}
                  variant="ghost"
                  full
                  style={{ marginTop: 10 }}
                />
                {mode === 'login' && (
                  <Pressable onPress={() => go('reset')} style={styles.linkBtn} hitSlop={8}>
                    <Text style={styles.linkText}>비밀번호를 잊으셨나요?</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 28, alignItems: 'stretch' },
  badgeWrap: { alignItems: 'center', marginBottom: 18 },
  brand: { fontSize: 30, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  tagline: { fontSize: 14, color: colors.ink2, textAlign: 'center', marginTop: 8, marginBottom: 34 },
  card: {
    backgroundColor: colors.surface, borderRadius: 26, padding: 22,
    shadowColor: '#2E2A3D', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  err: { color: colors.like, fontSize: 13, marginTop: 14, lineHeight: 19 },
  notice: { color: colors.done, fontSize: 13, marginTop: 14, lineHeight: 19 },
  hint: { color: colors.ink2, fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  linkBtn: { alignSelf: 'center', paddingVertical: 12 },
  linkText: { fontSize: 13, color: colors.ink2, textDecorationLine: 'underline' },
  inviteBanner: {
    backgroundColor: colors.accentWash, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 14,
  },
  inviteText: { fontSize: 13.5, color: colors.ink, textAlign: 'center', lineHeight: 20 },
});
