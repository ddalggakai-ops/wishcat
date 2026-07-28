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
  const { user, updateMe, logout, deleteAccount } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !user) return;
    setName(user.name);
    setBio(user.bio);
    setPhotoUrl(user.photoUrl);
    setShowDelete(false);
    setDeletePw('');
    setDeleteError(null);
  }, [visible, user]);

  const confirmDelete = () => {
    Alert.alert(
      '정말 계정을 삭제할까요?',
      '내가 적은 꿈, 추억, 친구 관계가 모두 지워지고 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제할게요',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setDeleteError(null);
            try {
              await deleteAccount(deletePw);
              // 계정이 사라지면 로그인 화면으로 돌아갑니다.
            } catch (e: any) {
              setDeleteError(e?.message || '계정을 삭제하지 못했어요');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

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

      <View style={styles.danger}>
        {!showDelete ? (
          <Pressable onPress={() => setShowDelete(true)} style={styles.dangerToggle}>
            <Text style={styles.dangerToggleText}>계정 삭제</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.dangerTitle}>계정 삭제</Text>
            <Text style={styles.dangerDesc}>
              내가 적은 꿈과 추억, 친구 관계가 모두 지워져요. 되돌릴 수 없어요.{'\n'}
              확인을 위해 비밀번호를 한 번 더 입력해주세요.
            </Text>
            <Field
              value={deletePw}
              onChangeText={(t) => { setDeletePw(t); setDeleteError(null); }}
              placeholder="비밀번호"
              secure
              autoComplete="current-password"
            />
            {deleteError ? <Text style={styles.dangerError}>{deleteError}</Text> : null}
            <BubbleButton
              title="계정 영구 삭제"
              onPress={confirmDelete}
              disabled={!deletePw}
              loading={deleting}
              full
              variant="ghost"
              textColor="#D8544E"
              style={{ marginTop: 12 }}
            />
            <BubbleButton title="아니요, 그만둘래요" onPress={() => { setShowDelete(false); setDeletePw(''); setDeleteError(null); }} variant="ghost" full style={{ marginTop: 8 }} />
          </>
        )}
      </View>
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
  danger: { marginTop: 26, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  dangerToggle: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  dangerToggleText: { fontSize: 12, color: colors.ink3, textDecorationLine: 'underline' },
  dangerTitle: { fontSize: 14, fontWeight: '700', color: '#D8544E', marginBottom: 6 },
  dangerDesc: { fontSize: 12.5, color: colors.ink2, lineHeight: 19, marginBottom: 12 },
  dangerError: { fontSize: 12.5, color: '#D8544E', marginTop: 8 },
});
