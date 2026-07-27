import React, { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import { ScreenHeader } from '../components/Basics';
import BubbleButton from '../components/Button';
import { colors, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';

export default function FriendsScreen({ onOpenPerson, onInvite }: { onOpenPerson: (id: string, name: string) => void; onInvite: () => void }) {
  const { friends, refreshFriends, loadingFriends } = useApp();

  useEffect(() => { refreshFriends(); }, [refreshFriends]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={loadingFriends} onRefresh={refreshFriends} tintColor="#fff" />}
    >
      <ScreenHeader
        title="친구"
        subtitle="친구를 눌러 페이지로 들어가 함께 이뤄요"
        right={<BubbleButton small variant="line" title="👥 친구 초대" onPress={onInvite} />}
      />
      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 친구가 없어요. 초대 링크로 친구를 연결해보세요.</Text>
        </View>
      ) : (
        friends.map((f) => (
          <Pressable key={f.id} onPress={() => onOpenPerson(f.id, f.name)} style={styles.card}>
            <Avatar name={f.name} size={50} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{f.name}</Text>
              <Text style={styles.sub}>이룬 꿈 {f.doneCount} · 도전 중 {f.itemsCount - f.doneCount}{f.withMeCount ? ` · 함께 ${f.withMeCount}` : ''}</Text>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${f.itemsCount ? Math.round((f.doneCount / f.itemsCount) * 100) : 0}%` }]} /></View>
            </View>
            <Text style={{ color: colors.ink3, fontSize: 18 }}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, paddingHorizontal: 10 },
  emptyText: { color: colors.ink2, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, marginBottom: 10, ...shadow.sm },
  name: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12.5, color: colors.ink2, marginTop: 3 },
  bar: { height: 5, width: '80%', maxWidth: 150, backgroundColor: colors.surface3, borderRadius: 99, overflow: 'hidden', marginTop: 9 },
  barFill: { height: '100%', backgroundColor: colors.done, borderRadius: 99 },
});
