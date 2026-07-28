import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkyBackground from './SkyBackground';
import BubbleButton from './Button';
import { colors } from '../theme';

/**
 * 문제가 생겼을 때 "빈 화면" 대신 반드시 뜨는 화면.
 * 원인을 그대로 보여줘서, 폰만 있어도 무슨 일이 났는지 알 수 있게 합니다.
 */
export default function ErrorScreen({
  title = '앗, 문제가 생겼어요',
  message,
  detail,
  primaryLabel = '다시 시도',
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title?: string;
  message: string;
  detail?: string | null;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={styles.emoji}>🐾</Text>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.card}>
          <Text style={styles.message}>{message}</Text>
          {detail ? (
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>자세한 내용</Text>
              <Text style={styles.detail}>{detail}</Text>
            </View>
          ) : null}
          {onPrimary ? (
            <View style={{ marginTop: 16 }}>
              <BubbleButton title={primaryLabel} onPress={onPrimary} />
            </View>
          ) : null}
          {onSecondary && secondaryLabel ? (
            <Text style={styles.link} onPress={onSecondary}>
              {secondaryLabel}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 22, alignItems: 'stretch' },
  emoji: { fontSize: 40, textAlign: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 8, marginBottom: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.line },
  message: { fontSize: 15, lineHeight: 22, color: colors.ink, fontWeight: '600' },
  detailBox: { marginTop: 14, backgroundColor: colors.surface2, borderRadius: 14, padding: 12 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: colors.ink3, marginBottom: 6 },
  detail: { fontSize: 12, lineHeight: 18, color: colors.ink2, fontFamily: undefined },
  link: { marginTop: 14, textAlign: 'center', color: colors.accentInk, fontWeight: '700', fontSize: 13 },
});
