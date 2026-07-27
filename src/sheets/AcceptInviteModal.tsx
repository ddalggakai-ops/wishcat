import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import BubbleButton from '../components/Button';
import { absoluteFill, colors } from '../theme';
import { getInvitePreview, acceptInvite as acceptInviteRequest } from '../services/friendsService';
import { useAuth } from '../context/AuthContext';

interface Preview { fromUser: { id: string; name: string; avatarColor: string }; item: { title: string; emoji: string } | null }

export default function AcceptInviteModal({
  code, onClose, onAccepted,
}: {
  code: string | null;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const { user } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    setPreview(null);
    setError(null);
    getInvitePreview(code).then(setPreview).catch((e) => setError(e instanceof Error ? e.message : '초대를 불러오지 못했어요'));
  }, [code]);

  const accept = async () => {
    if (!code || !user) return;
    setLoading(true);
    try {
      await acceptInviteRequest(code, user.id);
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수락하지 못했어요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={!!code} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.brand}>✦ 위시캣 초대</Text>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : preview ? (
            <>
              <View style={styles.row}>
                <Avatar name={preview.fromUser.name} size={48} />
                <Text style={styles.desc}>
                  <Text style={{ fontWeight: '700' }}>{preview.fromUser.name}</Text>님이 초대했어요
                  {preview.item ? `\n"${preview.item.emoji} ${preview.item.title}" 함께해요` : ''}
                </Text>
              </View>
              <BubbleButton title="수락하고 친구 되기" onPress={accept} loading={loading} full style={{ marginTop: 18 }} />
            </>
          ) : (
            <Text style={styles.desc}>불러오는 중…</Text>
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
  brand: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center', marginBottom: 16 },
  row: { alignItems: 'center', gap: 12 },
  desc: { fontSize: 14.5, color: colors.ink2, textAlign: 'center', lineHeight: 21 },
  error: { fontSize: 14, color: colors.like, textAlign: 'center', marginVertical: 10 },
});
