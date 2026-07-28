import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wishcat.pendingInvite';

/**
 * 초대 코드를 URL에서 뽑아냅니다. 두 가지 형태를 모두 받습니다.
 *  - wishcat://invite/<code>                     (앱이 이미 깔린 기기)
 *  - https://.../invite/?c=<code>                (누구나 열 수 있는 웹 링크)
 */
export function extractInviteCode(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams?.c;
    if (typeof q === 'string' && /^[a-zA-Z0-9_-]+$/.test(q)) return q;
    const match = parsed.path?.match(/invite\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 초대 코드를 로그인 전에도 붙잡아 둡니다.
 *
 * 예전 구현은 로그인한 뒤에야 링크를 듣기 시작했어요. 그래서 앱이 없던 친구가 초대 링크를 누르면
 * 설치 → 가입까지는 가는데, 정작 초대는 사라져서 아무도 친구가 되지 않았습니다.
 * 여기서는 저장소에 적어 두었다가 로그인 직후에 꺼내 씁니다(설치 중 앱이 죽어도 남아 있게).
 */
export function usePendingInvite() {
  const [code, setCode] = useState<string | null>(null);

  const remember = useCallback((next: string | null) => {
    if (!next) return;
    setCode(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const clear = useCallback(() => {
    setCode(null);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await AsyncStorage.getItem(KEY).catch(() => null);
      if (alive && stored) setCode(stored);
      const initial = await Linking.getInitialURL().catch(() => null);
      const fromUrl = extractInviteCode(initial);
      if (alive && fromUrl) remember(fromUrl);
    })();
    const sub = Linking.addEventListener('url', ({ url }) => {
      const next = extractInviteCode(url);
      if (next) remember(next);
    });
    return () => { alive = false; sub.remove(); };
  }, [remember]);

  return { code, clear };
}
