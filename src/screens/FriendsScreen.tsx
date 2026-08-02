import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import { ScreenHeader } from '../components/Basics';
import BubbleButton from '../components/Button';
import { colors, radius, shadow } from '../theme';
import { getIncomingRequests, acceptFriendRequest, declineFriendRequest, type IncomingRequest } from '../services/friendsService';
import { alertDialog } from '../utils/dialog';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export default function FriendsScreen({ onOpenPerson, onInvite }: { onOpenPerson: (id: string, name: string) => void; onInvite: () => void }) {
  const { friends, refreshFriends, loadingFriends } = useApp();
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadIncoming = useCallback(async () => {
    if (!user) return;
    try { setIncoming(await getIncomingRequests(user.id)); } catch { /* 무시 */ }
  }, [user]);

  useEffect(() => { refreshFriends(); loadIncoming(); }, [refreshFriends, loadIncoming]);
  const onRefresh = useCallback(() => { refreshFriends({ force: true }); loadIncoming(); }, [refreshFriends, loadIncoming]);

  const respond = useCallback(async (fromId: string, accept: boolean) => {
    if (!user) return;
    setBusyId(fromId);
    try {
      if (accept) await acceptFriendRequest(fromId, user.id);
      else await declineFriendRequest(fromId, user.id);
      setIncoming((prev) => prev.filter((r) => r.from.id !== fromId));
      if (accept) refreshFriends({ force: true });
    } catch {
      await alertDialog('처리하지 못했어요', '잠시 뒤 다시 시도해주세요.');
    } finally {
      setBusyId(null);
    }
  }, [user, refreshFriends]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={loadingFriends} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <ScreenHeader
        title="친구"
        subtitle="친구를 눌러 페이지로 들어가 함께 이뤄요"
        right={<BubbleButton small variant="line" title="👥 친구 초대" onPress={onInvite} />}
      />

      {incoming.length > 0 && (
        <View style={styles.reqSection}>
          <Text style={styles.reqTitle}>받은 친구 신청 {incoming.length}</Text>
          {incoming.map((r) => (
            <View key={r.from.id} style={styles.reqCard}>
              <Pressable onPress={() => onOpenPerson(r.from.id, r.from.name)} style={styles.reqWho}>
                <Avatar name={r.from.name} photoUrl={r.from.photoUrl} size={40} />
                <Text style={styles.reqName} numberOfLines={1}>{r.from.name}</Text>
              </Pressable>
              <View style={styles.reqBtns}>
                <BubbleButton small variant="primary" title="수락" onPress={() => respond(r.from.id, true)} loading={busyId === r.from.id} />
                <BubbleButton small variant="ghost" title="거절" onPress={() => respond(r.from.id, false)} disabled={busyId === r.from.id} />
              </View>
            </View>
          ))}
        </View>
      )}

      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 친구가 없어요. 초대 링크로 친구를 연결해보세요.</Text>
        </View>
      ) : (
        friends.map((f) => (
          <Pressable key={f.id} onPress={() => onOpenPerson(f.id, f.name)} style={styles.card}>
            <Avatar name={f.name} photoUrl={f.photoUrl} size={50} />
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
  reqSection: { marginBottom: 14 },
  reqTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink2, marginBottom: 8 },
  reqCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.accentWash, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  reqWho: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  reqName: { fontSize: 14, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  reqBtns: { flexDirection: 'row', gap: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 20, padding: 14, marginBottom: 10, ...shadow.sm },
  name: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12.5, color: colors.ink2, marginTop: 3 },
  bar: { height: 5, width: '80%', maxWidth: 150, backgroundColor: colors.surface3, borderRadius: 99, overflow: 'hidden', marginTop: 9 },
  barFill: { height: '100%', backgroundColor: colors.done, borderRadius: 99 },
});
