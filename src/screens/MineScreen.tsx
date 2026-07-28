import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Avatar from '../components/Avatar';
import BubbleButton from '../components/Button';
import { EmptyState, SectionHeader } from '../components/Basics';
import ItemCard from '../components/ItemCard';
import { CATEGORIES, catColor, colors, radius, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useApp, useMyItems } from '../context/AppContext';
import type { Item } from '../api/types';

export default function MineScreen({
  onEditProfile, onMemory, onShare, onMenu, onBulkImport, onStarter,
}: {
  onEditProfile: () => void;
  onMemory: (item: Item) => void;
  onShare: (item: Item) => void;
  onMenu: (item: Item) => void;
  onBulkImport: () => void;
  onStarter: () => void;
}) {
  const { user, updateMe } = useAuth();
  const { refreshMine, loadingMine, completeItem, reopenItem } = useApp();
  const items = useMyItems();
  const [compact, setCompact] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => { refreshMine(); }, [refreshMine]);

  // 진행률/전체 통계는 필터와 무관하게 항상 전체 목록 기준으로 보여줍니다.
  const pct = items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;
  const doneTotal = items.filter((i) => i.done).length;
  const todoTotal = items.length - doneTotal;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.note || '').toLowerCase().includes(q) ||
        (i.location?.name || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, categoryFilter]);

  const isFiltering = !!search.trim() || !!categoryFilter;
  const todo = filteredItems.filter((i) => !i.done);
  const done = filteredItems.filter((i) => i.done);

  const onToggleDone = useCallback((item: Item) => {
    if (item.origin === 'helped') { onMemory(item); return; }
    if (!item.done) onMemory(item);
    else reopenItem(item.id);
  }, [onMemory, reopenItem]);

  if (!user) return null;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={loadingMine} onRefresh={refreshMine} tintColor="#fff" />}
    >
      <View style={styles.profile}>
        <Text style={styles.sticker}>✦</Text>
        <View style={styles.pTop}>
          <Avatar name={user.name} photoUrl={user.photoUrl} size={74} dashed />
          <View style={styles.stats}>
            <Stat label="꿈" value={items.length} />
            <Stat label="이룬 꿈" value={doneTotal} />
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
            <Text style={styles.progText}>{pct}% 달성 · 이룬 꿈 {doneTotal} · 도전 중 {todoTotal}</Text>
          </View>
        )}
      </View>

      {items.length === 0 ? (
        <>
          <EmptyState icon="🚩" title="아직 꿈이 없어요" subtitle="뭘 적을지 막막하다면 아래에서 골라 담아보세요" />
          <BubbleButton title="✦ 시작 템플릿에서 골라 담기" onPress={onStarter} full style={{ marginTop: 2 }} />
          <BubbleButton small variant="line" title="📊 엑셀로 여러 개 한 번에 추가" onPress={onBulkImport} style={{ alignSelf: 'center', marginTop: 10 }} />
          <Text style={styles.emptyHint}>직접 쓰고 싶다면 아래 + 버튼을 눌러주세요</Text>
        </>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="제목 · 메모 · 장소로 검색"
              placeholderTextColor={colors.ink3}
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Text style={styles.searchClear}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <FilterChip label="전체" active={!categoryFilter} onPress={() => setCategoryFilter(null)} />
            {CATEGORIES.map((c) => (
              <FilterChip key={c} label={c} active={categoryFilter === c} onPress={() => setCategoryFilter(categoryFilter === c ? null : c)} />
            ))}
          </ScrollView>

          <View style={styles.listBar}>
            <Pressable onPress={onBulkImport} style={styles.viewToggle}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.ink2 }}>📊 엑셀로 추가</Text>
            </Pressable>
            <Pressable onPress={() => setCompact(!compact)} style={styles.viewToggle}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.ink2 }}>{compact ? '상세 보기' : '간단히 보기'}</Text>
            </Pressable>
          </View>

          {isFiltering && filteredItems.length === 0 ? (
            <EmptyState icon="🔍" title="검색 결과가 없어요" subtitle="다른 검색어나 카테고리를 눌러보세요" />
          ) : (
            <>
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
        </>
      )}
    </ScrollView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const cc = catColor(label === '전체' ? null : label);
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? colors.accent : cc.bg }]}>
      <Text style={{ color: active ? '#fff' : cc.ink, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
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
  listBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: -4 },
  viewToggle: { borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.line2, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 10, marginTop: 18,
  },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  searchClear: { fontSize: 13, color: colors.ink3, paddingHorizontal: 2 },
  chipRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  emptyHint: { fontSize: 12, color: 'rgba(255,255,255,.9)', textAlign: 'center', marginTop: 12, fontWeight: '600' },
  chip: { borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13 },
});
