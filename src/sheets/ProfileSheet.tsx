import React, { useEffect, useState } from 'react';
import Sheet from '../components/Sheet';
import { Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import { useAuth } from '../context/AuthContext';

export default function ProfileSheet({ visible, onClose, onReplayOnboarding }: { visible: boolean; onClose: () => void; onReplayOnboarding: () => void }) {
  const { user, updateMe, logout } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;
    setName(user.name);
    setBio(user.bio);
  }, [visible, user]);

  const submit = async () => {
    setSaving(true);
    try {
      await updateMe({ name: name.trim() || '나', bio: bio.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="프로필 편집" subtitle="나를 표현하는 이름과 한 줄 소개를 적어보세요.">
      <FieldLabel>이름</FieldLabel>
      <Field value={name} onChangeText={setName} placeholder="나" maxLength={12} />
      <FieldLabel>소개</FieldLabel>
      <Field value={bio} onChangeText={setBio} placeholder="예: 별을 하나씩 채우는 중" maxLength={40} />
      <BubbleButton title="저장하기" onPress={submit} loading={saving} full style={{ marginTop: 22 }} />
      <BubbleButton title="✦ 앱 소개 다시 보기" onPress={() => { onClose(); onReplayOnboarding(); }} variant="ghost" full style={{ marginTop: 12 }} />
      <BubbleButton title="로그아웃" onPress={() => { onClose(); logout(); }} variant="ghost" full style={{ marginTop: 12 }} textColor="#D8544E" />
    </Sheet>
  );
}
