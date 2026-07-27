import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import { EmptyState, SectionHeader } from '../components/Basics';
import ItemCard from '../components/ItemCard';
import { colors, radius, shadow } from '../theme';
import { resolveImageUrl } from '../api/client';
import { getPerson, type PersonResult } from '../services/personService';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

type PersonResponse = PersonResult;

export default function PersonScreen({
  userId, isFriendTab, onBack, onOpenViewer, onHelp,
}: {
  userId: string;
  isFriendTab: boolean;
  onBack: () => void;
  onOpenViewer: (item: Item) => void;
  onHelp: (item: Item) => void;
}) {
  const { mergeItems, joinItem } = useApp();
  const { user: viewer } = useAuth();
  const [data, setData] = useState<PersonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!viewer) return;
    setLoading(true);
    try {
      const res = await getPerson(userId, viewer.id);
      setData(res);
      if (res.items) mergeItems(res.items);
    } finally {
      setLoading(false);
    }
  }, [userId, mergeItems, viewer]);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <BackBtn label={isFriendTab ? '친구' : '둘러보기'} onPress={onBack} />
      </ScrollView>
    );
  }

  const items = data.items || [];
  const todo = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const ctx = isFriendTab || data.isFriend ? 'friend' : 'explore';

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#fff" />}>
      <BackBtn label={isFriendTab ? '친구' : '둘러보기'} onPress={onBack} />
      <View style={styles.head}>
        <Avatar name={data.user.name} size={58} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={styles.name}>{data.user.name}</Text>
          </View>
          <Text style={styles.bio}>{ctx === 'friend' ? '함께 꿈꾸는 친구' : data.user.bio}</Text>
          <Text style={styles.stats}>꿈 {items.length} · 이룬 꿈 {done.length}{data.withMeCount ? ` · 함께 ${data.withMeCount}` : ''}</Text>
        </View>
      </View>

      {data.items === null ? (
        <EmptyState icon="🔒" title="비공개 목록이에요" subtitle="이 사람이 목록을 공개하면 볼 수 있어요" />
      ) : (
        <>
          {todo.length > 0 && (
            <>
              <SectionHeader title="도전 중인 꿈" count={todo.length} />
              {todo.map((i) => (
                <ItemCard key={i.id} item={i} ctx={ctx} onJoin={(it) => joinItem(it.id)} onHelp={onHelp} />
              ))}
            </>
          )}
          {done.length > 0 && (
            <>
              <SectionHeader title="이룬 꿈" count={done.length} />
              <View style={styles.grid}>
                {done.map((i) => (
                  <Pressable key={i.id} onPress={() => onOpenViewer(i)} style={styles.gridCard}>
                    {resolveImageUrl(i.memory?.photo) ? (
                      <Image source={{ uri: resolveImageUrl(i.memory?.photo) }} style={styles.gridImg} />
                    ) : (
                      <View style={[styles.gridImg, styles.gridPh]}><Text style={{ fontSize: 30 }}>{i.emoji}</Text></View>
                    )}
                    <View style={styles.gridInfo}>
                      <Text numberOfLines={1} style={styles.gridTitle}>{i.title}</Text>
                      <Text style={styles.gridDate}>{i.memory?.date}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {items.length === 0 && <EmptyState icon="✦" title="아직 등록한 꿈이 없어요" subtitle="곧 새로운 꿈이 올라올 거예요" />}
        </>
      )}
    </ScrollView>
  );
}

function BackBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backBtn}>
      <Text style={styles.backText}>‹ {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backBtn: { paddingVertical: 20, paddingBottom: 10 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  name: { fontSize: 21, fontWeight: '700', color: colors.ink },
  bio: { fontSize: 12.5, color: colors.ink2, marginTop: 2 },
  stats: { fontSize: 12.5, color: colors.ink2, marginTop: 6, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 2 },
  gridCard: { width: '47.6%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden', ...shadow.sm },
  gridImg: { width: '100%', aspectRatio: 1 },
  gridPh: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  gridInfo: { padding: 10 },
  gridTitle: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  gridDate: { fontSize: 11, color: colors.ink3, marginTop: 4 },
});
