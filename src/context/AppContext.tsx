import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as itemsService from '../services/itemsService';
import * as friendsService from '../services/friendsService';
import type { FriendEntry, Item } from '../api/types';
import { useAuth } from './AuthContext';

interface AppState {
  itemsById: Record<string, Item>;
  mineIds: string[];
  friends: FriendEntry[];
  loadingMine: boolean;
  loadingFriends: boolean;
  getItem: (id: string) => Item | undefined;
  mergeItems: (items: Item[]) => void;
  refreshMine: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  addItem: (payload: { title: string; emoji: string; note?: string; category?: string | null; location?: { name: string; region: 'domestic' | 'overseas' } | null }) => Promise<Item>;
  editItem: (id: string, patch: Partial<{ title: string; emoji: string; note: string; category: string | null; location: { name: string; region: 'domestic' | 'overseas' } | null }>) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  completeItem: (id: string, payload: { photo?: string | null; text?: string }) => Promise<Item>;
  reopenItem: (id: string) => Promise<Item>;
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

  const refreshMine = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) return;
    setLoadingMine(true);
    try {
      const items = await itemsService.getMyItems(uid);
      mergeItems(items);
      setMineIds(items.map((i) => i.id));
    } finally {
      setLoadingMine(false);
    }
  }, [mergeItems]);

  const refreshFriends = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) return;
    setLoadingFriends(true);
    try {
      const list = await friendsService.getFriends(uid);
      setFriends(list);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const addItem: AppState['addItem'] = useCallback(async (payload) => {
    const item = await itemsService.addItem(requireUid(), payload);
    mergeItems([item]);
    setMineIds((prev) => [item.id, ...prev]);
    return item;
  }, [mergeItems]);

  const editItem: AppState['editItem'] = useCallback(async (id, patch) => {
    const item = await itemsService.editItem(id, requireUid(), patch);
    mergeItems([item]);
    return item;
  }, [mergeItems]);

  const deleteItem = useCallback(async (id: string) => {
    await itemsService.deleteItem(id);
    setItemsById((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setMineIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const completeItem: AppState['completeItem'] = useCallback(async (id, payload) => {
    const item = await itemsService.completeItem(id, requireUid(), payload);
    mergeItems([item]);
    return item;
  }, [mergeItems]);

  const reopenItem = useCallback(async (id: string) => {
    const item = await itemsService.reopenItem(id, requireUid());
    mergeItems([item]);
    return item;
  }, [mergeItems]);

  const joinItem = useCallback(async (id: string) => {
    await itemsService.joinItem(id, requireUid());
    const item = await itemsService.getItemById(id, uidRef.current || undefined);
    if (item) mergeItems([item]);
    await refreshMine();
  }, [mergeItems, refreshMine]);

  const leaveItem = useCallback(async (id: string) => {
    await itemsService.leaveItem(id, requireUid());
    const item = await itemsService.getItemById(id, uidRef.current || undefined);
    if (item) mergeItems([item]);
    await refreshMine();
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
    // optimistic update
    setItemsById((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const likedByMe = !cur.likedByMe;
      return { ...prev, [id]: { ...cur, likedByMe, likesCount: cur.likesCount + (likedByMe ? 1 : -1) } };
    });
    try {
      await itemsService.toggleLike(id, uid);
      const item = await itemsService.getItemById(id, uid);
      if (item) mergeItems([item]);
    } catch (e) {
      throw e;
    }
  }, [mergeItems]);

  const createInvite = useCallback(async (itemId?: string) => {
    return friendsService.createInvite(requireUid(), itemId);
  }, []);

  const value = useMemo<AppState>(() => ({
    itemsById, mineIds, friends, loadingMine, loadingFriends,
    getItem, mergeItems, refreshMine, refreshFriends,
    addItem, editItem, deleteItem, completeItem, reopenItem,
    joinItem, leaveItem, helpItem, toggleLike, createInvite,
  }), [itemsById, mineIds, friends, loadingMine, loadingFriends, getItem, mergeItems, refreshMine, refreshFriends, addItem, editItem, deleteItem, completeItem, reopenItem, joinItem, leaveItem, helpItem, toggleLike, createInvite]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useMyItems() {
  const { itemsById, mineIds } = useApp();
  return mineIds.map((id) => itemsById[id]).filter(Boolean);
}
