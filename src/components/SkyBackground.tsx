import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

const STAR_GLYPHS = ['✦', '·', '✧', '⋆'];
const STAR_COLORS = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#F4A9C6', '#9FE0CE', '#C3B5F0', '#FFE29A', '#A9DCF0'];

// 시드 기반 의사난수 (컴포넌트 리렌더링에도 별 위치가 흔들리지 않도록)
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function SkyBackground({ children }: { children?: React.ReactNode }) {
  const { width, height } = Dimensions.get('window');
  const stars = useMemo(() => {
    const rand = mulberry32(42);
    const count = Math.floor((width * height) / 9000);
    return Array.from({ length: count }, () => ({
      left: rand() * width,
      top: rand() * height,
      glyph: STAR_GLYPHS[Math.floor(rand() * STAR_GLYPHS.length)],
      color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)],
      size: 6 + rand() * 10,
      opacity: 0.35 + rand() * 0.5,
    }));
  }, [width, height]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.bgTop, '#6EA3DC', '#83B2E4', '#9CC4EC', colors.bgBottom]}
        locations={[0, 0.22, 0.48, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {stars.map((s, i) => (
          <Text
            key={i}
            style={{ position: 'absolute', left: s.left, top: s.top, fontSize: s.size, color: s.color, opacity: s.opacity }}
          >
            {s.glyph}
          </Text>
        ))}
      </View>
      {/* 뭉실한 구름 (반투명 원형 블롭) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {CLOUD_SPOTS.map((c, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${c.x}%`, top: `${c.y}%`,
              width: c.w, height: c.h, borderRadius: c.h / 2,
              backgroundColor: 'rgba(255,255,255,1)', opacity: c.a,
            }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const CLOUD_SPOTS = [
  { x: 62, y: 6, w: 220, h: 70, a: 0.5 },
  { x: 8, y: 12, w: 260, h: 80, a: 0.32 },
  { x: 75, y: 26, w: 180, h: 60, a: 0.28 },
  { x: 18, y: 46, w: 260, h: 80, a: 0.22 },
  { x: 2, y: 62, w: 200, h: 65, a: 0.28 },
  { x: 55, y: 82, w: 260, h: 85, a: 0.42 },
];
