import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import BubbleButton from '../components/Button';
import { inviteWebUrl } from '../config/links';
import { absoluteFill, colors, radius } from '../theme';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

export default function InviteModal({
  visible, onClose, item, onToast,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null; // 특정 꿈에 붙는 초대인 경우
  onToast: (msg: string) => void;
}) {
  const { createInvite } = useApp();
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) { setCode(null); setFailed(false); return; }
    setLoading(true);
    setFailed(false);
    createInvite(item?.id)
      .then(setCode)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [visible, item, createInvite]);

  // 앱이 없는 친구도 누를 수 있도록 웹 링크를 보냅니다.
  // (그 페이지가 앱이 깔려 있으면 앱으로, 아니면 설치 안내로 보내줍니다)
  const link = code ? inviteWebUrl(code) : '';
  const message = user
    ? `${user.name}님이 위시캣에 초대했어요${item ? ` · "${item.title}" 함께해요` : ''} ✦\n${link}`
    : link;

  // 링크를 못 만들었는데도 복사/공유가 되면 빈 문자열을 복사한 뒤 "복사했어요"라고 잘못 알렸어요.
  const canUseLink = !loading && !failed && !!link;
  const doShare = () => { if (!canUseLink) return; Share.share({ message }).catch(() => {}); };
  const doCopy = async () => {
    if (!canUseLink) return;
    await Clipboard.setStringAsync(link);
    onToast('초대 링크를 복사했어요');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.title}>{item ? '이 꿈에 친구 초대하기' : '친구 초대하기'}</Text>
          <View style={styles.avatarWrap}>
            <Text style={{ fontSize: 44 }}>✦</Text>
          </View>
          <Text style={styles.desc}>
            {item ? `"${item.title}" 꿈을 함께할 친구에게 링크를 보내보세요.` : '링크를 보내서 친구를 위시캣으로 초대해보세요.'}
          </Text>
          <Text style={styles.sub}>앱이 없는 친구도 열 수 있어요 · 설치 후에도 초대가 이어집니다</Text>
          <View style={styles.linkRow}>
            <Text numberOfLines={1} style={styles.linkText}>
              {loading ? '링크 만드는 중…' : failed ? '링크를 만들지 못했어요' : link}
            </Text>
            <Pressable style={[styles.copyBtn, !canUseLink && styles.copyBtnOff]} onPress={doCopy} disabled={!canUseLink} accessibilityRole="button" accessibilityLabel="초대 링크 복사">
              <Text style={styles.copyText}>복사</Text>
            </Pressable>
          </View>
          {failed ? (
            <BubbleButton title="다시 시도" onPress={() => { setFailed(false); setLoading(true); createInvite(item?.id).then(setCode).catch(() => setFailed(true)).finally(() => setLoading(false)); }} full style={{ marginTop: 16 }} />
          ) : (
            <BubbleButton title="친구에게 초대 보내기" onPress={doShare} disabled={!canUseLink} full style={{ marginTop: 16 }} />
          )}
          <BubbleButton title="닫기" onPress={onClose} variant="ghost" full style={{ marginTop: 10 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...absoluteFill, backgroundColor: 'rgba(20,30,48,.62)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: 22, padding: 22 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  avatarWrap: { alignItems: 'center', marginVertical: 18 },
  desc: { fontSize: 13.5, color: colors.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  sub: { fontSize: 11.5, color: colors.ink3, textAlign: 'center', marginBottom: 14 },
  linkRow: { flexDirection: 'row', gap: 8, backgroundColor: colors.surface2, borderRadius: 12, padding: 4, alignItems: 'center' },
  linkText: { flex: 1, fontSize: 12.5, color: colors.ink2, paddingLeft: 10 },
  copyBtn: { backgroundColor: colors.accent, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14 },
  copyBtnOff: { opacity: 0.45 },
  copyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
