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

const WEEKLY_ID = 'wishcat-weekly-nudge';

/**
 * 주간 넛지 — 일요일 오전 10시에 "아직 이루지 못한 꿈이 N개 있어요" 하고 한 번 불러 줍니다.
 *
 * 이걸 넣기 전까지 이 앱에서 사용자를 다시 부르는 수단은 '목표일 하루 전 알림' 하나뿐이었는데,
 * 그건 목표일을 직접 넣은 항목에만 걸립니다. 시작 템플릿·엑셀·추천글로 담은 항목엔 목표일이
 * 없어서, 그렇게 시작한 사람에게는 알림이 구조적으로 0건이었어요.
 *
 * 서버(Cloud Functions)가 없어서 "친구가 내 꿈에 함께하기를 눌렀다" 같은 소셜 푸시는 아직
 * 만들 수 없지만, 기기 안에서 도는 이 정도는 지금 구조로도 됩니다.
 */
export async function scheduleWeeklyNudge(todoCount: number): Promise<void> {
  const N = load();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
    if (todoCount <= 0) return; // 도전 중인 게 없으면 굳이 부르지 않습니다
    // 권한을 새로 요청하지는 않습니다 — 이미 허락한 사람에게만 겁니다.
    const cur = await N.getPermissionsAsync();
    if (!cur.granted) return;
    await N.scheduleNotificationAsync({
      identifier: WEEKLY_ID,
      content: {
        title: '이번 주엔 하나만 시작해볼까요 ✦',
        body: `아직 이루지 못한 꿈이 ${todoCount}개 있어요.`,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 10, minute: 0 },
    });
  } catch {
    /* 알림은 부가 기능이라 실패해도 앱 흐름을 막지 않습니다 */
  }
}

/** 이미 알림을 허락했는지만 조용히 확인합니다(팝업을 띄우지 않아요). */
export async function hasPermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  try {
    return !!(await N.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** OS 권한 팝업을 아직 한 번도 띄운 적이 없는지 (사전 안내를 보여줄지 판단용) */
export async function canAskPermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  try {
    const cur = await N.getPermissionsAsync();
    return !cur.granted && cur.canAskAgain !== false;
  } catch {
    return false;
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
