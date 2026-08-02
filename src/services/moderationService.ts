import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { db } from '../firebase/config';
import { clearFriendsCache } from './friendsService';

// 사용자 제작 콘텐츠(UGC)를 다루는 앱은 스토어 심사에서 신고/차단 수단을 요구합니다.
// 서버(Cloud Functions)가 없으므로 신고는 reports 컬렉션에 적재만 하고
// (읽기는 보안 규칙으로 전면 차단, 운영자는 콘솔에서 확인),
// 차단은 blocks/{내uid}/blocked/{상대uid} 문서로 두고 클라이언트가 목록에서 걸러냅니다.

export type ReportTargetType = 'item' | 'user';

export async function submitReport(params: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string;
  reason: string;
}): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    reporterId: params.reporterId,
    targetType: params.targetType,
    targetId: params.targetId,
    targetOwnerId: params.targetOwnerId,
    reason: params.reason.slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

function blockDoc(uid: string, targetUid: string) {
  return doc(db, 'blocks', uid, 'blocked', targetUid);
}

const blockCache = new Map<string, Set<string>>();

export async function getBlockedIds(uid: string, force = false): Promise<Set<string>> {
  if (!force) {
    const hit = blockCache.get(uid);
    if (hit) return hit;
  }
  const set = new Set<string>();
  try {
    const snap = await getDocs(collection(db, 'blocks', uid, 'blocked'));
    snap.forEach((d) => set.add(d.id));
    // 성공했을 때만 캐시합니다.
    blockCache.set(uid, set);
  } catch {
    // 목록을 못 읽었는데 "차단 없음"으로 캐시해 버리면, 한 번 실패한 뒤로 그 세션 내내 차단이
    // 무효가 됐어요(껐다 켜야 복구). 실패한 결과는 저장하지 않고 다음에 다시 시도하게 둡니다.
  }
  return set;
}

export async function blockUser(uid: string, targetUid: string): Promise<void> {
  if (uid === targetUid) throw new Error('자기 자신은 차단할 수 없어요');
  await setDoc(blockDoc(uid, targetUid), { createdAt: serverTimestamp() });
  // 차단하면 친구 관계도 끊습니다. 안 그러면 친구 기반 읽기 권한이 남아, 차단한 상대가
  // 내 비공개 목록·추억 사진을 API로 계속 볼 수 있어요(차단이 화면 가리기에 그치지 않도록).
  // 친구가 아니었으면 문서가 없어 삭제가 거부될 수 있으니 조용히 무시합니다.
  await Promise.all([
    deleteDoc(doc(db, 'friendships', `${uid}_${targetUid}`)).catch(() => {}),
    deleteDoc(doc(db, 'friendships', `${targetUid}_${uid}`)).catch(() => {}),
  ]);
  clearFriendsCache();
  (await getBlockedIds(uid)).add(targetUid);
}

export async function unblockUser(uid: string, targetUid: string): Promise<void> {
  await deleteDoc(blockDoc(uid, targetUid));
  (await getBlockedIds(uid)).delete(targetUid);
}

export function clearBlockCache() {
  blockCache.clear();
}
