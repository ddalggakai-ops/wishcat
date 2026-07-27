import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Sheet from '../components/Sheet';
import { colors, radius } from '../theme';
import type { Item } from '../api/types';

export default function ItemMenuSheet({
  visible, onClose, item, onInvite, onEdit, onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onInvite: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  if (!item) return <Sheet visible={visible} onClose={onClose} title="꿈 관리">{null}</Sheet>;
  return (
    <Sheet visible={visible} onClose={onClose} title="꿈 관리" subtitle={`${item.emoji} ${item.title}`}>
      <MenuOpt label="👥 함께할 친구 초대" onPress={() => { onClose(); onInvite(item); }} />
      <MenuOpt label="✏️ 수정하기" onPress={() => { onClose(); onEdit(item); }} />
      <MenuOpt label="🗑️ 삭제하기" onPress={() => onDelete(item)} danger />
    </Sheet>
  );
}

function MenuOpt({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.opt} onPress={onPress}>
      <Text style={[styles.optText, danger && { color: colors.like }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  opt: { width: '100%', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, marginTop: 10 },
  optText: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
