import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, shadowColors, radius, type Role } from '../theme';

/**
 * 디자인 시스템의 "gcard" 패턴을 RN으로 옮긴 공용 컴포넌트.
 * - 135deg 대각선 그라디언트 (expo-linear-gradient는 CSS box-shadow의 radial glare를
 *   그대로 표현할 수 없어, 좌상단에 반투명 흰색 블롭으로 근사했습니다)
 * - role 색상 계열에 맞춘 컬러 그림자 (iOS만 색이 그대로 보이고, Android는 elevation이
 *   회색 음영만 지원하는 RN 공통 한계가 있어요)
 */
export default function GradientCard({
  role = 'primary',
  borderRadius = radius.xl,
  style,
  contentStyle,
  glare = true,
  children,
}: {
  role?: Role;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  glare?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        {
          borderRadius,
          shadowColor: shadowColors[role],
          shadowOpacity: 1,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradients[role]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius, overflow: 'hidden' }, contentStyle]}
      >
        {glare ? <View pointerEvents="none" style={styles.glare} /> : null}
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  glare: {
    position: 'absolute',
    top: '-18%',
    left: '-16%',
    width: '68%',
    height: '58%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
