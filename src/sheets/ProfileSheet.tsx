import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Sheet from '../components/Sheet';
import { Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import Avatar from '../components/Avatar';
import { colors } from '../theme';
import { uploadPhoto } from '../services/uploadService';
import { useAuth } from '../context/AuthContext';

export default function ProfileSheet({ visible, onClose, onReplayOnboarding }: { visible: boolean; onClose: () => void; onReplayOnboarding: () => void }) {
  const { user, updateMe, logout } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;
    setName(user.name);
    setBio(user.bio);
    setPhotoUrl(user.photoUrl);
  }, [visible, user]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 라이브러리 접근을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0] || !user) return;
    setUploadingPhoto(true);
    try {
      const res = await uploadPhoto(result.assets[0].uri, user.id, 'avatars');
      setPhotoUrl(res.url);
    } catch (e) {
      Alert.alert('업로드 실패', '사진을 업로드하지 못했어요. 다시 시도해주세요.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await updateMe({ name: name.trim() || '나', bio: bio.trim(), photoUrl });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="프로필 편집" subtitle="나를 표현하는 이름과 한 줄 소개를 적어보세요.">
      <View style={styles.photoRow}>
        <Pressable onPress={pickPhoto} disabled={uploadingPhoto}>
          <Avatar name={name || user?.name || '나'} photoUrl={photoUrl} size={84} dashed />
          <View style={styles.photoBadge}>
            {uploadingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14 }}>📷</Text>}
          </View>
        </Pressable>
        <Pressable onPress={pickPhoto} disabled={uploadingPhoto}>
          <Text style={styles.photoLabel}>{photoUrl ? '사진 바꾸기' : '사진 추가하기'}</Text>
        </Pressable>
        {photoUrl ? (
          <Pressable onPress={() => setPhotoUrl(null)} disabled={uploadingPhoto}>
            <Text style={styles.photoRemove}>사진 없애기</Text>
          </Pressable>
        ) : null}
      </View>
      <FieldLabel>이름</FieldLabel>
      <Field value={name} onChangeText={setName} placeholder="나" maxLength={12} />
      <FieldLabel>소개</FieldLabel>
      <Field value={bio} onChangeText={setBio} placeholder="예: 별을 하나씩 채우는 중" maxLength={40} />
      <BubbleButton title="저장하기" onPress={submit} loading={saving} disabled={uploadingPhoto} full style={{ marginTop: 22 }} />
      <BubbleButton title="✦ 앱 소개 다시 보기" onPress={() => { onClose(); onReplayOnboarding(); }} variant="ghost" full style={{ marginTop: 12 }} />
      <BubbleButton title="로그아웃" onPress={() => { onClose(); logout(); }} variant="ghost" full style={{ marginTop: 12 }} textColor="#D8544E" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photoRow: { alignItems: 'center', gap: 6, marginBottom: 8 },
  photoBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  photoLabel: { fontSize: 12.5, fontWeight: '700', color: colors.accentInk, marginTop: 8 },
  photoRemove: { fontSize: 11.5, color: colors.ink3, marginTop: 4 },
});
