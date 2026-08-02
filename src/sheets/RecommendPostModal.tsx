import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BubbleButton from '../components/Button';
import Icon from '../components/Icon';
import { colors, gradients, radius } from '../theme';
import { useApp } from '../context/AppContext';
import { alertDialog } from '../utils/dialog';
import type { RecommendPost } from '../data/recommendPosts';

// 지역 여행 가이드 리더 + 마지막에 '내 목록에 담기'. 원하는 버킷만 골라 한 번에 담아요.
export default function RecommendPostModal({
  post, onClose, onToast,
}: {
  post: RecommendPost | null;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { bulkAddItems } = useApp();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // 열 때마다 전부 선택된 상태로 시작합니다.
  useEffect(() => {
    if (!post) return;
    const next: Record<string, boolean> = {};
    post.items.forEach((it) => { next[it.title] = true; });
    setPicked(next);
  }, [post]);

  const chosen = useMemo(() => (post?.items || []).filter((it) => picked[it.title]), [post, picked]);

  if (!post) return null;

  const add = async () => {
    if (!chosen.length) return;
    setSaving(true);
    try {
      const n = await bulkAddItems(chosen);
      onToast(`${n}개를 내 목록에 담았어요 ✦`);
      onClose();
    } catch {
      await alertDialog('담지 못했어요', '잠시 뒤 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!post} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients[post.role]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, { paddingTop: insets.top + 14 }]}>
            <Pressable onPress={onClose} style={styles.back} hitSlop={12} accessibilityRole="button" accessibilityLabel="닫기">
              <Icon name="chevron-down" size={22} color="#fff" />
            </Pressable>
            <View style={styles.regionChip}><Text style={styles.regionText}>📍 {post.region}</Text></View>
            <Text style={styles.coverEmoji}>{post.emoji}</Text>
            <Text style={styles.coverTitle}>{post.title}</Text>
            <Text style={styles.coverMeta}>여행 가이드{post.readMinutes ? ` · ${post.readMinutes}분` : ''}</Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.teaser}>{post.teaser}</Text>

            {post.sections.map((s, i) => (
              <View key={i} style={styles.section}>
                <Text style={styles.heading}>{s.heading}</Text>
                <Text style={styles.para}>{s.body}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            <Text style={styles.pickTitle}>이 여행에서 담을 버킷</Text>
            <Text style={styles.pickSub}>원하는 것만 골라 내 목록에 담아요. 담은 뒤에 얼마든지 고칠 수 있어요.</Text>

            {post.items.map((it) => {
              const on = !!picked[it.title];
              return (
                <Pressable
                  key={it.title}
                  onPress={() => setPicked((p) => ({ ...p, [it.title]: !p[it.title] }))}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Icon name="checkmark" size={13} color="#fff" /> : null}
                  </View>
                  <Text style={{ fontSize: 17 }}>{it.emoji}</Text>
                  <Text style={[styles.rowTitle, on && styles.rowTitleOn]} numberOfLines={2}>{it.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <BubbleButton
            title={chosen.length ? `${chosen.length}개 내 목록에 담기` : '담을 항목을 골라주세요'}
            onPress={add}
            disabled={!chosen.length}
            loading={saving}
            full
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cover: { paddingHorizontal: 22, paddingBottom: 26 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  regionChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.26)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 11 },
  regionText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  coverEmoji: { fontSize: 48, marginTop: 14 },
  coverTitle: { fontSize: 25, fontWeight: '800', color: '#fff', marginTop: 8, lineHeight: 32 },
  coverMeta: { fontSize: 12.5, color: 'rgba(255,255,255,.9)', fontWeight: '600', marginTop: 8 },

  body: { paddingHorizontal: 22, paddingTop: 20 },
  teaser: { fontSize: 15, color: colors.ink, fontWeight: '600', lineHeight: 23, marginBottom: 6 },
  section: { marginTop: 18 },
  heading: { fontSize: 16.5, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  para: { fontSize: 14.5, color: colors.ink2, lineHeight: 24 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 24 },
  pickTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  pickSub: { fontSize: 12.5, color: colors.ink2, marginTop: 5, marginBottom: 12, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: radius.sm, marginTop: 8, backgroundColor: colors.surface2,
  },
  rowOn: { backgroundColor: colors.accentWash },
  check: { width: 22, height: 22, borderRadius: 7, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent },
  rowTitle: { flex: 1, fontSize: 14.5, color: colors.ink2 },
  rowTitleOn: { color: colors.ink, fontWeight: '600' },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 20, paddingTop: 12,
  },
});
