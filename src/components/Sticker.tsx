import React from 'react';
import { Text, ViewStyle } from 'react-native';
import { colors } from '../theme';

// 카드 모서리에 살짝 얹는 별 스티커 (핀터레스트 키치 포인트)
export function StarSticker({ style, size = 26, rotate = '12deg' }: { style?: ViewStyle; size?: number; rotate?: string }) {
  return (
    <Text style={[{ position: 'absolute', fontSize: size, color: colors.candyYellow, transform: [{ rotate }] }, style as any]}>
      ✦
    </Text>
  );
}
