import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Sheet from '../components/Sheet';
import { CategoryPicker, EmojiPicker, Field, FieldLabel, RegionToggle } from '../components/FormBits';
import BubbleButton from '../components/Button';
import { CATEGORIES, EMOJIS } from '../theme';
import type { Item, Region } from '../api/types';

export interface AddEditPayload {
  title: string;
  emoji: string;
  note: string;
  category: string;
  location: { name: string; region: Region } | null;
}

export default function AddEditSheet({
  visible, onClose, editingItem, onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  editingItem: Item | null;
  onSubmit: (payload: AddEditPayload) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [region, setRegion] = useState<Region>('domestic');
  const [locName, setLocName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingItem) {
      setTitle(editingItem.title);
      setNote(editingItem.note || '');
      setEmoji(editingItem.emoji);
      setCategory(editingItem.category || CATEGORIES[0]);
      setRegion(editingItem.location?.region || 'domestic');
      setLocName(editingItem.location?.name || '');
    } else {
      setTitle(''); setNote(''); setEmoji(EMOJIS[0]); setCategory(CATEGORIES[0]); setRegion('domestic'); setLocName('');
    }
  }, [visible, editingItem]);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(), emoji, note: note.trim(), category,
        location: locName.trim() ? { name: locName.trim(), region } : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={editingItem ? '꿈 수정' : '새로운 꿈'} subtitle="이루고 싶은 걸 적어보세요. 친구도 함께 이룰 수 있어요.">
      <FieldLabel>카테고리</FieldLabel>
      <CategoryPicker value={category} onChange={setCategory} />
      <FieldLabel>아이콘</FieldLabel>
      <EmojiPicker options={EMOJIS} value={emoji} onChange={setEmoji} />
      <FieldLabel>무엇을 이루고 싶나요?</FieldLabel>
      <Field value={title} onChangeText={setTitle} placeholder="예: 오로라 보러 가기" maxLength={60} />
      <FieldLabel>메모 (선택)</FieldLabel>
      <Field value={note} onChangeText={setNote} placeholder="예: 아이슬란드 또는 핀란드" maxLength={80} />
      <FieldLabel>위치 (선택)</FieldLabel>
      <RegionToggle value={region} onChange={setRegion} />
      <View style={{ marginTop: 10 }}>
        <Field value={locName} onChangeText={setLocName} placeholder="장소 이름 (예: 제주 애월, 파리 에펠탑)" maxLength={60} />
      </View>
      <BubbleButton
        title={editingItem ? '저장하기' : '추가하기'}
        onPress={submit}
        disabled={!title.trim()}
        loading={saving}
        full
        style={{ marginTop: 22 }}
      />
    </Sheet>
  );
}
