import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { db } from '../firebase/config';

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
  } catch {
    // 규칙이 아직 배포되지 않았을 수 있음 — 차단 없음으로 취급
  }
  blockCache.set(uid, set);
  return set;
}

export async function blockUser(uid: string, targetUid: string): Promise<void> {
  await setDoc(blockDoc(uid, targetUid), { createdAt: serverTimestamp() });
  (await getBlockedIds(uid)).add(targetUid);
}

export async function unblockUser(uid: string, targetUid: string): Promise<void> {
  await deleteDoc(blockDoc(uid, targetUid));
  (await getBlockedIds(uid)).delete(targetUid);
}

export function clearBlockCache() {
  blockCache.clear();
}
