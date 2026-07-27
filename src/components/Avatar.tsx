import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colorFor } from '../theme';

export default function Avatar({ name, size = 40, dashed, style }: { name: string; size?: number; dashed?: boolean; style?: ViewStyle }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: colorFor(name || ''),
          alignItems: 'center', justifyContent: 'center',
          borderWidth: dashed ? 3 : 0,
          borderColor: '#B49CF2',
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: '#2A3A57' }}>{initial}</Text>
    </View>
  );
}
