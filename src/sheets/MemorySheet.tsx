import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Sheet from '../components/Sheet';
import { Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import { absoluteFill, colors, radius } from '../theme';
import { resolveImageUrl } from '../api/client';
import { uploadPhoto } from '../services/uploadService';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../api/types';

export default function MemorySheet({
  visible, onClose, item, onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onSubmit: (payload: { photoUrl: string | null; text: string }) => Promise<void>;
}) {
  const { user } = useAuth();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLocalUri(null);
    setUploadedUrl(item?.memory?.photo || null);
    setText(item?.memory?.text || '');
  }, [visible, item]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 라이브러리 접근을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    if (!user) return;
    const uri = result.assets[0].uri;
    setLocalUri(uri);
    setUploading(true);
    try {
      const res = await uploadPhoto(uri, user.id);
      setUploadedUrl(res.url);
    } catch (e) {
      Alert.alert('업로드 실패', '사진을 업로드하지 못했어요. 다시 시도해주세요.');
      setLocalUri(null);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({ photoUrl: uploadedUrl, text: text.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const previewUri = localUri || resolveImageUrl(uploadedUrl);

  return (
    <Sheet visible={visible} onClose={onClose} title={item?.done ? '추억 수정하기' : '완료하고 추억 남기기'} subtitle={item ? `${item.emoji} ${item.title}` : ''}>
      {previewUri ? (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: previewUri }} style={styles.thumb} />
          <Pressable style={styles.rm} onPress={() => { setLocalUri(null); setUploadedUrl(null); }}>
            <Text style={{ color: '#fff', fontSize: 14 }}>✕</Text>
          </Pressable>
          {uploading ? <View style={styles.uploadingOverlay}><Text style={{ color: '#fff' }}>업로드 중…</Text></View> : null}
        </View>
      ) : (
        <Pressable onPress={pickPhoto} style={styles.drop}>
          <Text style={{ fontSize: 22 }}>📷</Text>
          <Text style={styles.dropText}>사진 추가하기</Text>
        </Pressable>
      )}
      <FieldLabel>그날의 기록</FieldLabel>
      <Field value={text} onChangeText={setText} placeholder="어땠어요? 누구와 함께였나요? 느낀 점을 적어보세요." multiline />
      <BubbleButton title={item?.done ? '저장하기' : '완료하고 저장'} onPress={submit} loading={saving || uploading} full style={{ marginTop: 22 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  drop: { borderWidth: 1.5, borderColor: colors.line2, borderStyle: 'dashed', borderRadius: 13, paddingVertical: 22, alignItems: 'center', gap: 8 },
  dropText: { fontSize: 13.5, color: colors.ink2, fontWeight: '500' },
  thumbWrap: { borderRadius: 13, overflow: 'hidden', position: 'relative' },
  thumb: { width: '100%', height: 220 },
  rm: { position: 'absolute', top: 9, right: 9, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(28,27,24,.62)', alignItems: 'center', justifyContent: 'center' },
  uploadingOverlay: { ...absoluteFill, backgroundColor: 'rgba(0,0,0,.35)', alignItems: 'center', justifyContent: 'center' },
});
