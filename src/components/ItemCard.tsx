import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { catColor, colors, radius, shadow } from '../theme';
import type { Item } from '../api/types';
import Avatar from './Avatar';
import { CategoryChip, LocationChip, Tag } from './Chips';
import BubbleButton from './Button';
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

export default function ItemCard({
  item, ctx, compact, viewerId, onToggleDone, onMemory, onShare, onJoin, onLeave, onHelp, onMenu, onReport,
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
}) {
  // 예전에는 '함께하기' 버튼이 좋아요(likedByMe) 상태를 보고 색만 바뀌었습니다.
  // 이미 함께하고 있어도 버튼이 그대로 남아 있어서 몇 번이고 다시 누르게 됐어요.
  const joined = !!viewerId && item.participants.some((p) => p.id === viewerId);
  const dday = !item.done ? dDayLabel(item.targetDate) : null;
  const tags: React.ReactNode[] = [];
  if (ctx === 'mine') {
    if (item.origin === 'helped' && item.helpedFor) tags.push(<Tag key="h" tone="helped" label={`🎁 ${item.helpedFor.name}님을 도움`} />);
    else if (item.origin === 'joined' && item.source) tags.push(<Tag key="j" tone="joined" label={`👥 ${item.source.ownerName}님과 함께`} />);
    else if (item.participants.length) tags.push(<Tag key="s" tone="shared" label="공유 중" />);
  }
  if (ctx === 'explore' && item.hot) tags.push(<Tag key="hot" tone="hot" label="인기" />);

  const catBg = catColor(item.category).bg;
  const lead = ctx === 'mine' ? (
    <Pressable onPress={() => onToggleDone?.(item)} style={[styles.check, item.done && styles.checkDone]}>
      {item.done ? <Text style={styles.checkMark}>✓</Text> : null}
    </Pressable>
  ) : (
    <View style={[styles.catIcon, { backgroundColor: catBg }]}><Text style={{ fontSize: 19 }}>{item.emoji}</Text></View>
  );

  if (compact) {
    return (
      <View style={[styles.card, styles.compactCard]}>
        <View style={styles.row}>
          {lead}
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              {ctx === 'mine' ? <Text style={{ fontSize: 16 }}>{item.emoji} </Text> : null}
              <Text style={[styles.title, item.done && styles.titleDone]} numberOfLines={2}>{item.title}</Text>
            </View>
            {tags.length ? <View style={styles.tagRow}>{tags}</View> : null}
          </View>
        </View>
      </View>
    );
  }

  const photoUri = resolveImageUrl(item.memory?.photo);
  const showMemory = item.done && item.memory && (item.memory.text || photoUri);

  return (
    <View style={styles.card}>
      {ctx === 'mine' && onMenu ? (
        <Pressable style={styles.more} onPress={() => onMenu(item)}>
          <Text style={{ fontSize: 16, color: colors.ink3 }}>⋯</Text>
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

          {(item.category || item.location || dday) ? (
            <View style={styles.metaRow}>
              {item.category ? <CategoryChip category={item.category} /> : null}
              {item.location ? <LocationChip location={item.location} /> : null}
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
              <View style={styles.tape} />
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.memImg} /> : null}
              <View style={styles.memCap}>
                {item.memory?.text ? <Text style={styles.memText}>{item.memory.text}</Text> : null}
                <Text style={styles.memDate}>📷 {item.memory?.date}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {ctx === 'mine' && item.done && (
              <>
                <BubbleButton small variant="ghost" title={item.memory?.text || item.memory?.photo ? '추억 수정' : '추억 남기기'} onPress={() => onMemory?.(item)} />
                <BubbleButton small variant="line" title="공유" onPress={() => onShare?.(item)} />
              </>
            )}
            {ctx === 'mine' && !item.done && (
              <BubbleButton small variant="line" title="완료하기" onPress={() => onMemory?.(item)} />
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 15, marginBottom: 10, ...shadow.sm },
  compactCard: { paddingVertical: 12, paddingHorizontal: 14 },
  more: { position: 'absolute', top: 9, right: 9, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkDone: { backgroundColor: colors.done, borderColor: colors.done, borderStyle: 'solid' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
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
  memWrap: { marginTop: 20, marginHorizontal: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface, transform: [{ rotate: '-1.3deg' }], ...shadow.sm },
  tape: { position: 'absolute', top: -11, alignSelf: 'center', width: 64, height: 20, backgroundColor: 'rgba(255,202,74,.75)', borderRadius: 2, transform: [{ rotate: '-4deg' }] },
  memImg: { width: '100%', height: 180, borderRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  memCap: { padding: 11 },
  memText: { fontSize: 13.5, color: colors.ink, lineHeight: 19 },
  memDate: { fontSize: 11.5, color: colors.ink3, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 12, flexWrap: 'wrap' },
  mutedPill: { backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 13 },
  mutedPillText: { fontSize: 13, color: colors.ink3, fontWeight: '600' },
  joinedPill: { backgroundColor: 'rgba(74,144,217,.12)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 13 },
  joinedPillText: { fontSize: 13, color: colors.accent, fontWeight: '700' },
  dday: { backgroundColor: 'rgba(74,144,217,.12)', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 9 },
  ddayPast: { backgroundColor: 'rgba(220,110,110,.14)' },
  ddayText: { fontSize: 11.5, fontWeight: '700', color: colors.accent },
  ddayTextPast: { color: '#c05656' },
  reportBtn: { paddingVertical: 8, paddingHorizontal: 8, marginLeft: 'auto' },
  reportText: { fontSize: 11.5, color: colors.ink3 },
});
