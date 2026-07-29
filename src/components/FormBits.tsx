import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { CATEGORIES, catColor, colors, radius } from '../theme';

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({
  value, onChangeText, placeholder, maxLength, multiline,
  secure, keyboardType, autoCapitalize, autoComplete, textContentType, autoCorrect, onSubmitEditing, returnKeyType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  /** 비밀번호 입력. 마스킹 + 👁 눈 버튼으로 잠깐 보기 */
  secure?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCorrect?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
}) {
  const [reveal, setReveal] = React.useState(false);
  const input = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      maxLength={maxLength}
      multiline={multiline}
      secureTextEntry={!!secure && !reveal}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      textContentType={textContentType}
      autoCorrect={autoCorrect}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType}
      style={secure ? styles.inputBare : [styles.input, multiline && styles.textarea]}
    />
  );
  if (!secure) return input;
  return (
    <View style={styles.secureRow}>
      {input}
      <Pressable
        onPress={() => setReveal((r) => !r)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={reveal ? '비밀번호 가리기' : '비밀번호 보기'}
      >
        <Text style={styles.revealBtn}>{reveal ? '🙈' : '👁'}</Text>
      </Pressable>
    </View>
  );
}

/** 카테고리 여러 개를 고를 수 있어요 — 눌러서 켜고 끄기(다중선택) */
export function CategoryPicker({ value, onChange }: { value: string[]; onChange: (c: string[]) => void }) {
  const toggle = (c: string) => {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  };
  return (
    <View style={styles.wrapRow}>
      {CATEGORIES.map((c) => {
        const sel = value.includes(c);
        const cc = catColor(c);
        return (
          <Pressable
            key={c}
            onPress={() => toggle(c)}
            style={[styles.catPickBtn, { backgroundColor: sel ? colors.accent : cc.bg }]}
          >
            <Text style={{ color: sel ? '#fff' : cc.ink, fontSize: 13, fontWeight: '600' }}>{sel ? '✓ ' : ''}{c}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 우선순위 상/중/하 선택 */
export function PriorityPicker({ value, onChange }: { value: 'high' | 'mid' | 'low' | null; onChange: (p: 'high' | 'mid' | 'low' | null) => void }) {
  const OPTIONS: { key: 'high' | 'mid' | 'low'; label: string }[] = [
    { key: 'high', label: '🔴 상' },
    { key: 'mid', label: '🟡 중' },
    { key: 'low', label: '⚪ 하' },
  ];
  return (
    <View style={styles.wrapRow}>
      {OPTIONS.map((o) => {
        const sel = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(sel ? null : o.key)}
            style={[styles.catPickBtn, { backgroundColor: sel ? colors.accent : colors.surface2, borderWidth: sel ? 0 : 1, borderColor: colors.line2 }]}
          >
            <Text style={{ color: sel ? '#fff' : colors.ink2, fontSize: 13, fontWeight: '600' }}>{o.label}</Text>
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
  inputBare: { flex: 1, fontSize: 15, color: colors.ink, padding: 0 },
  secureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.line2, borderRadius: radius.sm,
    paddingVertical: 13, paddingHorizontal: 14, backgroundColor: colors.surface,
  },
  revealBtn: { fontSize: 16 },
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
