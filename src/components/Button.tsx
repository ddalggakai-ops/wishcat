import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

type Variant = 'primary' | 'ghost' | 'line' | 'gift';

const VARIANT_BG: Record<Variant, string> = {
  primary: colors.accent,
  ghost: colors.surface2,
  line: colors.surface,
  gift: colors.giftWash,
};
const VARIANT_INK: Record<Variant, string> = {
  primary: '#fff',
  ghost: colors.ink,
  line: colors.ink,
  gift: colors.gift,
};
const VARIANT_SHADOW: Record<Variant, string | null> = {
  primary: colors.accentInk,
  ghost: null,
  line: null,
  gift: 'rgba(217,140,176,.45)',
};

export default function BubbleButton({
  title, onPress, variant = 'primary', disabled, loading, full, small, icon, style, textColor, shadowColor: shadowOverride,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  small?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textColor?: string;
  shadowColor?: string | null;
}) {
  const bg = disabled ? colors.surface3 : VARIANT_BG[variant];
  const ink = disabled ? colors.ink3 : (textColor || VARIANT_INK[variant]);
  const shadowColor = disabled ? null : (shadowOverride !== undefined ? shadowOverride : VARIANT_SHADOW[variant]);
  const isOutlined = variant === 'line';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        full && { width: '100%' },
        small && { paddingVertical: 9, paddingHorizontal: 14 },
        { backgroundColor: bg, borderColor: isOutlined ? colors.line2 : 'transparent', borderWidth: isOutlined ? 1 : 0 },
        shadowColor ? { borderBottomWidth: 3, borderBottomColor: shadowColor } : null,
        pressed && shadowColor ? { transform: [{ translateY: 2 }], borderBottomWidth: 1 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: ink }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.md,
  },
  text: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
});
