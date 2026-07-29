import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * 인스타그램처럼 UI 뼈대(검색·닫기·좋아요·저장·이동 같은 "기능" 아이콘)는 얇은 라인 아이콘으로,
 * 사용자가 직접 고르는 꿈 아이콘(이모지 피커)이나 축하 메시지 속 이모지는 그대로 이모지로 남겨뒀어요.
 * 이 컴포넌트는 전자(기능 아이콘)에만 씁니다.
 */
export default function Icon({
  name, size = 20, color = colors.ink, style,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
  style?: any;
}) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
