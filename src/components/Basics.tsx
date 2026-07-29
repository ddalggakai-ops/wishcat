import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme';

export function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.secWrap}>
      <Text style={styles.secTitle}>{title}</Text>
      <Text style={styles.secCount}>{count}</Text>
      <View style={styles.secLine} />
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline', title, subtitle,
}: {
  icon?: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}><Icon name={icon} size={24} color={colors.ink3} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.headWrap}>
      <View style={styles.headRow}>
        <Text style={styles.headTitle}>{title}</Text>
        {right}
      </View>
      {subtitle ? <Text style={styles.headSub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  secWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 12 },
  secTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink2, letterSpacing: 0.2 },
  secCount: { fontSize: 12, color: colors.ink3, fontWeight: '600', marginRight: 8 },
  secLine: { flex: 1, height: 1, backgroundColor: colors.line },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink2 },
  emptySub: { fontSize: 13, marginTop: 5, color: colors.ink3, textAlign: 'center' },
  headWrap: { paddingTop: 12, paddingBottom: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headTitle: { fontSize: 27, fontWeight: '700', color: colors.ink, letterSpacing: 0 },
  headSub: { fontSize: 13.5, color: colors.ink2, marginTop: 6, lineHeight: 19 },
});
