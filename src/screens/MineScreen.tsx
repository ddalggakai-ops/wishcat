import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import BubbleButton from '../components/Button';
import { EmptyState, SectionHeader } from '../components/Basics';
import ItemCard from '../components/ItemCard';
import { colors, radius, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useApp, useMyItems } from '../context/AppContext';
import type { Item } from '../api/types';

export default function MineScreen({
  onEditProfile, onMemory, onShare, onMenu, onBulkImport,
}: {
  onEditProfile: () => void;
  onMemory: (item: Item) => void;
  onShare: (item: Item) => void;
  onMenu: (item: Item) => void;
  onBulkImport: () => void;
}) {
  const { user, updateMe } = useAuth();
  const { refreshMine, loadingMine, completeItem, reopenItem } = useApp();
  const items = useMyItems();
  const [compact, setCompact] = useState(false);

  useEffect(() => { refreshMine(); }, [refreshMine]);

  const todo = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;

  const onToggleDone = useCallback((item: Item) => {
    if (item.origin === 'helped') { onMemory(item); return; }
    if (!item.done) onMemory(item);
    else reopenItem(item.id);
  }, [onMemory, reopenItem]);

  if (!user) return null;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={loadingMine} onRefresh={refreshMine} tintColor="#fff" />}
    >
      <View style={styles.profile}>
        <Text style={styles.sticker}>✦</Text>
        <View style={styles.pTop}>
          <Avatar name={user.name} size={74} dashed />
          <View style={styles.stats}>
            <Stat label="꿈" value={items.length} />
            <Stat label="이룬 꿈" value={done.length} />
          </View>
        </View>
        <Text style={styles.pName}>{user.name}</Text>
        <Text style={styles.pBio}>{user.bio}</Text>
        <View style={styles.pActions}>
          <BubbleButton small variant="ghost" title="프로필 편집" onPress={onEditProfile} style={{ flex: 1 }} />
          <BubbleButton
            small
            variant={user.listPublic ? 'ghost' : 'primary'}
            title={user.listPublic ? '전체공개' : '비공개'}
            onPress={() => updateMe({ listPublic: !user.listPublic })}
            style={{ flex: 1 }}
          />
        </View>
        {items.length > 0 && (
          <View style={styles.prog}>
            <View style={styles.progTrack}><View style={[styles.progFill, { width: `${pct}%` }]} /></View>
            <Text style={styles.progText}>{pct}% 달성 · 이룬 꿈 {done.length} · 도전 중 {todo.length}</Text>
          </View>
        )}
      </View>

      {items.length === 0 ? (
        <>
          <EmptyState icon="🚩" title="아직 꿈이 없어요" subtitle="아래 + 버튼으로 첫 번째 꿈을 적어보세요" />
          <BubbleButton small variant="line" title="📊 엑셀로 여러 개 한 번에 추가" onPress={onBulkImport} style={{ alignSelf: 'center' }} />
        </>
      ) : (
        <>
          <View style={styles.listBar}>
            <Pressable onPress={onBulkImport} style={styles.viewToggle}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.ink2 }}>📊 엑셀로 추가</Text>
            </Pressable>
            <Pressable onPress={() => setCompact(!compact)} style={styles.viewToggle}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.ink2 }}>{compact ? '상세 보기' : '간단히 보기'}</Text>
            </Pressable>
          </View>
          {todo.length > 0 && (
            <>
              <SectionHeader title="도전 중" count={todo.length} />
              {todo.map((i) => (
                <ItemCard key={i.id} item={i} ctx="mine" compact={compact} onToggleDone={onToggleDone} onMemory={onMemory} onShare={onShare} onMenu={onMenu} />
              ))}
            </>
          )}
          {done.length > 0 && (
            <>
              <SectionHeader title="이룬 꿈" count={done.length} />
              {done.map((i) => (
                <ItemCard key={i.id} item={i} ctx="mine" compact={compact} onToggleDone={onToggleDone} onMemory={onMemory} onShare={onShare} onMenu={onMenu} />
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 26, padding: 20, marginTop: 8, ...shadow.md },
  sticker: { position: 'absolute', top: -15, right: 24, fontSize: 30, color: colors.candyYellow, transform: [{ rotate: '14deg' }] },
  pTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11.5, color: colors.ink2 },
  pName: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 15 },
  pBio: { fontSize: 13.5, color: colors.ink2, marginTop: 4, lineHeight: 19 },
  pActions: { flexDirection: 'row', gap: 8, marginTop: 15 },
  prog: { marginTop: 16 },
  progTrack: { height: 6, borderRadius: 99, backgroundColor: colors.surface3, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: colors.done, borderRadius: 99 },
  progText: { fontSize: 12, color: colors.ink2, marginTop: 9 },
  listBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: -4 },
  viewToggle: { borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12 },
});
