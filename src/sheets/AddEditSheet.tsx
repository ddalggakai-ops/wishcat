import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Sheet from '../components/Sheet';
import { CategoryPicker, EmojiPicker, Field, FieldLabel, RegionToggle } from '../components/FormBits';
import BubbleButton from '../components/Button';
import LocationMapPicker, { PickedLocation } from '../components/LocationMapPicker';
import { LocationPreview } from '../components/Chips';
import { CATEGORIES, EMOJIS, colors, radius } from '../theme';
import type { Item, Location, Region } from '../api/types';

export interface AddEditPayload {
  title: string;
  emoji: string;
  note: string;
  category: string;
  location: Location | null;
  targetDate: string | null;
}

/** 오늘로부터 n개월 뒤를 'YYYY-MM-DD' 로 */
function monthsAhead(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function endOfYear(): string {
  return `${new Date().getFullYear()}-12-31`;
}

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return false;
  const d = new Date(y, mo - 1, da);
  return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === da;
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
  const [pickedLoc, setPickedLoc] = useState<PickedLocation | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [targetDate, setTargetDate] = useState('');
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
      setPickedLoc(
        editingItem.location?.lat != null && editingItem.location?.lng != null
          ? { lat: editingItem.location.lat, lng: editingItem.location.lng }
          : null
      );
      setTargetDate(editingItem.targetDate || '');
    } else {
      setTitle(''); setNote(''); setEmoji(EMOJIS[0]); setCategory(CATEGORIES[0]); setRegion('domestic');
      setLocName(''); setPickedLoc(null); setTargetDate('');
    }
  }, [visible, editingItem]);

  // 지역(국내/해외)을 바꾸면 이전에 찍어둔 지도 핀은 다른 대륙 위치라 의미가 없어져 초기화합니다.
  const onChangeRegion = (r: Region) => { setRegion(r); setPickedLoc(null); };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(), emoji, note: note.trim(), category,
        location: locName.trim()
          ? { name: locName.trim(), region, ...(pickedLoc ? { lat: pickedLoc.lat, lng: pickedLoc.lng } : {}) }
          : null,
        targetDate: isValidDate(targetDate.trim()) ? targetDate.trim() : null,
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
      <RegionToggle value={region} onChange={onChangeRegion} />
      <View style={{ marginTop: 10 }}>
        <Field value={locName} onChangeText={setLocName} placeholder="장소 이름 (예: 제주 애월, 파리 에펠탑)" maxLength={60} />
      </View>
      <View style={styles.mapRow}>
        <Pressable onPress={() => setMapOpen(true)} style={styles.mapPickBtn}>
          <Text style={styles.mapPickText}>{pickedLoc ? '📍 지도에서 다시 고르기' : '🗺 지도에서 고르기'}</Text>
        </Pressable>
        {pickedLoc ? (
          <>
            <LocationPreview lat={pickedLoc.lat} lng={pickedLoc.lng} size={44} />
            <Pressable onPress={() => setPickedLoc(null)} hitSlop={8}>
              <Text style={styles.mapClear}>✕</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <LocationMapPicker
        visible={mapOpen}
        region={region}
        initial={pickedLoc}
        onClose={() => setMapOpen(false)}
        onPick={setPickedLoc}
      />

      <FieldLabel>목표일 (선택)</FieldLabel>
      <View style={styles.presetRow}>
        <Preset label="1개월 뒤" onPress={() => setTargetDate(monthsAhead(1))} />
        <Preset label="3개월 뒤" onPress={() => setTargetDate(monthsAhead(3))} />
        <Preset label="올해 안" onPress={() => setTargetDate(endOfYear())} />
        {targetDate ? <Preset label="지우기" onPress={() => setTargetDate('')} /> : null}
      </View>
      <View style={{ marginTop: 10 }}>
        <Field
          value={targetDate}
          onChangeText={setTargetDate}
          placeholder="YYYY-MM-DD (예: 2026-12-31)"
          maxLength={10}
          keyboardType="numbers-and-punctuation"
        />
      </View>
      <Text style={styles.hint}>
        {targetDate && !isValidDate(targetDate.trim())
          ? '날짜 형식이 올바르지 않아요. YYYY-MM-DD 로 적어주세요.'
          : '목표일을 정하면 하루 전 오전 9시에 이 기기가 알려줘요.'}
      </Text>

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

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.preset}>
      <Text style={styles.presetText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  presetRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  preset: { borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13 },
  presetText: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
  hint: { fontSize: 11.5, color: colors.ink3, marginTop: 8, lineHeight: 17 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  mapPickBtn: {
    borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface2, borderRadius: radius.sm,
    paddingVertical: 9, paddingHorizontal: 13, flexShrink: 1,
  },
  mapPickText: { fontSize: 12.5, fontWeight: '600', color: colors.accentInk },
  mapClear: { fontSize: 13, color: colors.ink3, paddingHorizontal: 2 },
});
