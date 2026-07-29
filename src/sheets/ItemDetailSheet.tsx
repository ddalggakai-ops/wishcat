import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Sheet from '../components/Sheet';
import BubbleButton from '../components/Button';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { CategoryChips, LocationChip, PriorityBadge } from '../components/Chips';
import { dDayLabel } from '../components/ItemCard';
import MemoryPhotoCarousel from '../components/MemoryPhotos';
import { colors, catRole, gradients, radius } from '../theme';
import { alertDialog } from '../utils/dialog';
import { resolveImageUrl } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

/**
 * 둘러보기에서 타일을 누르면 열리는 상세 화면.
 * 예전에는 타일을 누르면 곧장 '그 사람 페이지'로 넘어가서,
 * 마음에 든 꿈 하나를 내 목록에 담을 방법이 없었습니다.
 */
export default function ItemDetailSheet({
  visible, onClose, item, onOpenPerson, onReport, onToast,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onOpenPerson: (id: string, name: string) => void;
  onReport: (item: Item) => void;
  onToast: (msg: string) => void;
}) {
  const { joinItem, leaveItem, toggleLike, getItem } = useApp();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  // 담기/취소 후 최신 상태가 캐시에 들어오므로 캐시 값을 우선 씁니다.
  const live = item ? getItem(item.id) || item : null;
  if (!live) return null;

  const isMine = !!user && live.owner.id === user.id;
  const joined = !!user && live.participants.some((p) => p.id === user.id);
  const dday = !live.done ? dDayLabel(live.targetDate) : null;
  const memoryPhotos = (live.memory?.photos?.length ? live.memory.photos : (live.memory?.photo ? [live.memory.photo] : []))
    .map(resolveImageUrl)
    .filter((u): u is string => !!u);

  const doJoin = async () => {
    setBusy(true);
    try {
      await joinItem(live.id);
      onToast('내 목록에 담았어요 ✦');
    } catch {
      await alertDialog('담지 못했어요', '잠시 뒤 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const doLeave = async () => {
    setBusy(true);
    try {
      await leaveItem(live.id);
      onToast('함께하기를 취소했어요');
    } catch {
      await alertDialog('취소하지 못했어요', '잠시 뒤 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`${live.emoji} ${live.title}`}>
      {/* 이룬 꿈은 여기서 사진 1장짜리 hero를 따로 보여주지 않아요 — 실제 사진(여러 장이면 캐러셀)은
          아래 memWrap에서 한 번만 보여줍니다. 예전엔 첫 번째 사진이 위/아래 두 번 중복으로 보였어요. */}
      <LinearGradient colors={gradients[catRole(live.categories?.[0])]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroEmoji}>{live.emoji}</Text>
      </LinearGradient>

      <Pressable style={styles.ownerRow} onPress={() => { onClose(); onOpenPerson(live.owner.id, live.owner.name); }}>
        <Avatar name={live.owner.name} photoUrl={live.owner.photoUrl} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.ownerName}>{live.owner.name}님의 꿈</Text>
          <Text style={styles.ownerSub}>프로필 보기 ›</Text>
        </View>
      </Pressable>

      {live.note ? <Text style={styles.note}>{live.note}</Text> : null}

      {(live.categories?.length || live.location || dday || live.priority) ? (
        <View style={styles.metaRow}>
          <CategoryChips categories={live.categories} />
          {live.location ? <LocationChip location={live.location} /> : null}
          <PriorityBadge priority={live.priority} />
          {dday ? <View style={styles.dday}><Text style={styles.ddayText}>🗓 {dday}</Text></View> : null}
        </View>
      ) : null}

      {live.done ? (
        <View style={styles.memWrap}>
          {memoryPhotos.length ? (
            <MemoryPhotoCarousel photos={memoryPhotos} height={190} emoji={live.emoji} role={catRole(live.categories?.[0])} />
          ) : null}
          <View style={styles.memCap}>
            <Text style={styles.memBadge}>✓ 이미 이룬 꿈</Text>
            {live.memory?.text ? <Text style={styles.memText}>{live.memory.text}</Text> : null}
            {live.memory?.date ? <Text style={styles.memDate}>📷 {live.memory.date}</Text> : null}
          </View>
        </View>
      ) : null}

      {live.participants.length ? (
        <View style={styles.who}>
          <View style={{ flexDirection: 'row' }}>
            {live.participants.slice(0, 5).map((p, idx) => (
              <Avatar key={p.id} name={p.name} photoUrl={p.photoUrl} size={22} style={{ marginLeft: idx === 0 ? 0 : -7, borderWidth: 2, borderColor: '#fff' }} />
            ))}
          </View>
          <Text style={styles.whoLabel}>{live.participants.length}명이 함께하고 있어요</Text>
        </View>
      ) : null}

      <View style={styles.countRow}>
        <Pressable onPress={() => toggleLike(live.id).catch(() => {})} style={styles.countBtn}>
          <Icon name={live.likedByMe ? 'heart' : 'heart-outline'} size={17} color={live.likedByMe ? colors.like : colors.ink3} />
          <Text style={styles.countText}>{live.likesCount}</Text>
        </Pressable>
        <View style={styles.countBtn}>
          <Icon name="bookmark-outline" size={15} color={colors.ink3} />
          <Text style={styles.countText}>{live.savesCount}명이 담았어요</Text>
        </View>
      </View>

      {isMine ? (
        <Text style={styles.mineNote}>내가 올린 꿈이에요.</Text>
      ) : live.done ? (
        <Text style={styles.mineNote}>이미 이룬 꿈은 담을 수 없어요. 대신 응원을 남겨보세요 ♥</Text>
      ) : joined ? (
        <>
          <View style={styles.joinedPill}><Text style={styles.joinedPillText}>✓ 이미 내 목록에 담았어요</Text></View>
          <BubbleButton title="함께하기 취소" onPress={doLeave} disabled={busy} variant="ghost" full style={{ marginTop: 10 }} />
        </>
      ) : (
        <BubbleButton title="내 목록에 담기" onPress={doJoin} loading={busy} full style={{ marginTop: 18 }} />
      )}

      {!isMine ? (
        <Pressable onPress={() => { onClose(); onReport(live); }} style={styles.reportBtn}>
          <Text style={styles.reportText}>신고 · 차단하기</Text>
        </Pressable>
      ) : null}
      <BubbleButton title="닫기" onPress={onClose} variant="ghost" full style={{ marginTop: 10 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 190, borderRadius: radius.lg, marginBottom: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroEmoji: { fontSize: 52 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 14 },
  ownerName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  ownerSub: { fontSize: 11.5, color: colors.accent, marginTop: 2 },
  note: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 7, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' },
  dday: { backgroundColor: colors.doneWash, borderRadius: 9, paddingVertical: 4, paddingHorizontal: 9 },
  ddayText: { fontSize: 11.5, fontWeight: '700', color: colors.done },
  memWrap: { marginTop: 16, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
  memCap: { padding: 12 },
  memBadge: { fontSize: 12, fontWeight: '700', color: colors.done },
  memText: { fontSize: 13.5, color: colors.ink, lineHeight: 19, marginTop: 6 },
  memDate: { fontSize: 11.5, color: colors.ink3, marginTop: 6 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  whoLabel: { fontSize: 12, color: colors.ink2 },
  countRow: { flexDirection: 'row', gap: 18, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  countBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countText: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  mineNote: { fontSize: 12.5, color: colors.ink3, textAlign: 'center', marginTop: 18, lineHeight: 18 },
  joinedPill: { backgroundColor: colors.accentWash, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: 18 },
  joinedPillText: { fontSize: 13.5, color: colors.accentInk, fontWeight: '700' },
  reportBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16, marginTop: 6 },
  reportText: { fontSize: 12, color: colors.ink3, textDecorationLine: 'underline' },
});
