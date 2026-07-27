import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.secWrap}>
      <Text style={styles.secStar}>✦</Text>
      <Text style={styles.secTitle}>{title}</Text>
      <Text style={styles.secCount}>{count}</Text>
      <View style={styles.secLine} />
    </View>
  );
}

export function EmptyState({ icon = '✦', title, subtitle }: { icon?: string; title: string; subtitle: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.headWrap}>
      <View style={styles.headRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.headStar}>✦</Text>
          <Text style={styles.headTitle}>{title}</Text>
        </View>
        {right}
      </View>
      {subtitle ? <Text style={styles.headSub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  secWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, marginBottom: 12 },
  secStar: { fontSize: 11, color: colors.candyYellow },
  secTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink2, letterSpacing: 0.2 },
  secCount: { fontSize: 12, color: colors.ink3, fontWeight: '600', marginRight: 8 },
  secLine: { flex: 1, height: 1, borderTopWidth: 2, borderTopColor: colors.line2, borderStyle: 'dashed' },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.line2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink2 },
  emptySub: { fontSize: 13, marginTop: 5, color: colors.ink3, textAlign: 'center' },
  headWrap: { paddingTop: 12, paddingBottom: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headStar: { fontSize: 20, color: colors.candyYellow, transform: [{ rotate: '-8deg' }] },
  headTitle: { fontSize: 27, fontWeight: '700', color: colors.ink, letterSpacing: 0 },
  headSub: { fontSize: 13.5, color: colors.ink2, marginTop: 6, lineHeight: 19 },
});
