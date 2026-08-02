import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import GradientCard from '../components/GradientCard';
import Icon from '../components/Icon';
import { EmptyState, ScreenHeader } from '../components/Basics';
import { colors, radius, shadow } from '../theme';
import { resolveImageUrl } from '../api/client';
import { getExploreItems } from '../services/exploreService';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

export default function ExploreScreen({
  onOpenItem, onToast,
}: {
  onOpenItem: (item: Item) => void;
  onToast: (msg: string) => void;
}) {
  const { mergeItems, toggleLike, joinItem, itemsById } = useApp();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'done'>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [joining, setJoining] = useState<Set<string>>(new Set());
  const [toggleW, setToggleW] = useState(0);
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const loadSeq = useRef(0);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    if (!user) return;
    const seq = ++loadSeq.current; // 필터를 빠르게 바꿀 때 뒤늦게 도착한 응답이 최신 결과를 덮어쓰지 않도록
    setLoading(true);
    setFailed(false);
    try {
      const res = await getExploreItems(user.id, filter, opts);
      if (seq !== loadSeq.current) return; // 더 새로운 요청이 이미 나갔으면 이 응답은 버립니다.
      setItems(res);
      mergeItems(res);
    } catch {
      // 예전엔 불러오기가 실패해도 그냥 "버킷이 없어요"라고만 떠서 다시 시도할 방법이 없었어요.
      if (seq === loadSeq.current) setFailed(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [filter, mergeItems, user]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => load({ force: true }), [load]);

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: filter === 'done' ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  }, [filter, toggleAnim]);

  // 트랙 안쪽 여백(3px)을 뺀 절반 너비만큼 슬라이드 알약을 밀어줍니다.
  const half = toggleW > 0 ? (toggleW - 6) / 2 : 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#fff" />}>
      <ScreenHeader title="둘러보기" subtitle="전체공개된 사람들의 버킷을 구경해요. 타일을 누르면 자세히 보고 내 목록에 담을 수 있어요." />
      <View style={styles.toggleTrack} onLayout={(e) => setToggleW(e.nativeEvent.layout.width)}>
        {toggleW > 0 ? (
          <Animated.View
            style={[
              styles.toggleThumb,
              { width: half, transform: [{ translateX: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, half] }) }] },
            ]}
          />
        ) : null}
        <Pressable onPress={() => setFilter('all')} style={styles.toggleHalf} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: filter === 'all' }}>
          <Text style={[styles.toggleText, filter === 'all' && styles.toggleTextOn]}>전체 버킷</Text>
        </Pressable>
        <Pressable onPress={() => setFilter('done')} style={styles.toggleHalf} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: filter === 'done' }}>
          <Text style={[styles.toggleText, filter === 'done' && styles.toggleTextOn]}>이룬 꿈</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        failed ? (
          <View>
            <EmptyState icon="alert-circle-outline" title="불러오지 못했어요" subtitle="네트워크 상태를 확인하고 다시 시도해주세요" />
            {!loading ? (
              <Pressable onPress={() => load({ force: true })} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="다시 시도">
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <EmptyState icon="compass-outline" title="해당하는 버킷이 없어요" subtitle="다른 필터를 눌러보세요" />
        )
      ) : (
        <View style={styles.grid}>
          {items.map((raw, idx) => {
            // 담기/좋아요 직후 값이 바로 반영되도록 전역 캐시를 우선 씁니다.
            const i = itemsById[raw.id] || raw;
            const photo = resolveImageUrl(i.memory?.photo);
            const joined = !!user && i.participants.some((p) => p.id === user.id);
            const canSave = !!user && i.owner.id !== user.id && !i.done && !joined;
            const role = idx % 2 === 0 ? 'secondary' : 'accent';
            const onWhite = !!photo;

            const saveBtn = (
              <Pressable
                onPress={() => {
                  if (joined) { onToast('이미 담은 꿈이에요'); return; }
                  if (!canSave) { onOpenItem(i); return; }
                  if (joining.has(i.id)) return; // 빠른 더블탭으로 중복 담기 방지
                  setJoining((prev) => new Set(prev).add(i.id));
                  joinItem(i.id)
                    .then(() => onToast('내 목록에 담았어요 ✦'))
                    .catch(() => onToast('담지 못했어요. 잠시 뒤 다시 시도해주세요'))
                    .finally(() => setJoining((prev) => { const n = new Set(prev); n.delete(i.id); return n; }));
                }}
                disabled={joining.has(i.id)}
                hitSlop={6}
                style={styles.likeBtn}
                accessibilityRole="button"
                accessibilityLabel={joined ? '이미 담음' : '내 목록에 담기'}
              >
                <Icon name={joined ? 'bookmark' : 'bookmark-outline'} size={14} color={onWhite ? (joined ? colors.accent : colors.ink3) : '#fff'} />
                <Text style={[styles.countText, onWhite && joined && { color: colors.accent }, !onWhite && styles.countTextOnDark]}>
                  {joined ? '담음' : i.savesCount}
                </Text>
              </Pressable>
            );

            const likeBtn = (
              <Pressable onPress={() => toggleLike(i.id)} style={styles.likeBtn}>
                <Icon name={i.likedByMe ? 'heart' : 'heart-outline'} size={14} color={onWhite ? (i.likedByMe ? colors.like : colors.ink3) : '#fff'} />
                <Text style={[styles.countText, !onWhite && styles.countTextOnDark]}>{i.likesCount}</Text>
              </Pressable>
            );

            if (photo) {
              return (
                <Pressable key={i.id} onPress={() => onOpenItem(i)} style={styles.tile}>
                  <View style={styles.thumbWrap}>
                    <Image source={{ uri: photo }} style={styles.thumb} />
                    {i.hot ? <View style={styles.badge}><Text style={styles.badgeText}>인기</Text></View> : null}
                    {i.done ? <View style={styles.doneBadge}><Icon name="checkmark" size={14} color="#fff" /></View> : null}
                  </View>
                  <View style={styles.tileMeta}>
                    <Text numberOfLines={2} style={styles.tileTitle}>{i.title}</Text>
                    <View style={styles.ownerRow}>
                      <Avatar name={i.owner.name} photoUrl={i.owner.photoUrl} size={18} />
                      <Text style={styles.ownerName}>{i.owner.name}님</Text>
                    </View>
                    <View style={styles.counts}>{likeBtn}{saveBtn}</View>
                  </View>
                </Pressable>
              );
            }

            return (
              <Pressable key={i.id} onPress={() => onOpenItem(i)} style={styles.tileGradientWrap}>
                <GradientCard role={role} style={{ flex: 1 }} contentStyle={styles.tileGradientInner}>
                  <View style={styles.tileGradientTop}>
                    <View style={styles.ownerRowDark}>
                      <Avatar name={i.owner.name} photoUrl={i.owner.photoUrl} size={18} />
                      <Text style={styles.ownerNameDark}>{i.owner.name}님</Text>
                    </View>
                    {i.hot ? <View style={styles.badgeOnGradient}><Text style={styles.badgeText}>인기</Text></View> : null}
                  </View>
                  <Text style={styles.tileEmoji}>{i.emoji}</Text>
                  <Text numberOfLines={2} style={styles.tileTitleDark}>{i.title}</Text>
                  {i.categories?.length ? (
                    <View style={styles.tileChip}><Text style={styles.tileChipText}>{i.categories.join(' · ')}</Text></View>
                  ) : null}
                  <View style={styles.countsDark}>
                    {likeBtn}
                    {saveBtn}
                    {i.done ? <View style={styles.doneBadgeOnGradient}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓ 완료</Text></View> : null}
                  </View>
                </GradientCard>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toggleTrack: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 13, padding: 3, alignSelf: 'flex-start', marginBottom: 6, position: 'relative' },
  toggleThumb: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 10, backgroundColor: colors.surface, ...shadow.sm },
  toggleHalf: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10 },
  retryBtn: { alignSelf: 'center', marginTop: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingVertical: 10, paddingHorizontal: 22 },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.ink3, textAlign: 'center' },
  toggleTextOn: { color: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 8 },
  tile: { width: '47.6%', backgroundColor: colors.surface, borderRadius: 19, overflow: 'hidden', ...shadow.sm },
  tileGradientWrap: { width: '47.6%', minHeight: 190 },
  tileGradientInner: { flex: 1, padding: 14, justifyContent: 'space-between' },
  tileGradientTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ownerRowDark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownerNameDark: { fontSize: 11, color: 'rgba(255,255,255,.92)', fontWeight: '600' },
  badgeOnGradient: { backgroundColor: 'rgba(255,255,255,.28)', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 9 },
  tileEmoji: { fontSize: 30, marginTop: 10 },
  tileTitleDark: { fontSize: 13.5, fontWeight: '700', color: '#fff', lineHeight: 18, marginTop: 6 },
  tileChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.26)', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 9, marginTop: 8 },
  tileChipText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  countsDark: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  countTextOnDark: { color: 'rgba(255,255,255,.92)' },
  doneBadgeOnGradient: { backgroundColor: 'rgba(255,255,255,.24)', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 8, marginLeft: 'auto' },
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
