import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function Toast({ message }: { message: string | null }) {
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: 96 + insets.bottom }]}>
      <View style={styles.pill}><Text style={styles.text}>{message}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 200 },
  pill: { backgroundColor: colors.ink, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, maxWidth: '88%' },
  text: { color: '#fff', fontSize: 13.5, fontWeight: '500' },
});
