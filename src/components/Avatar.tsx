import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colorFor } from '../theme';
import { resolveImageUrl } from '../api/client';

export default function Avatar({
  name, photoUrl, size = 40, style,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  style?: ViewStyle;
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const resolvedPhoto = resolveImageUrl(photoUrl);
  return (
    <View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: colorFor(name || ''),
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#0000000F',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {resolvedPhoto ? (
        <Image source={{ uri: resolvedPhoto }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: '#2A3A57' }}>{initial}</Text>
      )}
    </View>
  );
}
