import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Sheet from '../components/Sheet';
import { Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import Icon from '../components/Icon';
import { colors } from '../theme';
import { resolveImageUrl } from '../api/client';
import { uploadPhoto } from '../services/uploadService';
import { useAuth } from '../context/AuthContext';
import { MAX_MEMORY_PHOTOS } from '../api/types';
import type { Item } from '../api/types';

export default function MemorySheet({
  visible, onClose, item, onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onSubmit: (payload: { photoUrls: string[]; text: string }) => Promise<void>;
}) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const existing = item?.memory?.photos?.length ? item.memory.photos : (item?.memory?.photo ? [item.memory.photo] : []);
    setPhotos(existing);
    setText(item?.memory?.text || '');
  }, [visible, item]);

  const remaining = MAX_MEMORY_PHOTOS - photos.length;

  const pickPhotos = async () => {
    if (remaining <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 라이브러리 접근을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return;
    if (!user) return;
    const assets = result.assets.slice(0, remaining);
    setUploading(true);
    try {
      const uploaded = await Promise.all(assets.map((a) => uploadPhoto(a.uri, user.id)));
      setPhotos((prev) => [...prev, ...uploaded.map((r) => r.url)].slice(0, MAX_MEMORY_PHOTOS));
    } catch (e) {
      Alert.alert('업로드 실패', '사진을 업로드하지 못했어요. 다시 시도해주세요.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => setPhotos((prev) => prev.filter((p) => p !== url));

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({ photoUrls: photos, text: text.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={item?.done ? '추억 수정하기' : '완료하고 추억 남기기'} subtitle={item ? `${item.emoji} ${item.title}` : ''}>
      <View style={styles.photoHeadRow}>
        <FieldLabel>{`사진 (${photos.length}/${MAX_MEMORY_PHOTOS}장)`}</FieldLabel>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {photos.map((uri) => {
          const previewUri = resolveImageUrl(uri) || uri;
          return (
            <View key={uri} style={styles.thumbWrap}>
              <Image source={{ uri: previewUri }} style={styles.thumb} />
              <Pressable style={styles.rm} onPress={() => removePhoto(uri)} hitSlop={4} accessibilityRole="button" accessibilityLabel="사진 삭제">
                <Icon name="close" size={13} color="#fff" />
              </Pressable>
            </View>
          );
        })}
        {remaining > 0 ? (
          <Pressable onPress={pickPhotos} style={styles.drop} disabled={uploading}>
            {uploading ? <ActivityIndicator color={colors.accent} /> : (
              <>
                <Icon name="camera-outline" size={22} color={colors.ink2} />
                <Text style={styles.dropText}>사진 추가</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      <FieldLabel>그날의 기록</FieldLabel>
      <Field value={text} onChangeText={setText} placeholder="어땠어요? 누구와 함께였나요? 느낀 점을 적어보세요." multiline />
      <BubbleButton title={item?.done ? '저장하기' : '완료하고 저장'} onPress={submit} loading={saving || uploading} full style={{ marginTop: 22 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photoHeadRow: { flexDirection: 'row', alignItems: 'center' },
  photoRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  drop: {
    width: 96, height: 96, borderWidth: 1.5, borderColor: colors.line2, borderRadius: 13,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  dropText: { fontSize: 11.5, color: colors.ink2, fontWeight: '500' },
  thumbWrap: { width: 96, height: 96, borderRadius: 13, overflow: 'hidden', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  rm: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(28,27,24,.62)', alignItems: 'center', justifyContent: 'center' },
});
