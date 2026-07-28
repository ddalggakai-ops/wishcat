import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore/lite';
import SkyBackground from '../components/SkyBackground';
import BubbleButton from '../components/Button';
import { colors } from '../theme';
import {
  auth,
  db,
  firebaseConfigured,
  firebaseDatabaseId,
  firebaseInitError,
  firebaseInitLog,
  firebaseProjectId,
} from '../firebase/config';
import { withTimeout } from '../services/withTimeout';

type Status = 'idle' | 'running' | 'ok' | 'fail';
interface Check {
  key: string;
  label: string;
  status: Status;
  note?: string;
}

const INITIAL: Check[] = [
  { key: 'config', label: 'Firebase 설정값 주입', status: 'idle' },
  { key: 'init', label: 'Firebase 초기화 (app / auth / firestore)', status: 'idle' },
  { key: 'net-auth', label: '인증 서버 연결 (identitytoolkit)', status: 'idle' },
  { key: 'net-fs', label: 'Firestore 서버 연결', status: 'idle' },
  { key: 'session', label: '로그인 세션', status: 'idle' },
  { key: 'read', label: 'Firestore 읽기 (내 프로필)', status: 'idle' },
  { key: 'write', label: 'Firestore 쓰기 (내 프로필)', status: 'idle' },
];

function describe(e: unknown) {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

/**
 * 폰에서 직접 돌려보는 자체 진단 화면.
 * 개발 컴퓨터 없이도 "어디까지 되고 어디서 막히는지"를 눈으로 확인할 수 있게 만들었습니다.
 */
export default function DiagnosticsScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [checks, setChecks] = useState<Check[]>(INITIAL);
  const [running, setRunning] = useState(false);

  const set = useCallback((key: string, status: Status, note?: string) => {
    setChecks((prev) => prev.map((c) => (c.key === key ? { ...c, status, note } : c)));
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setChecks(INITIAL.map((c) => ({ ...c, status: 'idle', note: undefined })));

    // 1) 설정값
    set('config', 'running');
    set(
      'config',
      firebaseConfigured ? 'ok' : 'fail',
      firebaseConfigured
        ? `projectId: ${firebaseProjectId}\n데이터베이스: ${firebaseDatabaseId}`
        : 'EXPO_PUBLIC_FIREBASE_* 값이 비어 있어요'
    );

    // 2) 초기화
    set('init', 'running');
    set('init', firebaseInitError ? 'fail' : 'ok', firebaseInitError || firebaseInitLog.join('\n'));

    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';

    // 3) 인증 서버에 HTTP로 닿는지 (응답 코드가 뭐든 "닿는다"는 건 확인됨)
    set('net-auth', 'running');
    try {
      const res = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${apiKey}`),
        '인증 서버 연결',
        12000
      );
      set('net-auth', 'ok', `HTTP ${res.status} 응답 받음`);
    } catch (e) {
      set('net-auth', 'fail', describe(e));
    }

    // 4) Firestore REST 엔드포인트에 닿는지
    set('net-fs', 'running');
    try {
      const dbSeg = encodeURIComponent(firebaseDatabaseId);
      const res = await withTimeout(
        fetch(
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${dbSeg}/documents/__diag__/__ping__?key=${apiKey}`
        ),
        'Firestore 서버 연결',
        12000
      );
      const bodyText = await res.text().catch(() => '');
      // 401/403/404 모두 "서버까지 도달"을 의미합니다 (권한/문서없음).
      // 단, "데이터베이스가 없다"는 응답만은 통과시키면 안 됩니다 — 진짜 원인이 여기 있으니까요.
      if (/does not exist for project/i.test(bodyText)) {
        set(
          'net-fs',
          'fail',
          `"${firebaseDatabaseId}" 데이터베이스가 이 프로젝트에 없어요.\n` +
            'Firebase 콘솔 > Firestore에서 같은 이름의 데이터베이스를 만들어주세요.\n' +
            `(HTTP ${res.status})`
        );
      } else {
        set('net-fs', 'ok', `HTTP ${res.status} 응답 받음 — db: ${firebaseDatabaseId}`);
      }
    } catch (e) {
      set('net-fs', 'fail', describe(e));
    }

    // 5) 로그인 세션
    set('session', 'running');
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      set('session', 'fail', '로그인되어 있지 않아요. 로그인 후 다시 진단하면 읽기/쓰기까지 확인할 수 있어요.');
      set('read', 'idle', '로그인이 필요해요');
      set('write', 'idle', '로그인이 필요해요');
      setRunning(false);
      return;
    }
    set('session', 'ok', `uid: ${uid}\n${auth.currentUser?.email || ''}`);

    // 6) 읽기
    set('read', 'running');
    let currentBio: string | undefined;
    try {
      const snap = await withTimeout(getDoc(doc(db, 'users', uid)), 'Firestore 읽기', 15000);
      if (snap.exists()) {
        const data = snap.data() as any;
        currentBio = typeof data?.bio === 'string' ? data.bio : '';
        set('read', 'ok', `users/${uid} 있음 — 이름: ${data?.name}`);
      } else {
        currentBio = '';
        set('read', 'ok', `users/${uid} 문서가 아직 없어요 (앱이 자동으로 만들어 줍니다)`);
      }
    } catch (e) {
      set('read', 'fail', describe(e));
      setRunning(false);
      return;
    }

    // 7) 쓰기 — bio를 지금 값 그대로 다시 저장하는 무해한 쓰기
    set('write', 'running');
    try {
      await withTimeout(updateDoc(doc(db, 'users', uid), { bio: currentBio ?? '' }), 'Firestore 쓰기', 15000);
      set('write', 'ok', '쓰기 성공 (bio를 같은 값으로 다시 저장)');
    } catch (e) {
      set('write', 'fail', describe(e));
    }

    setRunning(false);
  }, [set]);

  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.title}>🔧 연결 진단</Text>
        <Text style={styles.sub}>버튼을 누르면 Firebase 연결을 단계별로 확인해요.</Text>

        <View style={styles.card}>
          {checks.map((c) => (
            <View key={c.key} style={styles.row}>
              <Text style={styles.icon}>
                {c.status === 'ok' ? '✅' : c.status === 'fail' ? '❌' : c.status === 'running' ? '⏳' : '⬜️'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{c.label}</Text>
                {c.note ? <Text style={[styles.note, c.status === 'fail' && { color: colors.like }]}>{c.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 18, gap: 10 }}>
          <BubbleButton title={running ? '진단 중…' : '진단 시작'} onPress={run} loading={running} />
          <BubbleButton title="닫기" variant="line" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,.85)', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 14 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: { fontSize: 15, width: 22, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, lineHeight: 17, color: colors.ink2, marginTop: 3 },
});
