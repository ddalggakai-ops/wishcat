import React from 'react';
import { Image, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import { CategoryChip, LocationChip } from '../components/Chips';
import { absoluteFill, colors, radius, shadow } from '../theme';
import { resolveImageUrl } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

export default function ViewerModal({ visible, item, onClose }: { visible: boolean; item: Item | null; onClose: () => void }) {
  const { toggleLike } = useApp();
  const { user } = useAuth();
  if (!item) return null;
  const photo = resolveImageUrl(item.memory?.photo);
  const isMe = item.owner.id === user?.id;

  const share = () => {
    Share.share({
      message: `✦ 위시캣에서 이룬 꿈 · ${item.title}${item.memory?.text ? `\n${item.memory.text}` : ''}\n#위시캣 #버킷리스트`,
    }).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={{ position: 'relative' }}>
            {photo ? <Image source={{ uri: photo }} style={styles.hero} /> : (
              <View style={[styles.hero, styles.heroPh]}><Text style={{ fontSize: 70 }}>{item.emoji}</Text></View>
            )}
            <Pressable style={styles.close} onPress={onClose}><Text style={{ color: '#fff', fontSize: 16 }}>✕</Text></Pressable>
          </View>
          <View style={styles.body}>
            <View style={styles.headRow}>
              <Avatar name={item.owner.name} size={26} />
              <Text style={styles.headText}>{isMe ? '나' : item.owner.name} · {item.memory?.date}</Text>
            </View>
            <Text style={styles.title}>{item.emoji} {item.title}</Text>
            {(item.category || item.location) ? (
              <View style={styles.metaRow}>
                {item.category ? <CategoryChip category={item.category} /> : null}
                {item.location ? <LocationChip location={item.location} /> : null}
              </View>
            ) : null}
            <Text style={styles.cap}>{item.memory?.text || '기록이 아직 없어요.'}</Text>
            {item.origin === 'helped' && item.helpedFor ? (
              <Text style={styles.helpedNote}>🎁 {item.helpedFor.name}님의 "{item.source?.title}" 꿈을 도왔어요</Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={() => toggleLike(item.id)} style={styles.likeBtn}>
                <Text style={{ color: item.likedByMe ? colors.like : colors.ink3, fontSize: 18 }}>{item.likedByMe ? '♥' : '♡'}</Text>
                <Text style={styles.likeCount}>{item.likesCount}</Text>
              </Pressable>
              <Text style={styles.saveCount}>🔖 {item.savesCount}</Text>
              <Pressable style={styles.shareBtn} onPress={share}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13.5 }}>↑ 공유</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...absoluteFill, backgroundColor: 'rgba(20,30,48,.62)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', maxHeight: '88%' },
  hero: { width: '100%', aspectRatio: 1 },
  heroPh: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(20,30,48,.5)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headText: { fontSize: 13, color: colors.ink2, fontWeight: '600' },
  title: { fontSize: 21, fontWeight: '700', color: colors.ink, marginTop: 12, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 7, marginBottom: 10, flexWrap: 'wrap' },
  cap: { fontSize: 14.5, lineHeight: 21, color: colors.ink },
  helpedNote: { fontSize: 12, color: colors.ink3, marginTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { fontSize: 14, color: colors.ink2, fontWeight: '600' },
  saveCount: { fontSize: 13, color: colors.ink2 },
  shareBtn: { marginLeft: 'auto', backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 15 },
});
