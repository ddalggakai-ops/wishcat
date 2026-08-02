import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { catColor, colors, PRIORITY_META, radius } from '../theme';
import { lonLatToTile, tileUrl } from '../utils/geo';
import type { Location, Priority } from '../api/types';

/** 위경도로 찍은 위치를 작은 지도 썸네일 한 장으로 보여줍니다. (API 키 없이 OSM 타일 사용) */
export function LocationPreview({ lat, lng, size = 22 }: { lat: number; lng: number; size?: number }) {
  const zoom = size >= 40 ? 14 : 12;
  const t = lonLatToTile(lng, lat, zoom);
  const tx = Math.floor(t.x);
  const ty = Math.floor(t.y);
  return (
    <Image
      source={{ uri: tileUrl(tx, ty, zoom) }}
      style={{ width: size, height: size, borderRadius: size >= 40 ? radius.sm : 6, backgroundColor: colors.surface3 }}
      resizeMode="cover"
    />
  );
}

export function CategoryChip({ category }: { category: string }) {
  const c = catColor(category);
  return (
    <View style={[styles.catChip, { backgroundColor: c.bg }]}>
      <Text style={[styles.catChipText, { color: c.ink }]}>{category}</Text>
    </View>
  );
}

/** 카테고리 여러 개를 한 줄에 칩으로 나열 */
export function CategoryChips({ categories }: { categories: string[] | null | undefined }) {
  if (!categories || !categories.length) return null;
  return (
    <>
      {categories.map((c) => <CategoryChip key={c} category={c} />)}
    </>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | null | undefined }) {
  if (!priority) return null;
  const m = PRIORITY_META[priority];
  return (
    <View style={[styles.prioChip, { backgroundColor: m.bg }]}>
      <View style={[styles.prioDot, { backgroundColor: m.dot }]} />
      <Text style={[styles.prioText, { color: m.ink }]}>우선순위 {m.label}</Text>
    </View>
  );
}

export function LocationChip({ location }: { location: Location }) {
  const onPress = () => openMap(location);
  const hasPin = location.lat != null && location.lng != null;
  return (
    <Pressable onPress={onPress} style={styles.locChip} accessibilityRole="button" accessibilityLabel={`${location.name} 지도에서 열기`}>
      {hasPin ? (
        <LocationPreview lat={location.lat as number} lng={location.lng as number} size={20} />
      ) : (
        <Icon name="location-outline" size={14} color={colors.ink3} />
      )}
      <Text style={styles.locChipText}>{location.name}</Text>
      <View style={styles.mapKind}>
        <Text style={styles.mapKindText}>{location.region === 'overseas' ? '구글맵' : '네이버'}</Text>
      </View>
    </Pressable>
  );
}

export async function openMap(location: Location) {
  const q = encodeURIComponent(location.name);
  if (location.region === 'overseas') {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  } else {
    const app = `nmap://search?query=${q}&appname=com.wishcat.app`;
    const web = `https://map.naver.com/p/search/${q}`;
    try {
      const can = await Linking.canOpenURL(app);
      if (can) Linking.openURL(app).catch(() => Linking.openURL(web));
      else Linking.openURL(web);
    } catch {
      Linking.openURL(web).catch(() => {});
    }
  }
}

export function Tag({ label, tone }: { label: string; tone: 'shared' | 'joined' | 'helped' | 'hot' }) {
  const map: Record<string, { bg: string; ink: string }> = {
    shared: { bg: colors.surface2, ink: colors.ink2 },
    joined: { bg: colors.infoWash, ink: colors.info },
    helped: { bg: colors.giftWash, ink: colors.gift },
    hot: { bg: colors.candyPink, ink: '#fff' },
  };
  const c = map[tone];
  return (
    <View style={[styles.tag, { backgroundColor: c.bg }]}>
      <Text style={[styles.tagText, { color: c.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  catChip: {
    borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10,
  },
  catChipText: { fontSize: 11, fontWeight: '700' },
  locChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentWash,
    borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9,
  },
  locChipIcon: { fontSize: 11 },
  locChipText: { fontSize: 11.5, fontWeight: '600', color: colors.accentInk },
  mapKind: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 2 },
  mapKindText: { fontSize: 9.5, fontWeight: '700', color: '#fff' },
  tag: { borderRadius: 7, paddingVertical: 2.5, paddingHorizontal: 8 },
  tagText: { fontSize: 11, fontWeight: '700' },
  prioChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  prioDot: { width: 7, height: 7, borderRadius: 4 },
  prioText: { fontSize: 11, fontWeight: '700' },
});
