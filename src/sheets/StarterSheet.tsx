import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Sheet from '../components/Sheet';
import BubbleButton from '../components/Button';
import Icon from '../components/Icon';
import { STARTER_PACKS } from '../data/starterTemplates';
import { colors, radius } from '../theme';
import { useApp } from '../context/AppContext';

/**
 * 시작 템플릿 — 처음 들어와서 텅 빈 목록 앞에 멈춘 사람을 위한 화면입니다.
 * 묶음을 고르고, 그 안에서 원하는 것만 체크해서 한 번에 담습니다.
 */
export default function StarterSheet({
  visible, onClose, onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: (count: number) => void;
}) {
  const { bulkAddItems } = useApp();
  const [packKey, setPackKey] = useState(STARTER_PACKS[0].key);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const pack = useMemo(
    () => STARTER_PACKS.find((p) => p.key === packKey) || STARTER_PACKS[0],
    [packKey],
  );

  // 열 때마다, 그리고 묶음을 바꿀 때마다 전부 선택된 상태로 시작합니다.
  useEffect(() => {
    if (!visible) return;
    const next: Record<string, boolean> = {};
    pack.items.forEach((it) => { next[it.title] = true; });
    setPicked(next);
  }, [visible, pack]);

  useEffect(() => { if (visible) setPackKey(STARTER_PACKS[0].key); }, [visible]);

  const chosen = pack.items.filter((it) => picked[it.title]);

  const submit = async () => {
    if (!chosen.length) return;
    setSaving(true);
    try {
      const count = await bulkAddItems(chosen);
      onAdded(count);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="이런 꿈은 어때요?"
      subtitle="마음에 드는 걸 골라 한 번에 담아보세요. 담은 뒤에 얼마든지 고칠 수 있어요."
    >
      <View style={styles.packRow}>
        {STARTER_PACKS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPackKey(p.key)}
            style={[styles.pack, p.key === pack.key && styles.packOn]}
          >
            <Text style={styles.packEmoji}>{p.emoji}</Text>
            <Text style={[styles.packTitle, p.key === pack.key && styles.packTitleOn]}>{p.title}</Text>
            <Text style={styles.packDesc}>{p.desc}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.selectBar}>
        <Pressable
          onPress={() => {
            const all: Record<string, boolean> = {};
            pack.items.forEach((it) => { all[it.title] = true; });
            setPicked(all);
          }}
        >
          <Text style={styles.selectText}>전체 선택</Text>
        </Pressable>
        <Pressable onPress={() => setPicked({})}>
          <Text style={styles.selectText}>전체 해제</Text>
        </Pressable>
      </View>

      {pack.items.map((it) => {
        const on = !!picked[it.title];
        return (
          <Pressable
            key={it.title}
            onPress={() => setPicked((prev) => ({ ...prev, [it.title]: !prev[it.title] }))}
            style={[styles.row, on && styles.rowOn]}
          >
            <View style={[styles.check, on && styles.checkOn]}>
              {on ? <Icon name="checkmark" size={13} color="#fff" /> : null}
            </View>
            <Text style={{ fontSize: 17 }}>{it.emoji}</Text>
            <Text style={[styles.rowTitle, on && styles.rowTitleOn]} numberOfLines={2}>{it.title}</Text>
          </Pressable>
        );
      })}

      <BubbleButton
        title={chosen.length ? `${chosen.length}개 담기` : '담을 꿈을 골라주세요'}
        onPress={submit}
        disabled={!chosen.length}
        loading={saving}
        full
        style={{ marginTop: 20 }}
      />
      <BubbleButton title="나중에 할게요" onPress={onClose} variant="ghost" full style={{ marginTop: 10 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  packRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  pack: {
    width: '47.5%', borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 12, gap: 3,
  },
  packOn: { borderColor: colors.accent, backgroundColor: 'rgba(74,144,217,.08)' },
  packEmoji: { fontSize: 21 },
  packTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  packTitleOn: { color: colors.accent },
  packDesc: { fontSize: 11, color: colors.ink3 },
  selectBar: { flexDirection: 'row', gap: 16, marginTop: 18, marginBottom: 6 },
  selectText: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, marginTop: 8, backgroundColor: colors.surface,
  },
  rowOn: { borderColor: colors.accent, backgroundColor: 'rgba(74,144,217,.06)' },
  check: {
    width: 21, height: 21, borderRadius: 7, borderWidth: 2, borderColor: colors.line2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  rowTitle: { flex: 1, fontSize: 14, color: colors.ink2 },
  rowTitleOn: { color: colors.ink, fontWeight: '600' },
});
