import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { absoluteFill, colors, radius, shadow } from '../theme';

export default function Sheet({
  visible, onClose, title, subtitle, children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20, maxHeight: '88%' }]}>
          <View style={styles.grab} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...absoluteFill, backgroundColor: 'rgba(28,27,24,.4)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 8, ...shadow.md },
  grab: { width: 38, height: 4, borderRadius: 99, backgroundColor: colors.line2, alignSelf: 'center', marginTop: 8, marginBottom: 18 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.ink2, marginBottom: 18, lineHeight: 19 },
});
