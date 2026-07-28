import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import { EmptyState, ScreenHeader } from '../components/Basics';
import { colors, radius, shadow } from '../theme';
import { resolveImageUrl } from '../api/client';
import { getExploreItems } from '../services/exploreService';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

export default function ExploreScreen({ onOpenPerson }: { onOpenPerson: (id: string, name: string) => void }) {
  const { mergeItems, toggleLike } = useApp();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'done'>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getExploreItems(user.id, filter);
      setItems(res);
      mergeItems(res);
    } finally {
      setLoading(false);
    }
  }, [filter, mergeItems, user]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#fff" />}>
      <ScreenHeader title="둘러보기" subtitle="전체공개된 사람들의 버킷을 구경해요. 타일을 누르면 그 사람 페이지로 이동해요." />
      <View style={styles.filterBar}>
        <Pressable onPress={() => setFilter('all')} style={[styles.filterBtn, filter === 'all' && styles.filterBtnOn]}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextOn]}>전체 버킷</Text>
        </Pressable>
        <Pressable onPress={() => setFilter('done')} style={[styles.filterBtn, filter === 'done' && styles.filterBtnOn]}>
          <Text style={[styles.filterText, filter === 'done' && styles.filterTextOn]}>이룬 꿈</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="🧭" title="해당하는 버킷이 없어요" subtitle="다른 필터를 눌러보세요" />
      ) : (
        <View style={styles.grid}>
          {items.map((i) => {
            const photo = resolveImageUrl(i.memory?.photo);
            return (
              <Pressable key={i.id} onPress={() => onOpenPerson(i.owner.id, i.owner.name)} style={styles.tile}>
                <View style={styles.thumbWrap}>
                  {photo ? <Image source={{ uri: photo }} style={styles.thumb} /> : (
                    <View style={[styles.thumb, styles.thumbPh]}><Text style={{ fontSize: 40 }}>{i.emoji}</Text></View>
                  )}
                  {i.hot ? <View style={styles.badge}><Text style={styles.badgeText}>인기</Text></View> : null}
                  {i.done ? <View style={styles.doneBadge}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text></View> : null}
                </View>
                <View style={styles.tileMeta}>
                  <Text numberOfLines={2} style={styles.tileTitle}>{i.title}</Text>
                  <View style={styles.ownerRow}>
                    <Avatar name={i.owner.name} photoUrl={i.owner.photoUrl} size={18} />
                    <Text style={styles.ownerName}>{i.owner.name}님</Text>
                  </View>
                  <View style={styles.counts}>
                    <Pressable onPress={() => toggleLike(i.id)} style={styles.likeBtn}>
                      <Text style={{ color: i.likedByMe ? colors.like : colors.ink3 }}>{i.likedByMe ? '♥' : '♡'}</Text>
                      <Text style={styles.countText}>{i.likesCount}</Text>
                    </Pressable>
                    <View style={styles.likeBtn}>
                      <Text style={{ color: colors.ink3 }}>🔖</Text>
                      <Text style={styles.countText}>{i.savesCount}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filterBar: { flexDirection: 'row', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 3, gap: 2, alignSelf: 'flex-start', marginBottom: 6 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  filterBtnOn: { backgroundColor: colors.surface, ...shadow.sm },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.ink3 },
  filterTextOn: { color: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 8 },
  tile: { width: '47.6%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 19, overflow: 'hidden', ...shadow.sm },
  thumbWrap: { position: 'relative' },
  thumb: { width: '100%', aspectRatio: 1 },
  thumbPh: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.candyPink, borderRadius: 99, paddingVertical: 3, paddingHorizontal: 9, transform: [{ rotate: '-6deg' }] },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  doneBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.done, alignItems: 'center', justifyContent: 'center' },
  tileMeta: { padding: 11 },
  tileTitle: { fontSize: 13, fontWeight: '600', color: colors.ink, lineHeight: 17 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  ownerName: { fontSize: 11.5, color: colors.ink2 },
  counts: { flexDirection: 'row', gap: 14, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countText: { fontSize: 11.5, fontWeight: '600', color: colors.ink2 },
});
