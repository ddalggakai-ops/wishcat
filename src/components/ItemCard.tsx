import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { catColor, catRole, colors, radius, shadow } from '../theme';
import type { Item } from '../api/types';
import Avatar from './Avatar';
import Icon from './Icon';
import { CategoryChips, LocationChip, PriorityBadge, Tag } from './Chips';
import BubbleButton from './Button';
import MemoryPhotoCarousel from './MemoryPhotos';
import { resolveImageUrl } from '../api/client';

export type ItemCtx = 'mine' | 'friend' | 'explore';

/** 목표일까지 며칠 남았는지 — 'D-12' / 'D-DAY' / '3일 지남' */
export function dDayLabel(targetDate: string | null | undefined, today = new Date()): string | null {
  if (!targetDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate);
  if (!m) return null;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((target - now) / 86400000);
  if (days === 0) return 'D-DAY';
  if (days > 0) return `D-${days}`;
  return `${-days}일 지남`;
}

/** 진행을 시작한 날로부터 며칠째인지 — 시작한 날이 D+0, 다음날부터 D+1, D+2 ... */
export function elapsedDaysLabel(startedAt: string | null | undefined, today = new Date()): number | null {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  if (isNaN(start.getTime())) return null;
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((now - startUTC) / 86400000));
}

