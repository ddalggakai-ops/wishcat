import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/**
 * 예전에는 하늘/구름/별 무드였지만, 승인된 "다이어리 파스텔" 디자인 시스템에서는
 * 전역 배경이 은은한 단색(Background #F8F7FC)입니다. 컴포넌트 이름과 {children} 시그니처는
 * 그대로 유지해서, 이 컴포넌트를 쓰는 5개 화면(AuthScreen/HomeShell/OnboardingScreen/
 * ErrorScreen/DiagnosticsScreen)을 하나도 건드리지 않고 배경만 새 톤으로 바꿨습니다.
 */
export default function SkyBackground({ children }: { children?: React.ReactNode }) {
  return <View style={[StyleSheet.absoluteFill, styles.bg]}>{children}</View>;
}

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.bg },
});
