import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Sheet from '../components/Sheet';
import { Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import { colors, radius } from '../theme';
import { blockUser, submitReport } from '../services/moderationService';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

const REASONS = [
  '괴롭힘이나 혐오 표현',
  '음란물 · 선정적인 내용',
  '폭력적이거나 위험한 내용',
  '스팸 · 광고',
  '사칭이나 사기',
  '기타',
];

/**
 * 신고 · 차단 시트.
 * 스토어(UGC) 정책상 다른 사람이 올린 내용은 신고할 수 있어야 하고,
 * 그 사람을 더 이상 보지 않게 차단할 수도 있어야 합니다.
 */
export default function ReportSheet({
  visible, onClose, item, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onDone: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(REASONS[0]);
    setDetail('');
  }, [visible]);

  if (!item) return null;

  const send = async (alsoBlock: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      await submitReport({
        reporterId: user.id,
        targetType: 'item',
        targetId: item.id,
        targetOwnerId: item.owner.id,
        reason: detail.trim() ? `${reason} — ${detail.trim()}` : reason,
      });
      if (alsoBlock) await blockUser(user.id, item.owner.id);
      onDone(alsoBlock ? `신고했고 ${item.owner.name}님을 차단했어요` : '신고를 접수했어요');
      onClose();
    } catch {
      Alert.alert('신고하지 못했어요', '잠시 뒤 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="신고하기"
      subtitle={`"${item.title}" — 어떤 점이 문제인가요? 접수된 내용은 운영자가 확인합니다.`}
    >
      <FieldLabel>사유</FieldLabel>
      <View style={styles.reasonWrap}>
        {REASONS.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} style={[styles.reason, r === reason && styles.reasonOn]}>
            <Text style={[styles.reasonText, r === reason && styles.reasonTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <FieldLabel>자세한 내용 (선택)</FieldLabel>
      <Field value={detail} onChangeText={setDetail} placeholder="어떤 상황인지 적어주시면 확인에 도움이 돼요" maxLength={300} multiline />

      <BubbleButton title="신고 보내기" onPress={() => send(false)} loading={busy} full style={{ marginTop: 22 }} />
      <BubbleButton
        title={`신고하고 ${item.owner.name}님 차단하기`}
        onPress={() => send(true)}
        disabled={busy}
        variant="ghost"
        full
        style={{ marginTop: 10 }}
        textColor="#D8544E"
      />
      <Text style={styles.note}>차단하면 둘러보기에서 그 사람의 꿈이 더 이상 보이지 않아요.</Text>
      <BubbleButton title="닫기" onPress={onClose} variant="ghost" full style={{ marginTop: 10 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reason: { borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13 },
  reasonOn: { borderColor: colors.accent, backgroundColor: 'rgba(74,144,217,.1)' },
  reasonText: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  reasonTextOn: { color: colors.accent },
  note: { fontSize: 11.5, color: colors.ink3, textAlign: 'center', marginTop: 10, lineHeight: 17 },
});
