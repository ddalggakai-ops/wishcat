import { Platform } from 'react-native';

/**
 * 목표일 알림 — 기기 안에서만 도는 로컬 알림입니다.
 *
 * 친구가 내 꿈에 참여했을 때 오는 '소셜 푸시'는 서버(Cloud Functions)가 있어야 보낼 수 있어서
 * 지금 구조로는 만들 수 없습니다. 대신 스스로 정한 목표일이 다가오면 기기가 알려주도록 했습니다.
 *
 * expo-notifications 는 웹에서 동작하지 않으므로(그리고 웹 번들에 끌어들이면 export 가 깨지므로)
 * 네이티브에서만 지연 로딩합니다.
 */

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

function load(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

let permissionAsked = false;

export async function ensurePermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (permissionAsked && !current.canAskAgain) return false;
    permissionAsked = true;
    const asked = await N.requestPermissionsAsync();
    return !!asked.granted;
  } catch {
    return false;
  }
}

/** 'YYYY-MM-DD' 목표일의 전날 오전 9시 (이미 지났으면 null) */
function reminderDate(targetDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate);
  if (!m) return null;
  const when = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1, 9, 0, 0, 0);
  if (when.getTime() <= Date.now() + 60_000) return null;
  return when;
}

/** 이 꿈에 걸려 있던 알림을 지우고, 목표일이 있으면 새로 예약합니다. */
export async function syncReminder(itemId: string, title: string, targetDate: string | null): Promise<void> {
  const N = load();
  if (!N) return;
  try {
    await cancelReminder(itemId);
    if (!targetDate) return;
    const when = reminderDate(targetDate);
    if (!when) return;
    if (!(await ensurePermission())) return;
    await N.scheduleNotificationAsync({
      identifier: `wishcat-item-${itemId}`,
      content: {
        title: '내일이 목표일이에요 ✦',
        body: `"${title}" — 오늘 한 발짝만 나아가 볼까요?`,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when },
    });
  } catch {
    // 알림은 부가 기능이라 실패해도 앱 흐름을 막지 않습니다.
  }
}

export async function cancelReminder(itemId: string): Promise<void> {
  const N = load();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(`wishcat-item-${itemId}`);
  } catch {
    /* 예약된 게 없으면 그냥 넘어갑니다 */
  }
}

export async function cancelAllReminders(): Promise<void> {
  const N = load();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    /* noop */
  }
}
