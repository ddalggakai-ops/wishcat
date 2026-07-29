import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkyBackground from '../components/SkyBackground';
import BubbleButton from '../components/Button';
import { colors, gradients, shadowColors } from '../theme';

const STEPS = [
  { icon: '🚩', title: '위시캣에 오신 걸 환영해요', desc: '이루고 싶은 꿈을 적고, 친구와 함께 하나씩 지워가요.' },
  { icon: '👥', title: '혼자 말고, 같이', desc: '친구의 꿈에 "함께하기"를 누르면 내 목록에도 담겨요. 같이라서 끝까지 갈 수 있어요.' },
  { icon: '🎁', title: '친구의 꿈을 도와줘요', desc: '친구가 꿈을 이루도록 도우면, 그 순간이 내 기록으로도 남아요.' },
  { icon: '✨', title: '추억으로 남기고 공유해요', desc: '이룬 꿈은 별이 되어 쌓이고, 친구들에게 공유할 수 있어요.' },
];

export default function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <View style={[styles.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }]}>
        <Text style={styles.brand}>✦ 위시캣</Text>
        <BubbleButton title="건너뛰기" variant="ghost" small onPress={onFinish} style={styles.skip} />

        <View style={styles.main}>
          <View style={styles.iconWrap}>
            <Text style={{ fontSize: 46 }}>{s.icon}</Text>
          </View>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.desc}>{s.desc}</Text>
        </View>

        <View style={styles.foot}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => <View key={i} style={[styles.dot, i === step && styles.dotOn]} />)}
          </View>
          <BubbleButton
            title={isLast ? '시작하기 ✦' : '다음'}
            onPress={() => (isLast ? onFinish() : setStep(step + 1))}
            style={{ paddingHorizontal: 30 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 30 },
  brand: { position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: colors.ink, fontSize: 18, fontWeight: '700' },
  skip: { position: 'absolute', top: 16, right: 0, backgroundColor: 'transparent' },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 118, height: 118, borderRadius: 36, backgroundColor: colors.accentWash,
    borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', marginBottom: 36,
    shadowColor: shadowColors.primary, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 3,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, textAlign: 'center', marginBottom: 14 },
  desc: { fontSize: 15.5, color: colors.ink2, textAlign: 'center', lineHeight: 24, maxWidth: 300 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.line2 },
  dotOn: { width: 22, backgroundColor: colors.accent },
});