function ItemCard({
  item, ctx, compact, viewerId, onToggleDone, onMemory, onShare, onJoin, onLeave, onHelp, onMenu, onReport,
  onCardPress, selectable, selected, onToggleSelect, onLongPress, canMoveUp, canMoveDown, onMoveUp, onMoveDown,
  onStartProgress, onStopProgress, dragHandle,
}: {
  item: Item;
  ctx: ItemCtx;
  compact?: boolean;
  /** 보고 있는 사람의 uid — '함께하는 중'인지 판단하는 데 씁니다 */
  viewerId?: string;
  onToggleDone?: (item: Item) => void;
  onMemory?: (item: Item) => void;
  onShare?: (item: Item) => void;
  onJoin?: (item: Item) => void;
  onLeave?: (item: Item) => void;
  onHelp?: (item: Item) => void;
  onMenu?: (item: Item) => void;
  onReport?: (item: Item) => void;
  /** 진행 시작 — '진행중' 상태로 바뀌고 D+n일이 표시됩니다 */
  onStartProgress?: (item: Item) => void;
  /** 진행 중단 — 누르면 호출부에서 확인 팝업을 띄운 뒤 호출해요 */
  onStopProgress?: (item: Item) => void;
  /** 카드(빈 곳)를 눌렀을 때 — 자세히 보기에서는 수정으로, 간단히 보기에서는 상세보기로 씁니다 */
  onCardPress?: (item: Item) => void;
  /** 다중선택(삭제/순서변경) 모드 — 길게 눌러 진입 */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: (item: Item) => void;
  onMoveDown?: (item: Item) => void;
  /** 드래그 순서 변경 핸들 — 있으면 위/아래 버튼 대신 이걸 씁니다 */
  dragHandle?: React.ReactNode;
}) {
  // 예전에는 '함께하기' 버튼이 좋아요(likedByMe) 상태를 보고 색만 바뀌었습니다.
  // 이미 함께하고 있어도 버튼이 그대로 남아 있어서 몇 번이고 다시 누르게 됐어요.
  const joined = !!viewerId && item.participants.some((p) => p.id === viewerId);
  const dday = !item.done ? dDayLabel(item.targetDate) : null;
  const inProgress = !item.done && !!item.startedAt;
  const progressDays = inProgress ? elapsedDaysLabel(item.startedAt) : null;
  const tags: React.ReactNode[] = [];
  if (ctx === 'mine') {
    if (item.origin === 'helped' && item.helpedFor) tags.push(<Tag key="h" tone="helped" label={`🎁 ${item.helpedFor.name}님을 도움`} />);
    else if (item.origin === 'joined' && item.source) tags.push(<Tag key="j" tone="joined" label={`👥 ${item.source.ownerName}님과 함께`} />);
    else if (item.participants.length) tags.push(<Tag key="s" tone="shared" label="공유 중" />);
  }
  if (ctx === 'explore' && item.hot) tags.push(<Tag key="hot" tone="hot" label="인기" />);

  const catBg = catColor(item.categories?.[0]).bg;
  const selectBox = ctx === 'mine' && selectable ? (
    <Pressable
      onPress={() => onToggleSelect?.(item)}
      style={[styles.selectBox, selected && styles.selectBoxOn]}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={item.title}
    >
      {selected ? <Icon name="checkmark" size={14} color="#fff" /> : null}
    </Pressable>
  ) : null;
  const lead = selectBox || (ctx === 'mine' ? (
    <Pressable
      onPress={() => onToggleDone?.(item)}
      style={[styles.check, item.done && styles.checkDone]}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ checked: item.done }}
      accessibilityLabel={item.done ? `${item.title} 다시 담기` : `${item.title} 완료하기`}
    >
      {item.done ? <Icon name="checkmark" size={14} color="#fff" /> : null}
    </Pressable>
  ) : (
    <View style={[styles.catIcon, { backgroundColor: catBg }]}><Text style={{ fontSize: 19 }}>{item.emoji}</Text></View>
  ));

  const reorderCol = ctx === 'mine' && selectable ? (
    dragHandle ? (
      <View style={styles.reorderCol}>{dragHandle}</View>
    ) : (
      <View style={styles.reorderCol}>
        <Pressable onPress={() => onMoveUp?.(item)} disabled={!canMoveUp} hitSlop={4} style={[styles.reorderBtn, !canMoveUp && styles.reorderBtnOff]} accessibilityRole="button" accessibilityLabel="위로 이동">
          <Icon name="chevron-up" size={14} color={canMoveUp ? colors.ink2 : colors.ink3} />
        </Pressable>
        <Pressable onPress={() => onMoveDown?.(item)} disabled={!canMoveDown} hitSlop={4} style={[styles.reorderBtn, !canMoveDown && styles.reorderBtnOff]} accessibilityRole="button" accessibilityLabel="아래로 이동">
          <Icon name="chevron-down" size={14} color={canMoveDown ? colors.ink2 : colors.ink3} />
        </Pressable>
      </View>
    )
  ) : null;

  const handlePress = () => {
    if (selectable) { onToggleSelect?.(item); return; }
    onCardPress?.(item);
  };
  const handleLongPress = ctx === 'mine' ? () => onLongPress?.(item) : undefined;

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={380}
        style={[styles.card, styles.compactCard, selected && styles.cardSelected]}
      >
        <View style={styles.row}>
          {lead}
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              {ctx === 'mine' ? <Text style={{ fontSize: 16 }}>{item.emoji} </Text> : null}
              <Text style={[styles.title, item.done && styles.titleDone]} numberOfLines={2}>{item.title}</Text>
            </View>
            {tags.length ? <View style={styles.tagRow}>{tags}</View> : null}
          </View>
          {reorderCol}
        </View>
      </Pressable>
    );
  }

  const memoryPhotos = (item.memory?.photos?.length ? item.memory.photos : (item.memory?.photo ? [item.memory.photo] : []))
    .map(resolveImageUrl)
    .filter((u): u is string => !!u);
  const showMemory = item.done && item.memory && (item.memory.text || memoryPhotos.length > 0);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={380}
      style={[styles.card, selected && styles.cardSelected]}
    >
      {ctx === 'mine' && onMenu && !selectable ? (
        <Pressable style={styles.more} onPress={() => onMenu(item)}>
          <Icon name="ellipsis-horizontal" size={18} color={colors.ink3} />
        </Pressable>
      ) : null}
      <View style={styles.row}>
        {lead}
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            {ctx === 'mine' ? <Text style={{ fontSize: 16 }}>{item.emoji} </Text> : null}
            <Text style={[styles.title, item.done && styles.titleDone]}>{item.title}</Text>
          </View>
          {tags.length ? <View style={styles.tagRow}>{tags}</View> : null}
          {item.note ? <Text style={styles.note}>{item.note}</Text> : null}

          {(item.categories?.length || item.location || dday || item.priority) ? (
            <View style={styles.metaRow}>
              <CategoryChips categories={item.categories} />
              {item.location ? <LocationChip location={item.location} /> : null}
              <PriorityBadge priority={item.priority} />
              {dday ? (
                <View style={[styles.dday, dday.endsWith('지남') && styles.ddayPast]}>
                  <Text style={[styles.ddayText, dday.endsWith('지남') && styles.ddayTextPast]}>🗓 {dday}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {item.origin === 'helped' && item.source ? (
            <View style={styles.srcLine}>
              <Text style={styles.srcK}>지워준 꿈</Text>
              <Text style={styles.srcT}>{item.source.emoji} {item.source.title} · {item.helpedFor?.name}님</Text>
            </View>
          ) : null}

          {item.participants.length ? (
            <View style={styles.who}>
              <View style={{ flexDirection: 'row' }}>
                {item.participants.slice(0, 4).map((p, idx) => (
                  <Avatar key={p.id} name={p.name} photoUrl={p.photoUrl} size={22} style={{ marginLeft: idx === 0 ? 0 : -7, borderWidth: 2, borderColor: '#fff' }} />
                ))}
              </View>
              <Text style={styles.whoLabel}>{item.participants.map((p) => p.name).slice(0, 3).join(', ')}{item.participants.length > 3 ? ` 외 ${item.participants.length - 3}명` : ''} 함께</Text>
            </View>
          ) : null}

          {showMemory ? (
            <View style={styles.memWrap}>
              <View style={styles.memHead}>
                <Text style={styles.memBadge}>✓ 이룬 꿈</Text>
                {item.memory?.date ? <Text style={styles.memHeadDate}>📷 {item.memory.date}</Text> : null}
              </View>
              <MemoryPhotoCarousel photos={memoryPhotos} height={190} emoji={item.emoji} role={catRole(item.categories?.[0])} />
              {item.memory?.text ? (
                <View style={styles.memCap}>
                  <Text style={styles.memText}>{item.memory.text}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {!selectable && (
            <View style={styles.actions}>
              {ctx === 'mine' && item.done && (
                <>
                  <BubbleButton small variant="ghost" title={item.memory?.text || item.memory?.photo ? '추억 수정' : '추억 남기기'} onPress={() => onMemory?.(item)} />
                  <BubbleButton small variant="line" title="공유" onPress={() => onShare?.(item)} />
                </>
              )}
              {ctx === 'mine' && !item.done && (
                <>
                  {inProgress ? (
                    <Pressable onPress={() => onStopProgress?.(item)} style={styles.progressPill} hitSlop={4} accessibilityRole="button" accessibilityLabel="진행 중단">
                      <Text style={styles.progressPillText}>🏃 진행중 D+{progressDays}일째</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => onStartProgress?.(item)} style={styles.startPill} hitSlop={4} accessibilityRole="button" accessibilityLabel="진행 시작">
                      <Text style={styles.startPillText}>▶ 진행 시작</Text>
                    </Pressable>
                  )}
                  <BubbleButton small variant="line" title="완료하기" onPress={() => onMemory?.(item)} />
                </>
              )}
              {ctx !== 'mine' && item.done && (
                <View style={styles.mutedPill}><Text style={styles.mutedPillText}>{(item.helpedBy || []).length ? '✓ 이미 이룬 꿈' : '✓ 이미 이룬 꿈'}</Text></View>
              )}
              {ctx !== 'mine' && !item.done && (
                <>
                  {joined ? (
                    <>
                      <View style={styles.joinedPill}><Text style={styles.joinedPillText}>✓ 함께하는 중</Text></View>
                      <BubbleButton small variant="ghost" title="함께하기 취소" onPress={() => onLeave?.(item)} />
                    </>
                  ) : (
                    <BubbleButton small variant="primary" title="함께하기" onPress={() => onJoin?.(item)} />
                  )}
                  {ctx === 'friend' && <BubbleButton small variant="gift" title="도와줬어요" onPress={() => onHelp?.(item)} />}
                </>
              )}
              {ctx !== 'mine' && onReport ? (
                <Pressable onPress={() => onReport(item)} hitSlop={8} style={styles.reportBtn} accessibilityRole="button" accessibilityLabel="신고하기">
                  <Text style={styles.reportText}>신고</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
        {reorderCol}
      </View>
    </Pressable>
  );
}

// 목록이 길 때(120개↑) 카드 하나가 바뀔 때마다 전부 다시 그리지 않도록 메모합니다.
// 넘겨받는 콜백들이 호출부에서 useCallback으로 안정적으로 유지될 때 효과가 큽니다.
export default React.memo(ItemCard);

const styles = StyleSheet.create({
  // 인스타그램식 미니멀: 테두리·라운드 없이 아래쪽 얇은 실선(구분선) + 은은한 음영만.
  card: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 0, ...shadow.xs },
  cardSelected: { backgroundColor: colors.accentWash },
  compactCard: { paddingVertical: 13, paddingHorizontal: 16 },
  more: { position: 'absolute', top: 9, right: 9, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkDone: { backgroundColor: colors.done, borderColor: colors.done },
  selectBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: colors.surface },
  selectBoxOn: { backgroundColor: colors.accent },
  catIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  title: { fontSize: 15.5, fontWeight: '600', color: colors.ink, letterSpacing: -0.2, flexShrink: 1 },
  titleDone: { color: colors.ink3, textDecorationLine: 'line-through' },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  note: { fontSize: 13, color: colors.ink2, marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 7, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' },
  srcLine: { flexDirection: 'row', gap: 8, marginTop: 9, padding: 10, backgroundColor: colors.surface2, borderRadius: 10 },
  srcK: { fontSize: 12, color: colors.ink3 },
  srcT: { fontSize: 12.5, color: colors.ink2, flexShrink: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  whoLabel: { fontSize: 12, color: colors.ink2 },
  memWrap: { marginTop: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden', ...shadow.sm },
  memHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 11, paddingBottom: 9 },
  memBadge: { fontSize: 12.5, fontWeight: '700', color: colors.done },
  memHeadDate: { fontSize: 11, color: colors.ink3 },
  memCap: { padding: 12 },
  memText: { fontSize: 13.5, color: colors.ink, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 12, flexWrap: 'wrap' },
  mutedPill: { backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 13 },
  mutedPillText: { fontSize: 13, color: colors.ink3, fontWeight: '600' },
  joinedPill: { backgroundColor: colors.accentWash, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 13 },
  joinedPillText: { fontSize: 13, color: colors.accentInk, fontWeight: '700' },
  dday: { backgroundColor: colors.doneWash, borderRadius: 9, paddingVertical: 4, paddingHorizontal: 9 },
  ddayPast: { backgroundColor: 'rgba(220,110,110,.14)' },
  ddayText: { fontSize: 11.5, fontWeight: '700', color: colors.done },
  ddayTextPast: { color: '#c05656' },
  progressPill: { backgroundColor: colors.accentWash, borderRadius: 9, paddingVertical: 4, paddingHorizontal: 9 },
  progressPillText: { fontSize: 11.5, fontWeight: '700', color: colors.accentInk },
  startPill: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2, borderRadius: 9, paddingVertical: 4, paddingHorizontal: 9 },
  startPillText: { fontSize: 11.5, fontWeight: '700', color: colors.ink2 },
  reportBtn: { paddingVertical: 8, paddingHorizontal: 8, marginLeft: 'auto' },
  reportText: { fontSize: 11.5, color: colors.ink3 },
  reorderCol: { gap: 4, marginLeft: 4 },
  reorderBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line2 },
  reorderBtnOff: { opacity: 0.35 },
  reorderText: { fontSize: 11, color: colors.ink2, fontWeight: '700' },
  reorderTextOff: { color: colors.ink3 },
});
