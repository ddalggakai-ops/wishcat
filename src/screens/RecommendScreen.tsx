import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import GradientCard from '../components/GradientCard';
import { ScreenHeader } from '../components/Basics';
import { colors, onGradient, radius } from '../theme';
import { getRecommendPosts } from '../services/templatesService';
import { RECOMMEND_POSTS, deriveRecommendGroups, type RecommendPost } from '../data/recommendPosts';

// 지역별 여행 가이드 포스팅 피드. 카드를 누르면 가이드를 읽고, 그 지역의 버킷을 골라 담을 수 있어요.
export default function RecommendScreen({ onOpenPost }: { onOpenPost: (post: RecommendPost) => void }) {
  const [posts, setPosts] = useState<RecommendPost[]>(RECOMMEND_POSTS);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    setLoading(true);
    try {
      const res = await getRecommendPosts(force ? { force: true } : undefined);
      if (res.length) setPosts(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor="#fff" />}
    >
      <ScreenHeader title="추천" subtitle="지역별 여행 가이드예요. 마음에 드는 버킷을 골라 내 목록에 담아보세요." />
      {deriveRecommendGroups(posts).map((g) => (
        <View key={g}>
          <Text style={styles.groupLabel}>{g}</Text>
          {posts.filter((p) => (p.group || '여행지') === g).map((p) => (
            <Pressable key={p.id} onPress={() => onOpenPost(p)} style={styles.cardWrap} accessibilityRole="button" accessibilityLabel={`${p.region} 여행 가이드 열기`}>
              <GradientCard role={p.role} borderRadius={radius.lg} style={{ flex: 1 }} contentStyle={styles.card}>
                <View style={styles.top}>
                  <View style={styles.regionChip}><Text style={[styles.regionText, { color: onGradient[p.role] }]}>📍 {p.region}</Text></View>
                  {p.readMinutes ? <Text style={[styles.read, { color: onGradient[p.role] }]}>가이드 · {p.readMinutes}분</Text> : null}
                </View>
                <Text style={styles.emoji}>{p.emoji}</Text>
                <Text style={[styles.title, { color: onGradient[p.role] }]}>{p.title}</Text>
                <Text style={[styles.teaser, { color: onGradient[p.role] }]} numberOfLines={2}>{p.teaser}</Text>
                <Text style={[styles.cta, { color: onGradient[p.role] }]}>읽고 담기 ›</Text>
              </GradientCard>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 13, fontWeight: '800', color: colors.ink2, marginTop: 14, marginBottom: 10 },
  cardWrap: { minHeight: 196, marginBottom: 12 },
  card: { flex: 1, padding: 18, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 글자색은 각 카드 role의 딥톤(onGradient)을 인라인으로 얹습니다 — 파스텔 배경은 그대로 두고
  // 흰 글씨(대비 1.39~3.80:1)만 바꿔서 AA를 맞췄어요. 알파를 섞으면 대비가 다시 깎이므로 쓰지 않습니다.
  regionChip: { backgroundColor: 'rgba(255,255,255,.30)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 11 },
  regionText: { fontSize: 12, fontWeight: '800' },
  read: { fontSize: 12, fontWeight: '700' },
  emoji: { fontSize: 40, marginTop: 8 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  teaser: { fontSize: 13.5, lineHeight: 19, marginTop: 6, fontWeight: '500' },
  cta: { fontSize: 13.5, fontWeight: '800', marginTop: 12 },
});
