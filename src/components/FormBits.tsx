import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORIES, catColor, colors, radius } from '../theme';

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({
  value, onChangeText, placeholder, maxLength, multiline,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      maxLength={maxLength}
      multiline={multiline}
      style={[styles.input, multiline && styles.textarea]}
    />
  );
}

export function CategoryPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.wrapRow}>
      {CATEGORIES.map((c) => {
        const sel = c === value;
        const cc = catColor(c);
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={[styles.catPickBtn, { backgroundColor: sel ? colors.accent : cc.bg }]}
          >
            <Text style={{ color: sel ? '#fff' : cc.ink, fontSize: 13, fontWeight: '600' }}>{c}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmojiPicker({ options, value, onChange }: { options: string[]; value: string; onChange: (e: string) => void }) {
  return (
    <View style={styles.wrapRow}>
      {options.map((e) => {
        const sel = e === value;
        return (
          <Pressable key={e} onPress={() => onChange(e)} style={[styles.emojiBtn, sel && styles.emojiBtnSel]}>
            <Text style={{ fontSize: 21 }}>{e}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RegionToggle({ value, onChange }: { value: 'domestic' | 'overseas'; onChange: (r: 'domestic' | 'overseas') => void }) {
  return (
    <View style={styles.seg2}>
      <Pressable onPress={() => onChange('domestic')} style={[styles.segBtn, value === 'domestic' && styles.segBtnOn]}>
        <Text style={[styles.segText, value === 'domestic' && styles.segTextOn]}>🇰🇷 국내 · 네이버</Text>
      </Pressable>
      <Pressable onPress={() => onChange('overseas')} style={[styles.segBtn, value === 'overseas' && styles.segBtnOn]}>
        <Text style={[styles.segText, value === 'overseas' && styles.segTextOn]}>🌏 해외 · 구글맵</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', color: colors.ink2, marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: colors.line2, borderRadius: radius.sm, paddingVertical: 13, paddingHorizontal: 14,
    fontSize: 15, color: colors.ink, backgroundColor: colors.surface,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  catPickBtn: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13 },
  emojiBtn: { width: 44, height: 44, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emojiBtnSel: { borderColor: colors.accent, backgroundColor: colors.accentWash },
  seg2: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  segBtnOn: { borderColor: 'transparent', backgroundColor: colors.accentWash },
  segText: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  segTextOn: { color: colors.accentInk },
});
