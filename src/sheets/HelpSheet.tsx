import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Sheet from '../components/Sheet';
import { EmojiPicker, Field, FieldLabel } from '../components/FormBits';
import BubbleButton from '../components/Button';
import { colors, radius, HELP_EMOJIS } from '../theme';
import { alertDialog } from '../utils/dialog';
import type { Item } from '../api/types';

export default function HelpSheet({
  visible, onClose, item, onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onSubmit: (payload: { title: string; emoji: string; text: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(HELP_EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(''); setText(''); setEmoji(HELP_EMOJIS[0]);
  }, [visible, item]);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), emoji, text: text.trim() });
      onClose();
    } catch {
      await alertDialog('저장하지 못했어요', '잠시 뒤 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="친구의 꿈 도와주기" subtitle={item ? `${item.owner.name}님의 버킷리스트를 도와 이뤄줬나요? 내 기록으로도 남겨요.` : ''}>
      {item ? (
        <View style={styles.src}>
          <View style={styles.srcIcon}><Text style={{ fontSize: 20 }}>{item.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.srcTitle}>{item.title}</Text>
            <Text style={styles.srcSub}>{item.owner.name}님의 꿈{item.note ? ` · ${item.note}` : ''}</Text>
          </View>
        </View>
      ) : null}
      <FieldLabel>내 기록으로 남기기 · 내가 한 일</FieldLabel>
      <Field value={title} onChangeText={setTitle} placeholder="예: 소개팅 주선해서 결혼까지 골인하는 거 보기" maxLength={70} />
      <FieldLabel>카테고리</FieldLabel>
      <EmojiPicker options={HELP_EMOJIS} value={emoji} onChange={setEmoji} />
      <FieldLabel>한마디 기록 (선택)</FieldLabel>
      <Field value={text} onChangeText={setText} placeholder="어떻게 도왔어요? 그때 기분은?" multiline />
      <BubbleButton title="친구 꿈 완료하고 내 기록에 담기" onPress={submit} disabled={!title.trim()} loading={saving} full style={{ marginTop: 22 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  src: { flexDirection: 'row', gap: 11, backgroundColor: colors.surface2, borderRadius: 12, padding: 13, alignItems: 'flex-start' },
  srcIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.accentWash, alignItems: 'center', justifyContent: 'center' },
  srcTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  srcSub: { fontSize: 12.5, color: colors.ink2, marginTop: 3 },
});
