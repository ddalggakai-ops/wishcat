import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { absoluteFill } from '../theme';

/** 마이페이지 요약 카드용 원형 진행률 링 (react-native-svg 사용) */
export default function ProgressRing({
  size = 84,
  strokeWidth = 9,
  pct,
  trackColor = 'rgba(255,255,255,.32)',
  fillColor = '#FFFFFF',
  textColor = '#FFFFFF',
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
  label: { opacity: 0.85, marginTop: 1, fontWeight: '600' },
});
