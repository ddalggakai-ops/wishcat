import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import { colors, gradients, shadowColors, radius } from '../theme';

export type TabKey = 'mine' | 'recommend' | 'friends' | 'explore' | 'memories';

const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof Icon>['name']; iconOn: React.ComponentProps<typeof Icon>['name'] }[] = [
  { key: 'mine', label: '나', icon: 'person-outline', iconOn: 'person' },
  { key: 'recommend', label: '추천', icon: 'map-outline', iconOn: 'map' },
  { key: 'friends', label: '친구', icon: 'people-outline', iconOn: 'people' },
  { key: 'explore', label: '둘러보기', icon: 'compass-outline', iconOn: 'compass' },
  { key: 'memories', label: '추억', icon: 'sparkles-outline', iconOn: 'sparkles' },
];

export default function BottomNav({ active, onChange, onAdd }: { active: TabKey; onChange: (t: TabKey) => void; onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 9) }]}>
      {left.map((t) => <NavBtn key={t.key} tab={t} active={active === t.key} onPress={() => onChange(t.key)} />)}
      <Pressable onPress={onAdd} style={styles.addBtnWrap} accessibilityRole="button" accessibilityLabel="새 꿈 추가">
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
          <Icon name="add" size={26} color="#fff" />
        </LinearGradient>
      </Pressable>
      {right.map((t) => <NavBtn key={t.key} tab={t} active={active === t.key} onPress={() => onChange(t.key)} />)}
    </View>
  );
}

function NavBtn({ tab, active, onPress }: {
  tab: { key: TabKey; label: string; icon: React.ComponentProps<typeof Icon>['name']; iconOn: React.ComponentProps<typeof Icon>['name'] };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.navBtn}>
      {active ? <View style={styles.activeDot} /> : null}
      <Icon name={active ? tab.iconOn : tab.icon} size={20} color={active ? colors.accentInk : colors.ink3} />
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
  addBtnWrap: {
    marginTop: -22, marginHorizontal: 8, borderRadius: 18,
    shadowColor: shadowColors.primary, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  addBtn: {
    width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
});
