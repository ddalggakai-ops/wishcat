import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ScreenHeader } from '../components/Basics';
import { colors, shadow } from '../theme';
import { resolveImageUrl } from '../api/client';
import { useMyItems } from '../context/AppContext';
import type { Item } from '../api/types';

export default function MemoriesScreen({ onOpenViewer }: { onOpenViewer: (item: Item) => void }) {
  const mine = useMyItems();
  const mems = mine.filter((i) => i.done && i.memory);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      <ScreenHeader title="추억" subtitle="내가 이룬 순간들" />
      {mems.length === 0 ? (
        <EmptyState icon="sparkles-outline" title="아직 추억이 없어요" subtitle="꿈을 이루고 사진과 기록을 남겨보세요" />
      ) : (
        <View style={styles.grid}>
          {mems.map((i) => {
            const photo = resolveImageUrl(i.memory?.photo);
            return (
              <Pressable key={i.id} onPress={() => onOpenViewer(i)} style={styles.card}>
                {photo ? <Image source={{ uri: photo }} style={styles.img} /> : (
                  <View style={[styles.img, styles.ph]}><Text style={{ fontSize: 30 }}>{i.emoji}</Text></View>
                )}
                <View style={styles.info}>
                  <Text numberOfLines={1} style={styles.title}>{i.title}</Text>
                  <Text style={styles.date}>{i.memory?.date}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 4 },
  card: { width: '47.6%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden', ...shadow.sm },
  img: { width: '100%', aspectRatio: 1 },
  ph: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  info: { padding: 10 },
  title: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  date: { fontSize: 11, color: colors.ink3, marginTop: 4 },
});
