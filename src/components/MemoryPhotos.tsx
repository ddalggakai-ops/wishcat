import React, { useState } from 'react';
import { Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, Role } from '../theme';

/**
 * 추억 사진 여러 장을 옆으로 넘겨보는 캐로셀. 사진이 없으면 카테고리 그라디언트 + 이모지로,
 * 한 장이면 그냥 그 한 장으로, 여러 장이면 옆으로 스와이프하며 볼 수 있게 하고 아래 점으로 몇 번째인지 보여줍니다.
 */
export default function MemoryPhotoCarousel({
  photos, height, emoji, role, style,
}: {
  photos: string[];
  height: number;
  emoji: string;
  role: Role;
  style?: any;
}) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(p);
  };

  if (photos.length === 0) {
    return (
      <LinearGradient
        colors={gradients[role]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ width: '100%', height, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        <Text style={{ fontSize: Math.round(height * 0.24) }}>{emoji}</Text>
      </LinearGradient>
    );
  }

  if (photos.length === 1) {
    return <Image source={{ uri: photos[0] }} style={[{ width: '100%', height }, style]} />;
  }

  return (
    <View style={[{ width: '100%', height }, style]} onLayout={onLayout}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          {photos.map((uri, idx) => (
            <Image key={`${uri}-${idx}`} source={{ uri }} style={{ width, height }} />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.dots} pointerEvents="none">
        {photos.map((_, idx) => (
          <View key={idx} style={[styles.dot, idx === page && styles.dotOn]} />
        ))}
      </View>
      <View style={styles.countBadge} pointerEvents="none">
        <Text style={styles.countBadgeText}>{page + 1}/{photos.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 9, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 5.5, height: 5.5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.55)' },
  dotOn: { backgroundColor: '#fff', width: 15 },
  countBadge: { position: 'absolute', top: 9, right: 9, backgroundColor: 'rgba(0,0,0,.45)', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 8 },
  countBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
});
