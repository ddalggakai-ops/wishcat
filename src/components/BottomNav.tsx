import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

export type TabKey = 'mine' | 'friends' | 'explore' | 'memories';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'mine', label: '나', icon: '👤' },
  { key: 'friends', label: '친구', icon: '👥' },
  { key: 'explore', label: '둘러보기', icon: '🧭' },
  { key: 'memories', label: '추억', icon: '✨' },
];

export default function BottomNav({ active, onChange, onAdd }: { active: TabKey; onChange: (t: TabKey) => void; onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 9) }]}>
      {left.map((t) => <NavBtn key={t.key} tab={t} active={active === t.key} onPress={() => onChange(t.key)} />)}
      <Pressable onPress={onAdd} style={styles.addBtn}>
        <Text style={styles.addIcon}>＋</Text>
      </Pressable>
      {right.map((t) => <NavBtn key={t.key} tab={t} active={active === t.key} onPress={() => onChange(t.key)} />)}
    </View>
  );
}

function NavBtn({ tab, active, onPress }: { tab: { key: TabKey; label: string; icon: string }; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.navBtn}>
      {active ? <View style={styles.activeDot} /> : null}
      <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
      <Text style={[styles.navLabel, active && { color: colors.accentInk, fontWeight: '700' }]}>{tab.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 9, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,.96)', borderTopWidth: 1, borderTopColor: colors.line,
  },
  navBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 3 },
  navLabel: { fontSize: 10.5, fontWeight: '600', color: colors.ink3 },
  activeDot: { position: 'absolute', top: -4, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentWash },
  addBtn: {
    width: 52, height: 52, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    marginTop: -22, marginHorizontal: 8, borderBottomWidth: 4, borderBottomColor: colors.accentInk,
  },
  addIcon: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -2 },
});
