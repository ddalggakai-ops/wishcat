import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Avatar from '../components/Avatar';
import BubbleButton from '../components/Button';
import GradientCard from '../components/GradientCard';
import ProgressRing from '../components/ProgressRing';
import { EmptyState, SectionHeader } from '../components/Basics';
import ItemCard from '../components/ItemCard';
import Icon from '../components/Icon';
import { CATEGORIES, catColor, colors, radius, shadow } from '../theme';
import { alertDialog, confirmDialog } from '../utils/dialog';
import { useAuth } from '../context/AuthContext';
import { useApp, useMyItems } from '../context/AppContext';
import type { Item } from '../api/types';

const RANDOM_PICK_COUNT = 6;
const PRIORITY_RANK: Record<string, number> = { high: 0, mid: 1, low: 2 };

export default function MineScreen({
  onEditProfile, onMemory, onShare, onMenu, onStarter, onEdit, onDetail,
}: {
  onEditProfile: () => void;
  onMemory: (item: Item) => void;
  onShare: (item: Item) => void;
  onMenu: (item: Item) => void;
  onStarter: () => void;
  /** 카드(빈 곳)를 눌렀을 때 — 자세히 보기에서는 곧장 수정으로 */
  onEdit: (item: Item) => void;
  /** 카드(빈 곳)를 눌렀을 때 — 간단히 보기에서는 상세보기로 */
  onDetail: (item: Item) => void;
}) {
  const { user, updateMe } = useAuth();
  const { refreshMine, loadingMine, reopenItem, deleteItems, completeItems, reorderItems, startItem, stopItem, mineIds } = useApp();
  const items = useMyItems();
  const [compact, setCompact] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [sortByPriority, setSortByPriority] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const scrollRef = useRef<ScrollView>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const scrollDims = useRef({ contentHeight: 0, viewportHeight: 0 });
  const doneSectionY = useRef(0);

  useEffect(() => { refreshMine(); }, [refreshMine]);
  const onRefresh = useCallback(() => refreshMine({ force: true }), [refreshMine]);

  // 지금 내가 가진 아이템에 실제로 쓰인 카테고리만 필터로 보여줍니다. (전체 8개를 다 보여주면
  // 정작 내 목록엔 없는 카테고리도 계속 떠서 고를 게 없는 빈 목록만 나오기 쉬웠어요)
  const presentCategories = useMemo(
    () => CATEGORIES.filter((c) => items.some((i) => i.categories?.includes(c))),
    [items]
  );
  useEffect(() => {
    setCategoryFilters((prev) => {
      const next = prev.filter((c) => presentCategories.includes(c));
      return next.length === prev.length ? prev : next;
    });
  }, [presentCategories]);

  const updateScrollState = useCallback((contentHeight: number, viewportHeight: number) => {
    scrollDims.current = { contentHeight, viewportHeight };
    setScrollable(contentHeight - viewportHeight > 40);
  }, []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    setAtTop(contentOffset.y < 120);
    setAtBottom(contentOffset.y + layoutMeasurement.height >= contentSize.height - 120);
  }, []);
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);
  const scrollToBottom = useCallback(() => scrollRef.current?.scrollToEnd({ animated: true }), []);

  // 상단 "이룬 꿈" 통계를 누르면 아래 "이룬 꿈" 구획으로 스크롤합니다.
  // 검색/카테고리 필터가 걸려 있으면 그 구획이 아예 안 보일 수 있어서 먼저 필터를 지운 뒤,
  // 레이아웃이 다시 잡힐 시간을 살짝 주고 나서 이동합니다.
  const scrollToDone = useCallback(() => {
    if (!items.some((i) => i.done)) return;
    const jump = () => scrollRef.current?.scrollTo({ y: Math.max(0, doneSectionY.current - 12), animated: true });
    if (search.trim() || categoryFilters.length) {
      setSearch('');
      setCategoryFilters([]);
      setTimeout(jump, 250);
    } else {
      jump();
    }
  }, [items, search, categoryFilters]);

  const onToggleVisibility = useCallback(async () => {
    if (!user || togglingVisibility) return;
    setTogglingVisibility(true);
    try {
      await updateMe({ listPublic: !user.listPublic }, { knownItemIds: mineIds });
    } finally {
      setTogglingVisibility(false);
    }
  }, [user, togglingVisibility, updateMe, mineIds]);

  // 진행률/전체 통계는 필터와 무관하게 항상 전체 목록 기준으로 보여줍니다.
  // 단, '도와준 기록'(origin === 'helped')은 남의 꿈을 이뤄준 것이라 항상 done 상태예요.
  // 이걸 내 달성률에 넣으면 남을 도울수록 내 달성률이 부풀려집니다. 내 꿈(직접 만든 것 + 함께하기)만 셉니다.
  const dreamItems = useMemo(() => items.filter((i) => i.origin !== 'helped'), [items]);
  const pct = dreamItems.length ? Math.round((dreamItems.filter((i) => i.done).length / dreamItems.length) * 100) : 0;
  const doneTotal = dreamItems.filter((i) => i.done).length;
  const todoTotal = dreamItems.length - doneTotal;
  const dreamTotal = dreamItems.length;

  // 카테고리별 개수 상위 3개를 요약 카드의 미니 그래프로 보여줍니다.
  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((i) => { (i.categories || []).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1)); });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const max = sorted.length ? sorted[0][1] : 1;
    return sorted.map(([cat, count], idx) => ({
      cat, count, pct: Math.round((count / max) * 100), opacity: [0.95, 0.7, 0.45][idx] ?? 0.4,
    }));
  }, [items]);

  // "오늘 할 일" 같은 의미 없는 구획 대신, 전체 리스트 중 몇 개를 무작위로 뽑아 보여줍니다.
  // 섞는 '순서'는 개수가 바뀔 때만 새로 정하고(자주 흔들리지 않도록), 실제로 '무엇을 보여줄지'는
  // 매번 지금 목록에서 다시 찾습니다 — 예전엔 개수만 보고 갱신해서, 완료·삭제된 꿈이 "아직 안 이룸"
  // 상태 그대로 추천 카드에 계속 남아 있었어요.
  const shuffledIds = useMemo(() => {
    const ids = items.filter((i) => !i.done).map((i) => i.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);
  const randomPicks = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const picks: Item[] = [];
    for (const id of shuffledIds) {
      const it = byId.get(id);
      if (it && !it.done) picks.push(it);
      if (picks.length >= RANDOM_PICK_COUNT) break;
    }
    return picks;
  }, [shuffledIds, items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilters.length && !(i.categories || []).some((c) => categoryFilters.includes(c))) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.note || '').toLowerCase().includes(q) ||
        (i.location?.name || '').toLowerCase().includes(q) ||
        (i.categories || []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [items, search, categoryFilters]);

  const isFiltering = !!search.trim() || categoryFilters.length > 0;

  // 정렬 우선순위 켜져 있으면 그걸 우선, 아니면 직접 정한 순서(order, 손대지 않았으면 0이라 원래
  // 불러온 순서 그대로 유지됩니다) 기준으로 보여줍니다.
  const sortSection = useCallback((list: Item[]) => {
    if (sortByPriority) {
      return [...list].sort((a, b) => (PRIORITY_RANK[a.priority || ''] ?? 3) - (PRIORITY_RANK[b.priority || ''] ?? 3));
    }
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [sortByPriority]);

  const todo = useMemo(() => sortSection(filteredItems.filter((i) => !i.done)), [filteredItems, sortSection]);
  const done = useMemo(() => sortSection(filteredItems.filter((i) => i.done)), [filteredItems, sortSection]);

  const toggleCategoryFilter = useCallback((c: string) => {
    setCategoryFilters((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }, []);

  const enterSelectMode = useCallback((item: Item) => {
    setSelectMode(true);
    setSortByPriority(false);
    setSelectedIds((prev) => new Set(prev).add(item.id));
  }, []);
  const toggleSelect = useCallback((item: Item) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    });
  }, []);
  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds(new Set()); }, []);
  const selectAllVisible = useCallback(() => {
    const all = [...todo, ...done];
    setSelectedIds((prev) => (prev.size === all.length ? new Set() : new Set(all.map((i) => i.id))));
  }, [todo, done]);

  const doDeleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const ok = await confirmDialog({ title: `${ids.length}개를 삭제할까요?`, message: '삭제하면 되돌릴 수 없어요.', confirmLabel: '삭제', destructive: true });
    if (!ok) return;
    try {
      await deleteItems(ids);
      exitSelectMode();
    } catch {
      // 예전엔 실패해도 아무 말 없이 선택 모드가 그대로 멈춰 있었어요.
      await alertDialog('삭제하지 못했어요', '잠시 뒤 다시 시도해주세요.');
    }
  }, [selectedIds, deleteItems, exitSelectMode]);

  // 선택한 것 중 '아직 이루지 않은 내 꿈'만 완료 대상입니다.
  // (이미 이룬 꿈이나 도와준 기록을 다시 완료 처리해 기록을 덮어쓰는 일이 없도록.)
  const completableSelectedIds = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    return [...selectedIds].filter((id) => {
      const it = byId.get(id);
      return !!it && !it.done && it.origin !== 'helped';
    });
  }, [selectedIds, items]);

  const doCompleteSelected = useCallback(async () => {
    const ids = completableSelectedIds;
    if (!ids.length) {
      await alertDialog('완료할 항목이 없어요', '이미 이룬 꿈은 완료 처리할 수 없어요.');
      return;
    }
    const ok = await confirmDialog({
      title: `${ids.length}개를 완료 처리할까요?`,
      message: '선택한 도전 중인 꿈을 이룬 것으로 표시해요. 사진·글은 나중에 각 꿈에서 추가할 수 있어요.',
      confirmLabel: '완료하기',
    });
    if (!ok) return;
    try {
      await completeItems(ids);
      exitSelectMode();
    } catch {
      await alertDialog('완료하지 못했어요', '잠시 뒤 다시 시도해주세요.');
    }
  }, [completableSelectedIds, completeItems, exitSelectMode]);

  const moveInSection = useCallback((list: Item[], item: Item, dir: -1 | 1) => {
    const idx = list.findIndex((i) => i.id === item.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const next = [...list];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    reorderItems(next.map((it, i) => ({ id: it.id, order: (i + 1) * 10 })));
  }, [reorderItems]);

  const onToggleDone = useCallback(async (item: Item) => {
    if (item.origin === 'helped') { onMemory(item); return; }
    if (!item.done) { onMemory(item); return; }
    // 이룬 꿈을 '다시 담기' 하면 사진과 글이 지워집니다. 기록이 남아 있으면 한 번 확인해요.
    // (체크 표시가 작아서 스크롤 중에 잘못 눌러 기록이 통째로 날아가는 일이 있었어요.)
    const hasRecord = !!(item.memory && (item.memory.text || (item.memory.photos?.length || item.memory.photo)));
    if (hasRecord) {
      const ok = await confirmDialog({
        title: '다시 담을까요?',
        message: '적어둔 기록(사진·글)은 지워지고 되돌릴 수 없어요.',
        confirmLabel: '다시 담기',
        destructive: true,
      });
      if (!ok) return;
    }
    reopenItem(item.id).catch(() => alertDialog('되돌리지 못했어요', '잠시 뒤 다시 시도해주세요.'));
  }, [onMemory, reopenItem]);

  const onStartProgress = useCallback((item: Item) => {
    startItem(item.id).catch(() => alertDialog('시작하지 못했어요', '잠시 뒤 다시 시도해주세요.'));
  }, [startItem]);

  const onStopProgress = useCallback(async (item: Item) => {
    const ok = await confirmDialog({
      title: '진행을 중단할까요?',
      message: `${item.emoji} ${item.title}\n정말로 중단하시겠어요?`,
      confirmLabel: '중단하기',
      destructive: true,
    });
    if (!ok) return;
    stopItem(item.id).catch(() => alertDialog('중단하지 못했어요', '잠시 뒤 다시 시도해주세요.'));
  }, [stopItem]);

  const onCardPress = useCallback((item: Item) => {
    if (compact) onDetail(item);
    else onEdit(item);
  }, [compact, onDetail, onEdit]);

  if (!user) return null;

  const showScrollBtns = scrollable && !selectMode;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={loadingMine} onRefresh={onRefresh} tintColor={colors.accent} />}
        onScroll={onScroll}
        scrollEventThrottle={100}
        onLayout={(e) => updateScrollState(scrollDims.current.contentHeight, e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => updateScrollState(h, scrollDims.current.viewportHeight)}
      >
        <View style={styles.profile}>
          <View style={styles.pTop}>
            <Avatar name={user.name} photoUrl={user.photoUrl} size={74} />
            <View style={styles.stats}>
              <Stat label="꿈" value={dreamTotal} />
              <Stat label="이룬 꿈" value={doneTotal} onPress={scrollToDone} />
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
              onPress={onToggleVisibility}
              disabled={togglingVisibility}
              loading={togglingVisibility}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {items.length > 0 && (
          <GradientCard role="primary" style={styles.summaryWrap} contentStyle={styles.summaryInner}>
            <View style={styles.summaryTop}>
              <ProgressRing size={80} pct={pct} label="달성" />
              <View style={styles.summaryStats}>
                <SummaryStat label="이룬 꿈" value={doneTotal} onPress={scrollToDone} />
                <SummaryStat label="도전 중" value={todoTotal} />
                <SummaryStat label="전체" value={dreamTotal} />
              </View>
            </View>
            {topCategories.length > 0 && (
              <View style={styles.macroWrap}>
                {topCategories.map((c) => (
                  <View key={c.cat} style={styles.macroRow}>
                    <Text style={styles.macroLabel} numberOfLines={1}>· {c.cat}</Text>
                    <View style={styles.macroTrack}>
                      <View style={[styles.macroFill, { width: `${Math.max(8, c.pct)}%`, opacity: c.opacity }]} />
                    </View>
                    <Text style={styles.macroCount}>{c.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </GradientCard>
        )}

        {items.length === 0 ? (
          <>
            <EmptyState icon="flag-outline" title="아직 꿈이 없어요" subtitle="뭘 적을지 막막하다면 아래에서 골라 담아보세요" />
            <BubbleButton title="✦ 시작 템플릿에서 골라 담기" onPress={onStarter} full style={{ marginTop: 2 }} />
            <Text style={styles.emptyHint}>직접 쓰고 싶다면 아래 + 버튼을 눌러주세요. 엑셀로 한 번에 담고 싶다면 + 화면 안에도 작은 버튼이 있어요.</Text>
          </>
        ) : (
          <>
            <View style={styles.searchBox}>
              <Icon name="search-outline" size={16} color={colors.ink3} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="제목 · 메모 · 장소로 검색"
                placeholderTextColor={colors.ink3}
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="검색어 지우기">
                  <Icon name="close-circle" size={16} color={colors.ink3} />
                </Pressable>
              ) : null}
            </View>

            {presentCategories.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <FilterChip label="전체" active={!categoryFilters.length} onPress={() => setCategoryFilters([])} />
                {presentCategories.map((c) => (
                  <FilterChip key={c} label={c} active={categoryFilters.includes(c)} onPress={() => toggleCategoryFilter(c)} />
                ))}
              </ScrollView>
            )}

            {!isFiltering && randomPicks.length > 0 && (
              <View style={styles.pickSection}>
                <SectionHeader title="오늘은 이런 건 어때요" count={randomPicks.length} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
                  {randomPicks.map((item, idx) => (
                    <PressScaleCard key={item.id} item={item} idx={idx} onPress={() => onMemory(item)} />
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.listBar}>
              <Pressable
                onPress={() => setSortByPriority((v) => !v)}
                style={[styles.viewToggle, sortByPriority && styles.viewToggleOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: sortByPriority }}
                accessibilityLabel="우선순위순 정렬"
              >
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: sortByPriority ? '#fff' : colors.ink2 }}>
                  {sortByPriority ? '✓ 우선순위순' : '우선순위순 정렬'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setCompact(!compact)} style={styles.viewToggle} accessibilityRole="button" accessibilityLabel={compact ? '상세 보기로 전환' : '간단히 보기로 전환'}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.ink2 }}>{compact ? '상세 보기' : '간단히 보기'}</Text>
              </Pressable>
            </View>

            <Text style={styles.hintText}>
              {selectMode ? '카드를 눌러 선택하세요' : '카드를 길게 누르면 여러 개 선택 · 순서 변경을 할 수 있어요'}
            </Text>

            {isFiltering && filteredItems.length === 0 ? (
              <EmptyState icon="search-outline" title="검색 결과가 없어요" subtitle="다른 검색어나 카테고리를 눌러보세요" />
            ) : (
              <>
                {todo.length > 0 && (
                  <>
                    <SectionHeader title="도전 중" count={todo.length} />
                    {todo.map((i, idx) => (
                      <ItemCard
                        key={i.id}
                        item={i}
                        ctx="mine"
                        compact={compact}
                        onToggleDone={onToggleDone}
                        onMemory={onMemory}
                        onShare={onShare}
                        onMenu={onMenu}
                        onCardPress={onCardPress}
                        onStartProgress={onStartProgress}
                        onStopProgress={onStopProgress}
                        selectable={selectMode}
                        selected={selectedIds.has(i.id)}
                        onToggleSelect={toggleSelect}
                        onLongPress={enterSelectMode}
                        canMoveUp={!isFiltering && idx > 0}
                        canMoveDown={!isFiltering && idx < todo.length - 1}
                        onMoveUp={!isFiltering ? (it) => moveInSection(todo, it, -1) : undefined}
                        onMoveDown={!isFiltering ? (it) => moveInSection(todo, it, 1) : undefined}
                      />
                    ))}
                  </>
                )}
                {done.length > 0 && (
                  <>
                    <View onLayout={(e) => { doneSectionY.current = e.nativeEvent.layout.y; }}>
                      <SectionHeader title="이룬 꿈" count={done.length} />
                    </View>
                    {done.map((i, idx) => (
                      <ItemCard
                        key={i.id}
                        item={i}
                        ctx="mine"
                        compact={compact}
                        onToggleDone={onToggleDone}
                        onMemory={onMemory}
                        onShare={onShare}
                        onMenu={onMenu}
                        onCardPress={onCardPress}
                        onStartProgress={onStartProgress}
                        onStopProgress={onStopProgress}
                        selectable={selectMode}
                        selected={selectedIds.has(i.id)}
                        onToggleSelect={toggleSelect}
                        onLongPress={enterSelectMode}
                        canMoveUp={!isFiltering && idx > 0}
                        canMoveDown={!isFiltering && idx < done.length - 1}
                        onMoveUp={!isFiltering ? (it) => moveInSection(done, it, -1) : undefined}
                        onMoveDown={!isFiltering ? (it) => moveInSection(done, it, 1) : undefined}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {selectMode ? (
        <View style={styles.selectBar}>
          <Pressable onPress={exitSelectMode} hitSlop={8} style={styles.selectBarClose} accessibilityRole="button" accessibilityLabel="선택 모드 닫기">
            <Icon name="close" size={16} color={colors.ink2} />
          </Pressable>
          <Text style={styles.selectBarCount}>{selectedIds.size}개 선택</Text>
          <Pressable onPress={selectAllVisible} style={styles.selectBarAll} accessibilityRole="button" accessibilityLabel="전체 선택 또는 해제">
            <Text style={styles.selectBarAllText} numberOfLines={1}>전체</Text>
          </Pressable>
          <BubbleButton small variant="primary" title="✓ 완료" onPress={doCompleteSelected} disabled={!completableSelectedIds.length} />
          <BubbleButton small variant="line" title="🗑 삭제" onPress={doDeleteSelected} disabled={!selectedIds.size} />
        </View>
      ) : null}

      {showScrollBtns ? (
        <View style={styles.scrollFabCol} pointerEvents="box-none">
          {!atTop ? (
            <Pressable onPress={scrollToTop} style={styles.scrollFab} hitSlop={6} accessibilityRole="button" accessibilityLabel="위로 스크롤">
              <Icon name="chevron-up" size={18} color={colors.ink2} />
            </Pressable>
          ) : null}
          {!atBottom ? (
            <Pressable onPress={scrollToBottom} style={styles.scrollFab} hitSlop={6} accessibilityRole="button" accessibilityLabel="아래로 스크롤">
              <Icon name="chevron-down" size={18} color={colors.ink2} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// 오늘의 추천 카드 — 누르고 있으면 커지고, 떼면 원래 크기로 돌아옵니다.
// (이 앱은 터치가 메인이라 '마우스오버'를 손으로 누르고 있는 동작으로 바꿨어요)
function PressScaleCard({ item, idx, onPress }: { item: Item; idx: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <GradientCard
          role={idx % 2 === 0 ? 'secondary' : 'accent'}
          borderRadius={radius.lg}
          style={styles.pickCard}
          contentStyle={styles.pickCardInner}
        >
          <Text style={styles.pickEmoji}>{item.emoji}</Text>
          <Text style={styles.pickTitle} numberOfLines={2}>{item.title}</Text>
          {item.categories?.length ? <Text style={styles.pickCatLabel}>🏷 {item.categories.join(' · ')}</Text> : null}
        </GradientCard>
      </Animated.View>
    </Pressable>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const cc = catColor(label === '전체' ? null : label);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? colors.accent : cc.bg }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} 필터`}
    >
      <Text style={{ color: active ? '#fff' : cc.ink, fontSize: 12.5, fontWeight: '600' }}>{active && label !== '전체' ? '✓ ' : ''}{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const body = (
    <>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.stat}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={styles.stat} hitSlop={6}>
      {body}
    </Pressable>
  );
}

function SummaryStat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const body = (
    <>
      <Text style={styles.summaryStatVal}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.summaryStat}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={styles.summaryStat} hitSlop={6}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { backgroundColor: colors.surface, borderRadius: 26, padding: 20, marginTop: 8, ...shadow.sm },
  sticker: { position: 'absolute', top: -15, right: 24, fontSize: 30, color: colors.candyYellow, transform: [{ rotate: '14deg' }] },
  pTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11.5, color: colors.ink2 },
  pName: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 15 },
  pBio: { fontSize: 13.5, color: colors.ink2, marginTop: 4, lineHeight: 19 },
  pActions: { flexDirection: 'row', gap: 8, marginTop: 15 },

  summaryWrap: { marginTop: 16 },
  summaryInner: { padding: 22 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  summaryStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { alignItems: 'center', gap: 2 },
  summaryStatVal: { fontSize: 19, fontWeight: '800', color: '#fff' },
  summaryStatLabel: { fontSize: 11, color: 'rgba(255,255,255,.85)', marginTop: 1 },
  macroWrap: { marginTop: 20, gap: 9 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroLabel: { width: 44, fontSize: 11.5, color: 'rgba(255,255,255,.9)', fontWeight: '600' },
  macroTrack: { flex: 1, height: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,.22)', overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 99, backgroundColor: '#fff' },
  macroCount: { fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: '600', width: 16, textAlign: 'right' },

  pickSection: { marginTop: 4 },
  pickRow: { flexDirection: 'row', gap: 14, paddingBottom: 4, paddingRight: 4, paddingTop: 4 },
  pickCard: { width: 156, height: 156 },
  pickCardInner: { flex: 1, padding: 16, justifyContent: 'flex-end' },
  pickEmoji: { fontSize: 30, marginBottom: 7 },
  pickTitle: { fontSize: 14.5, fontWeight: '700', color: '#fff', lineHeight: 19 },
  pickCatLabel: { fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: '600', marginTop: 5 },

  emptyHint: { fontSize: 12, color: colors.ink2, textAlign: 'center', marginTop: 12, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2,
    borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 11, marginTop: 18,
  },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  searchClear: { fontSize: 13, color: colors.ink3, paddingHorizontal: 2 },
  chipRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  chip: { borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13 },
  listBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: -4 },
  viewToggle: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  viewToggleOn: { backgroundColor: colors.accent },
  hintText: { fontSize: 11.5, color: colors.ink3, marginTop: 14, marginBottom: -2 },

  selectBar: {
    position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: 10, paddingHorizontal: 12, ...shadow.lg,
  },
  selectBarClose: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  selectBarCloseText: { fontSize: 13, color: colors.ink2, fontWeight: '700' },
  selectBarCount: { fontSize: 13, fontWeight: '700', color: colors.ink },
  selectBarAll: { flex: 1 },
  selectBarAllText: { fontSize: 12, color: colors.accentInk, fontWeight: '600', textAlign: 'center' },

  scrollFabCol: { position: 'absolute', right: 6, bottom: 22, gap: 10 },
  scrollFab: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, opacity: 1,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', ...shadow.lg,
  },
  scrollFabText: { color: '#fff', fontSize: 19, fontWeight: '800' },
});
