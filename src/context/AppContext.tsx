import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as itemsService from '../services/itemsService';
import type { NewItemPayload } from '../services/itemsService';
import * as friendsService from '../services/friendsService';
import { cancelReminder, syncReminder } from '../services/reminderService';
import type { FriendEntry, Item, Location, Priority } from '../api/types';
import { useAuth } from './AuthContext';

interface AppState {
  itemsById: Record<string, Item>;
  mineIds: string[];
  friends: FriendEntry[];
  loadingMine: boolean;
  loadingFriends: boolean;
  getItem: (id: string) => Item | undefined;
  mergeItems: (items: Item[]) => void;
  refreshMine: (opts?: { force?: boolean }) => Promise<void>;
  refreshFriends: (opts?: { force?: boolean }) => Promise<void>;
  addItem: (payload: NewItemPayload) => Promise<Item>;
  bulkAddItems: (payloads: NewItemPayload[]) => Promise<number>;
  editItem: (id: string, patch: Partial<{ title: string; emoji: string; note: string; categories: string[]; location: Location | null; targetDate: string | null; priority: Priority | null }>) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  deleteItems: (ids: string[]) => Promise<void>;
  completeItems: (ids: string[]) => Promise<void>;
  reorderItems: (updates: { id: string; order: number }[]) => Promise<void>;
  completeItem: (id: string, payload: { photos?: string[]; text?: string }) => Promise<Item>;
  reopenItem: (id: string) => Promise<Item>;
  startItem: (id: string) => Promise<Item>;
  stopItem: (id: string) => Promise<Item>;
  joinItem: (id: string) => Promise<void>;
  leaveItem: (id: string) => Promise<void>;
  helpItem: (id: string, payload: { title: string; emoji: string; note?: string; text?: string }) => Promise<Item>;
  toggleLike: (id: string) => Promise<void>;
  createInvite: (itemId?: string) => Promise<string>;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});
  const [mineIds, setMineIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const cacheRef = useRef(itemsById);
  cacheRef.current = itemsById;
  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.id || null;
  // 탭을 왔다갔다 할 때마다 화면이 통째로 다시 마운트되면서 useEffect가 다시 돌아요.
  // 방금 막 받아온 목록을 또 통째로 다시 읽지 않도록 마지막으로 받아온 시각을 기억해 둡니다.
  const mineFetchedAt = useRef(0);
  const friendsFetchedAt = useRef(0);
  const MINE_TTL_MS = 15_000;
  const FRIENDS_TTL_MS = 15_000;

  const mergeItems = useCallback((items: Item[]) => {
    setItemsById((prev) => {
      const next = { ...prev };
      items.forEach((it) => { next[it.id] = it; });
      return next;
    });
  }, []);

  const getItem = useCallback((id: string) => cacheRef.current[id], []);

  const requireUid = () => {
    const uid = uidRef.current;
    if (!uid) throw new Error('로그인이 필요해요');
    return uid;
  };

  const refreshMine = useCallback(async (opts?: { force?: boolean }) => {
    const uid = uidRef.current;
    if (!uid) return;
    // 방금(15초 안에) 이미 받아온 상태면 화면이 다시 마운트돼도 그냥 캐시를 씁니다.
    // pull-to-refresh처럼 진짜 새로고침이 필요할 땐 force로 건너뜁니다.
    if (!opts?.force && Date.now() - mineFetchedAt.current < MINE_TTL_MS) return;
    setLoadingMine(true);
    try {
      const items = await itemsService.getMyItems(uid);
      mergeItems(items);
      setMineIds(items.map((i) => i.id));
      mineFetchedAt.current = Date.now();
    } finally {
      setLoadingMine(false);
    }
  }, [mergeItems]);

  const refreshFriends = useCallback(async (opts?: { force?: boolean }) => {
    const uid = uidRef.current;
    if (!uid) return;
    if (!opts?.force && Date.now() - friendsFetchedAt.current < FRIENDS_TTL_MS) return;
    setLoadingFriends(true);
    try {
      const list = await friendsService.getFriends(uid, { force: opts?.force });
      // withMeCount(그 친구의 아이템 중 내가 함께하는 중인 것)는 따로 안 읽고,
      // 이미 갖고 있는 내 목록(origin==='joined')에서 바로 셉니다 — 추가 조회가 필요 없어요.
      const myItems = mineIds.map((id) => cacheRef.current[id]).filter(Boolean);
      const withMeByOwner = new Map<string, number>();
      myItems.forEach((it) => {
        if (it.origin === 'joined' && it.source?.ownerId) {
          withMeByOwner.set(it.source.ownerId, (withMeByOwner.get(it.source.ownerId) || 0) + 1);
        }
      });
      setFriends(list.map((f) => ({ ...f, withMeCount: withMeByOwner.get(f.id) || 0 })));
      friendsFetchedAt.current = Date.now();
    } finally {
      setLoadingFriends(false);
    }
  }, [mineIds]);

  const addItem: AppState['addItem'] = useCallback(async (payload) => {
    const item = await itemsService.addItem(requireUid(), payload);
    mergeItems([item]);
    setMineIds((prev) => [item.id, ...prev]);
    syncReminder(item.id, item.title, item.targetDate);
    return item;
  }, [mergeItems]);

  const bulkAddItems: AppState['bulkAddItems'] = useCallback(async (payloads) => {
    const count = await itemsService.bulkAddItems(requireUid(), payloads);
    // 여러 개를 한 번에 만들었으니 통째로 다시 불러옵니다. 반드시 force —
    // 방금(15초 캐시 안에) 목록을 불러온 상태면 캐시에 걸려 새로 담은 게 안 보였고,
    // 사용자가 실패한 줄 알고 한 번 더 담아 중복이 생겼어요.
    await refreshMine({ force: true });
    return count;
  }, [refreshMine]);

  const editItem: AppState['editItem'] = useCallback(async (id, patch) => {
    const item = await itemsService.editItem(id, requireUid(), patch);
    mergeItems([item]);
    syncReminder(item.id, item.title, item.targetDate);
    return item;
  }, [mergeItems]);

  const deleteItem = useCallback(async (id: string) => {
    await itemsService.deleteItem(id);
    cancelReminder(id);
    setItemsById((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setMineIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const deleteItems = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    await itemsService.deleteItems(ids);
    ids.forEach(cancelReminder);
    const idSet = new Set(ids);
    setItemsById((prev) => {
      const next = { ...prev };
      idSet.forEach((id) => delete next[id]);
      return next;
    });
    setMineIds((prev) => prev.filter((x) => !idSet.has(x)));
  }, []);

  const completeItems = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    await itemsService.completeItems(ids);
    ids.forEach(cancelReminder); // 이룬 꿈은 더 이상 재촉하지 않아요
    // 완료 상태·기록이 목록에 바로 반영되도록 통째로 다시 불러옵니다.
    await refreshMine({ force: true });
  }, [refreshMine]);

  const reorderItems = useCallback(async (updates: { id: string; order: number }[]) => {
    if (!updates.length) return;
    await itemsService.reorderItems(updates);
    setItemsById((prev) => {
      const next = { ...prev };
      updates.forEach(({ id, order }) => { if (next[id]) next[id] = { ...next[id], order }; });
      return next;
    });
  }, []);

  const completeItem: AppState['completeItem'] = useCallback(async (id, payload) => {
    const item = await itemsService.completeItem(id, requireUid(), payload);
    mergeItems([item]);
    cancelReminder(id); // 이룬 꿈은 더 이상 재촉하지 않아요
    return item;
  }, [mergeItems]);

  const reopenItem = useCallback(async (id: string) => {
    const item = await itemsService.reopenItem(id, requireUid());
    mergeItems([item]);
    syncReminder(item.id, item.title, item.targetDate);
    return item;
  }, [mergeItems]);

  const startItem = useCallback(async (id: string) => {
    const item = await itemsService.startItem(id, requireUid());
    mergeItems([item]);
    return item;
  }, [mergeItems]);

  const stopItem = useCallback(async (id: string) => {
    const item = await itemsService.stopItem(id, requireUid());
    mergeItems([item]);
    return item;
  }, [mergeItems]);

  const joinItem = useCallback(async (id: string) => {
    await itemsService.joinItem(id, requireUid());
    const item = await itemsService.getItemById(id, uidRef.current || undefined);
    if (item) mergeItems([item]);
    // force: 방금 담은 사본이 15초 캐시에 걸려 내 목록에 안 나타나던 문제를 막습니다.
    await refreshMine({ force: true });
  }, [mergeItems, refreshMine]);

  const leaveItem = useCallback(async (id: string) => {
    await itemsService.leaveItem(id, requireUid());
    const item = await itemsService.getItemById(id, uidRef.current || undefined);
    if (item) mergeItems([item]);
    await refreshMine({ force: true });
  }, [mergeItems, refreshMine]);

  const helpItem: AppState['helpItem'] = useCallback(async (id, payload) => {
    const record = await itemsService.helpItem(id, requireUid(), payload);
    const source = await itemsService.getItemById(id, uidRef.current || undefined);
    mergeItems(source ? [record, source] : [record]);
    setMineIds((prev) => [record.id, ...prev]);
    return record;
  }, [mergeItems]);

  const toggleLike = useCallback(async (id: string) => {
    const uid = requireUid();
    const prevItem = cacheRef.current[id];
    // 낙관적 업데이트 — 화면을 먼저 바꾸고 서버에 보냅니다. 좋아요 수가 음수로 내려가지 않게 막습니다.
    setItemsById((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const likedByMe = !cur.likedByMe;
      return { ...prev, [id]: { ...cur, likedByMe, likesCount: Math.max(0, cur.likesCount + (likedByMe ? 1 : -1)) } };
    });
    try {
      await itemsService.toggleLike(id, uid);
      const item = await itemsService.getItemById(id, uid);
      if (item) mergeItems([item]);
    } catch {
      // 서버가 실패하면 하트가 켜진(또는 꺼진) 채 남지 않도록 누르기 전 상태로 되돌립니다.
      if (prevItem) setItemsById((prev) => ({ ...prev, [id]: prevItem }));
    }
  }, [mergeItems]);

  const createInvite = useCallback(async (itemId?: string) => {
    return friendsService.createInvite(requireUid(), itemId);
  }, []);

  const value = useMemo<AppState>(() => ({
    itemsById, mineIds, friends, loadingMine, loadingFriends,
    getItem, mergeItems, refreshMine, refreshFriends,
    addItem, bulkAddItems, editItem, deleteItem, deleteItems, completeItems, reorderItems, completeItem, reopenItem,
    startItem, stopItem,
    joinItem, leaveItem, helpItem, toggleLike, createInvite,
  }), [itemsById, mineIds, friends, loadingMine, loadingFriends, getItem, mergeItems, refreshMine, refreshFriends, addItem, bulkAddItems, editItem, deleteItem, deleteItems, completeItems, reorderItems, completeItem, reopenItem, startItem, stopItem, joinItem, leaveItem, helpItem, toggleLike, createInvite]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useMyItems() {
  const { itemsById, mineIds } = useApp();
  // 매 렌더마다 새 배열을 만들면(참조가 매번 달라지면) 이 배열을 의존성으로 쓰는 화면의 모든
  // useMemo가 무력화돼 목록이 길수록 눈에 띄게 느려졌어요. 입력이 그대로면 같은 배열을 재사용합니다.
  return useMemo(() => mineIds.map((id) => itemsById[id]).filter(Boolean), [itemsById, mineIds]);
}
