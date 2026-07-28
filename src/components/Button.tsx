import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, shadowColors, radius, type Role } from '../theme';

export type Variant = 'primary' | 'ghost' | 'line' | 'gift';

// primary/gift는 새 디자인 시스템의 그라디언트 필로 채우고, ghost/line은 플랫하게 유지합니다.
const GRADIENT_ROLE: Partial<Record<Variant, Role>> = {
  primary: 'primary',
  gift: 'accent',
};

export default function BubbleButton({
  title, onPress, variant = 'primary', disabled, loading, full, small, icon, style, textColor, shadowColor,
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
  const role = GRADIENT_ROLE[variant];
  const isGradient = !!role && !disabled;

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={isGradient ? '#fff' : colors.accentInk} size="small" />
      ) : (
        <>
          {icon}
          <Text
            numberOfLines={1}
            style={[
              styles.text,
              small && styles.textSmall,
              { color: disabled ? colors.ink3 : (textColor || (isGradient ? '#FFFFFF' : variant === 'line' ? colors.ink2 : colors.accentInk)) },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const sizeStyle = small ? styles.small : styles.regular;

  if (isGradient) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          full && styles.full,
          {
            shadowColor: shadowColor || shadowColors[role!],
            shadowOpacity: pressed ? 0.5 : 1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 7 },
            elevation: 4,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={gradients[role!]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientFill, sizeStyle]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        variant === 'ghost' ? styles.ghost : styles.line,
        full && styles.full,
        disabled && styles.disabled,
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, overflow: 'hidden' },
  full: { alignSelf: 'stretch', width: '100%' },
  gradientFill: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  regular: { paddingVertical: 13, paddingHorizontal: 20 },
  small: { paddingVertical: 9, paddingHorizontal: 15 },
  ghost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  line: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accentWash, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6, backgroundColor: colors.surface3 },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  text: { fontSize: 14.5, fontWeight: '700' },
  textSmall: { fontSize: 13 },
});
