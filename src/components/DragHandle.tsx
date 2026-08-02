import React, { useRef } from 'react';
import { PanResponder, View, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme';

// 순서 변경용 드래그 핸들. 새 네이티브 의존성 없이 RN 기본 PanResponder만 씁니다.
//
// 핵심: onStartShouldSetPanResponder를 true로 둬서, 이 핸들을 '누르는 순간' 제스처를 가로챕니다.
// 그래야 바깥 ScrollView가 세로 스크롤로 먼저 채가는 걸 막을 수 있어요(핸들 위에서만 드래그 시작).
//
// PanResponder는 한 번만 만들어지므로 콜백을 그대로 넣으면 첫 렌더 값에 묶입니다(stale). 최신
// 콜백을 ref로 들고 참조합니다.
export default function DragHandle({
  onStart, onMove, onEnd,
}: {
  onStart: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number) => void;
}) {
  const cbs = useRef({ onStart, onMove, onEnd });
  cbs.current = { onStart, onMove, onEnd };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => cbs.current.onStart(),
      onPanResponderMove: (_e, g) => cbs.current.onMove(g.dy),
      onPanResponderRelease: (_e, g) => cbs.current.onEnd(g.dy),
      onPanResponderTerminate: (_e, g) => cbs.current.onEnd(g.dy),
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      style={styles.handle}
      accessibilityRole="adjustable"
      accessibilityLabel="드래그해서 순서 변경"
    >
      <Icon name="reorder-three" size={20} color={colors.ink2} />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
});
