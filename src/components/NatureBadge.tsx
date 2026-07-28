import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * 로그인 화면 배지 아이콘 — 고양이 로고 대신 프로젝트 초기 컨셉이었던
 * 노을/산 손그림 느낌의 자연 일러스트 미니 씬으로 대체.
 */
export default function NatureBadge({ size = 74 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.35 }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFD68A" />
            <Stop offset="0.55" stopColor="#FDB9A6" />
            <Stop offset="1" stopColor="#FC9D8E" />
          </LinearGradient>
          <RadialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFF4DC" />
            <Stop offset="1" stopColor="#FDC54F" />
          </RadialGradient>
          <LinearGradient id="mtnFar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#96A6EE" />
            <Stop offset="1" stopColor="#7178E5" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#sky)" />
        <Circle cx="63" cy="30" r="13" fill="url(#sun)" />
        <Path d="M -5 62 L 20 40 L 40 58 L 58 34 L 78 55 L 105 45 L 105 105 L -5 105 Z" fill="url(#mtnFar)" opacity={0.55} />
        <Path d="M -5 78 L 24 52 L 46 72 L 66 48 L 90 68 L 105 60 L 105 105 L -5 105 Z" fill="#5B62D6" />
        <Path d="M 20 66 L 26 78 L 14 78 Z" fill="#2E2A3D" opacity={0.55} />
        <Path d="M 74 70 L 80 82 L 68 82 Z" fill="#2E2A3D" opacity={0.55} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
