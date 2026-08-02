import React, { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkyBackground from '../components/SkyBackground';
import BubbleButton from '../components/Button';
import { createInvite } from '../services/friendsService';
import { inviteWebUrl } from '../config/links';
import { alertDialog } from '../utils/dialog';
import { useAuth } from '../context/AuthContext';
import { colors, shadowColors } from '../theme';

const STEPS = [
  { icon: '🚩', title: '위시캣에 오신 걸 환영해요', desc: '이루고 싶은 꿈을 적고, 친구와 함께 하나씩 지워가요.' },
  { icon: '👥', title: '혼자 말고, 같이', desc: '친구의 꿈에 "함께하기"를 누르면 내 목록에도 담겨요. 같이라서 끝까지 갈 수 있어요.' },
  { icon: '🎁', title: '친구의 꿈을 도와줘요', desc: '친구가 꿈을 이루도록 도우면, 그 순간이 내 기록으로도 남아요.' },
  { icon: '✨', title: '추억으로 남기고 공유해요', desc: '이룬 꿈은 별이 되어 쌓이고, 친구들에게 공유할 수 있어요.' },
];

// 소개 슬라이드 4장 + 마지막 '친구 초대' 단계 1장.
// 콜드 스타트(혼자 깔면 둘러보기가 텅 비어 금방 이탈)를 막기 위해, 가입 직후 여기서
// 친구를 짝으로 데려오도록 유도합니다. 받는 쪽은 링크→가입→자동 친구 흐름이 이미 있어요.
const INVITE_STEP = STEPS.length;
const TOTAL = STEPS.length + 1;

export default function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [linkBusy, setLinkBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onInvite = async () => {
    if (!user) return;
    setLinkBusy(true);
    try {
      const code = await createInvite(user.id);
      const link = inviteWebUrl(code);
      const message = `${user.name}님이 위시캣에 초대했어요 ✦\n같이 버킷리스트 채워요!\n${link}`;
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(link);
        await alertDialog('초대 링크를 복사했어요', '친구에게 붙여넣어 보내면, 그 친구가 가입하는 순간 서로 친구가 돼요.');
      } else {
        await Share.share({ message });
      }
      setSent(true);
    } catch {
      await alertDialog('초대 링크를 만들지 못했어요', '잠시 뒤 다시 시도하거나, 나중에 친구 탭에서 초대할 수 있어요.');
    } finally {
      setLinkBusy(false);
    }
  };

  const onInviteStep = step === INVITE_STEP;
  const s = onInviteStep ? null : STEPS[step];

  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <View style={[styles.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }]}>
        <Text style={styles.brand}>✦ 위시캣</Text>
        {!onInviteStep ? (
          <BubbleButton title="건너뛰기" variant="ghost" small onPress={onFinish} style={styles.skip} />
        ) : null}

        <View style={styles.main}>
          {onInviteStep ? (
            <>
              <View style={styles.iconWrap}>
                <Text style={{ fontSize: 46 }}>💌</Text>
              </View>
              <Text style={styles.title}>혼자보다 둘이 더 재밌어요</Text>
              <Text style={styles.desc}>
                친구를 초대하면 그 친구가 가입하는 순간 <Text style={{ fontWeight: '700', color: colors.accentInk }}>바로 서로 친구</Text>가 돼요.{'\n'}
                링크 하나면 충분해요. 같이 시작해봐요!
              </Text>
            </>
          ) : (
            <>
              <View style={styles.iconWrap}>
                <Text style={{ fontSize: 46 }}>{s!.icon}</Text>
              </View>
              <Text style={styles.title}>{s!.title}</Text>
              <Text style={styles.desc}>{s!.desc}</Text>
            </>
          )}
        </View>

        <View style={styles.foot}>
          <View style={styles.dots}>
            {Array.from({ length: TOTAL }).map((_, i) => <View key={i} style={[styles.dot, i === step && styles.dotOn]} />)}
          </View>
          {onInviteStep ? null : (
            <BubbleButton title="다음" onPress={() => setStep(step + 1)} style={{ paddingHorizontal: 30 }} />
          )}
        </View>

        {onInviteStep ? (
          <View style={styles.inviteActions}>
            <BubbleButton
              title={sent ? '✓ 초대를 보냈어요 · 다른 친구도 초대' : '💌 친구 초대 링크 보내기'}
              onPress={onInvite}
              loading={linkBusy}
              full
            />
            <BubbleButton
              title={sent ? '시작하기 ✦' : '혼자 먼저 시작할게요'}
              onPress={onFinish}
              variant={sent ? 'primary' : 'ghost'}
              full
              style={{ marginTop: 10 }}
            />
          </View>
        ) : null}
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
    alignItems: 'center', justifyContent: 'center', marginBottom: 36,
    shadowColor: shadowColors.primary, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 3,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, textAlign: 'center', marginBottom: 14 },
  desc: { fontSize: 15.5, color: colors.ink2, textAlign: 'center', lineHeight: 24, maxWidth: 300 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.line2 },
  dotOn: { width: 22, backgroundColor: colors.accent },
  inviteActions: { marginTop: 8 },
});
