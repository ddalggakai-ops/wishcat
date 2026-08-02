import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import GradientCard from '../components/GradientCard';
import { ScreenHeader } from '../components/Basics';
import { colors, radius } from '../theme';
import { getRecommendPosts } from '../services/templatesService';
import { RECOMMEND_POSTS, type RecommendPost } from '../data/recommendPosts';

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
      {posts.map((p) => (
        <Pressable key={p.id} onPress={() => onOpenPost(p)} style={styles.cardWrap} accessibilityRole="button" accessibilityLabel={`${p.region} 여행 가이드 열기`}>
          <GradientCard role={p.role} borderRadius={radius.lg} style={{ flex: 1 }} contentStyle={styles.card}>
            <View style={styles.top}>
              <View style={styles.regionChip}><Text style={styles.regionText}>📍 {p.region}</Text></View>
              {p.readMinutes ? <Text style={styles.read}>가이드 · {p.readMinutes}분</Text> : null}
            </View>
            <Text style={styles.emoji}>{p.emoji}</Text>
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.teaser} numberOfLines={2}>{p.teaser}</Text>
            <Text style={styles.cta}>읽고 담기 ›</Text>
          </GradientCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardWrap: { minHeight: 196, marginBottom: 12 },
  card: { flex: 1, padding: 18, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  regionChip: { backgroundColor: 'rgba(255,255,255,.26)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 11 },
  regionText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  read: { fontSize: 11.5, color: 'rgba(255,255,255,.9)', fontWeight: '600' },
  emoji: { fontSize: 40, marginTop: 8 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 6 },
  teaser: { fontSize: 13.5, color: 'rgba(255,255,255,.92)', lineHeight: 19, marginTop: 6 },
  cta: { fontSize: 13.5, fontWeight: '800', color: '#fff', marginTop: 12 },
});
