import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../theme';
import { REGION_DEFAULT_CENTER, lonLatToTile, tileToLonLat, tileUrl } from '../utils/geo';
import type { Region } from '../api/types';

// 지도 API 키(구글맵/네이버맵)가 없어도 되도록 OpenStreetMap 표준 타일을 직접 그려서
// "지도를 움직여 가운데 핀 위치를 고르는" 방식의 가벼운 위치 선택기입니다.
// react-native-maps 같은 네이티브 모듈을 쓰지 않아 웹 빌드(검증용)에서도 그대로 렌더됩니다.
// 단, 실제 타일 이미지가 뜨는지는 네트워크가 열린 실기기/에뮬레이터에서만 확인할 수 있어요.

const DISPLAY_TILE = 90; // 화면에 그리는 타일 한 칸의 픽셀 크기
const BOX = 270; // 지도 미리보기 박스 한 변 (DISPLAY_TILE의 3배 이상 — 드래그해도 빈틈 없이 덮도록)
const RING = 2; // 중심 타일 기준 사방으로 몇 칸씩 더 그릴지
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;

export interface PickedLocation {
  lat: number;
  lng: number;
}

export default function LocationMapPicker({
  visible, region, initial, onClose, onPick,
}: {
  visible: boolean;
  region: Region;
  initial?: PickedLocation | null;
  onClose: () => void;
  onPick: (loc: PickedLocation) => void;
}) {
  function startPos() {
    if (initial) {
      const t = lonLatToTile(initial.lng, initial.lat, 14);
      return { x: t.x, y: t.y, zoom: 14 };
    }
    const d = REGION_DEFAULT_CENTER[region];
    const t = lonLatToTile(d.lon, d.lat, d.zoom);
    return { x: t.x, y: t.y, zoom: d.zoom };
  }

  const [center, setCenter] = useState(startPos);
  const dragStart = useRef(center);

  // 시트를 새로 열 때마다(=visible이 true가 될 때마다) 시작 위치로 리셋합니다.
  useEffect(() => {
    if (!visible) return;
    const pos = startPos();
    dragStart.current = pos;
    setCenter(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => { dragStart.current = center; },
      onPanResponderMove: (_e, g) => {
        setCenter({
          x: dragStart.current.x - g.dx / DISPLAY_TILE,
          y: dragStart.current.y - g.dy / DISPLAY_TILE,
          zoom: dragStart.current.zoom,
        });
      },
    })
  ).current;

  const rezoom = (delta: number) => {
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, center.zoom + delta));
    if (nz === center.zoom) return;
    const { lon, lat } = tileToLonLat(center.x, center.y, center.zoom);
    const t = lonLatToTile(lon, lat, nz);
    setCenter({ x: t.x, y: t.y, zoom: nz });
  };

  const bx = Math.floor(center.x);
  const by = Math.floor(center.y);
  const tiles: { key: string; tx: number; ty: number; left: number; top: number }[] = [];
  for (let ty = by - RING; ty <= by + RING; ty++) {
    for (let tx = bx - RING; tx <= bx + RING; tx++) {
      tiles.push({
        key: `${tx}_${ty}`,
        tx, ty,
        left: (tx - center.x) * DISPLAY_TILE + BOX / 2,
        top: (ty - center.y) * DISPLAY_TILE + BOX / 2,
      });
    }
  }

  const confirm = () => {
    const { lon, lat } = tileToLonLat(center.x, center.y, center.zoom);
    onPick({ lat, lng: lon });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.grab} />
          <Text style={styles.title}>지도에서 위치 고르기</Text>
          <Text style={styles.subtitle}>지도를 움직여서 가운데 핀을 원하는 곳에 놓아주세요.</Text>

          <View style={styles.mapBox} {...panResponder.panHandlers}>
            {tiles.map((t) => (
              <Image
                key={t.key}
                source={{ uri: tileUrl(t.tx, t.ty, center.zoom) }}
                style={[styles.tile, { left: t.left, top: t.top }]}
                resizeMode="cover"
              />
            ))}
            <View style={styles.pinWrap} pointerEvents="none">
              <Text style={styles.pin}>📍</Text>
            </View>
          </View>

          <View style={styles.zoomRow}>
            <Pressable onPress={() => rezoom(-1)} style={styles.zoomBtn} disabled={center.zoom <= MIN_ZOOM}>
              <Text style={styles.zoomText}>−</Text>
            </Pressable>
            <Text style={styles.zoomLabel}>확대 · {center.zoom}</Text>
            <Pressable onPress={() => rezoom(1)} style={styles.zoomBtn} disabled={center.zoom >= MAX_ZOOM}>
              <Text style={styles.zoomText}>＋</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.actionBtn, styles.actionGhost]}>
              <Text style={[styles.actionText, { color: colors.ink2 }]}>취소</Text>
            </Pressable>
            <Pressable onPress={confirm} style={[styles.actionBtn, styles.actionPrimary]}>
              <Text style={[styles.actionText, { color: '#fff' }]}>이 위치로 선택</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,27,24,.4)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 8, paddingBottom: 26, ...shadow.md,
  },
  grab: { width: 38, height: 4, borderRadius: 99, backgroundColor: colors.line2, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.ink2, marginBottom: 16, lineHeight: 19 },
  mapBox: {
    width: BOX, height: BOX, alignSelf: 'center', borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.line2, position: 'relative',
  },
  tile: { position: 'absolute', width: DISPLAY_TILE, height: DISPLAY_TILE },
  pinWrap: { position: 'absolute', left: BOX / 2 - 13, top: BOX / 2 - 26, alignItems: 'center' },
  pin: { fontSize: 26 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 14 },
  zoomBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line2,
  },
  zoomText: { fontSize: 18, fontWeight: '700', color: colors.ink2 },
  zoomLabel: { fontSize: 12.5, color: colors.ink2, fontWeight: '600', minWidth: 64, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  actionGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2 },
  actionPrimary: { backgroundColor: colors.accent },
  actionText: { fontSize: 14.5, fontWeight: '700' },
});
