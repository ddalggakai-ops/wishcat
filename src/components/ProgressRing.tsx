import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { absoluteFill, onGradient } from '../theme';

/** 마이페이지 요약 카드용 원형 진행률 링 (react-native-svg 사용) */
export default function ProgressRing({
  size = 84,
  strokeWidth = 9,
  pct,
  // 이 링은 파스텔 그라디언트 카드 위에 얹힙니다. 흰 글씨는 그 위에서 대비가 2.3~3.8:1 뿐이라
  // 숫자·라벨을 같은 계열 딥톤으로 바꿨어요(트랙은 장식이라 흰색을 조금 더 진하게만 올렸습니다).
  trackColor = 'rgba(255,255,255,.42)',
  fillColor = onGradient.primary,
  textColor = onGradient.primary,
  label,
}: {
  size?: number;
  strokeWidth?: number;
  pct: number;
  trackColor?: string;
  fillColor?: string;
  textColor?: string;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[absoluteFill, styles.center]}>
        <Text style={[styles.pct, { color: textColor, fontSize: size * 0.23 }]}>{Math.round(clamped)}%</Text>
        {label ? <Text style={[styles.label, { color: textColor, fontSize: size * 0.1 }]}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pct: { fontWeight: '800' },
  // 예전엔 opacity 0.85로 라벨을 흐리게 했는데, 그만큼 대비도 같이 깎여서 지웠습니다.
  label: { marginTop: 1, fontWeight: '700' },
});
