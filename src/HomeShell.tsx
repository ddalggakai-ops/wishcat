import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkyBackground from './components/SkyBackground';
import BottomNav, { TabKey } from './components/BottomNav';
import Toast from './components/Toast';
import MineScreen from './screens/MineScreen';
import FriendsScreen from './screens/FriendsScreen';
import ExploreScreen from './screens/ExploreScreen';
import MemoriesScreen from './screens/MemoriesScreen';
import RecommendScreen from './screens/RecommendScreen';
import PersonScreen from './screens/PersonScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AddEditSheet, { AddEditPayload } from './sheets/AddEditSheet';
import MemorySheet from './sheets/MemorySheet';
import HelpSheet from './sheets/HelpSheet';
import ProfileSheet from './sheets/ProfileSheet';
import ItemMenuSheet from './sheets/ItemMenuSheet';
import ViewerModal from './sheets/ViewerModal';
import InviteModal from './sheets/InviteModal';
import BulkImportSheet from './sheets/BulkImportSheet';
import StarterSheet from './sheets/StarterSheet';
import ItemDetailSheet from './sheets/ItemDetailSheet';
import ReportSheet from './sheets/ReportSheet';
import RecommendPostModal from './sheets/RecommendPostModal';
import { useApp } from './context/AppContext';
import { confirmDialog } from './utils/dialog';
import type { Item } from './api/types';
import type { RecommendPost } from './data/recommendPosts';

type PersonView = { id: string; name: string; isFriendTab: boolean } | null;

export default function HomeShell() {
  const insets = useSafeAreaInsets();
  const { addItem, editItem, deleteItem, completeItem, helpItem } = useApp();

  const [tab, setTab] = useState<TabKey>('mine');
  const [person, setPerson] = useState<PersonView>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOnboardReplay, setShowOnboardReplay] = useState(false);

  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [memoryItem, setMemoryItem] = useState<Item | null>(null);
  const [helpItemTarget, setHelpItemTarget] = useState<Item | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuItem, setMenuItem] = useState<Item | null>(null);
  const [viewerItem, setViewerItem] = useState<Item | null>(null);
  const [inviteItem, setInviteItem] = useState<Item | null | 'general'>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [starterOpen, setStarterOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [reportItem, setReportItem] = useState<Item | null>(null);
  const [recommendPost, setRecommendPost] = useState<RecommendPost | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  }, []);

  // 안드로이드 하드웨어 뒤로가기: 열려 있는 시트/오버레이를 먼저 닫고, 사람 페이지 → 목록,
  // 다른 탭 → 내 목록 순으로 되돌아갑니다. 최상위(내 목록)에서만 기본 동작(앱 종료)을 허용해요.
  // 예전엔 아무것도 안 잡아서 어디서 눌러도 앱이 바로 꺼졌습니다.
  useEffect(() => {
    const onBack = () => {
      if (recommendPost) { setRecommendPost(null); return true; }
      if (reportItem) { setReportItem(null); return true; }
      if (detailItem) { setDetailItem(null); return true; }
      if (viewerItem) { setViewerItem(null); return true; }
      if (inviteItem) { setInviteItem(null); return true; }
      if (bulkImportOpen) { setBulkImportOpen(false); return true; }
      if (starterOpen) { setStarterOpen(false); return true; }
      if (menuItem) { setMenuItem(null); return true; }
      if (profileOpen) { setProfileOpen(false); return true; }
      if (helpItemTarget) { setHelpItemTarget(null); return true; }
      if (memoryItem) { setMemoryItem(null); return true; }
      if (addEditOpen) { setAddEditOpen(false); return true; }
      if (showOnboardReplay) { setShowOnboardReplay(false); return true; }
      if (person) { setPerson(null); return true; }
      if (tab !== 'mine') { setTab('mine'); return true; }
      return false; // 내 목록 최상위 → 앱 종료 허용
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [recommendPost, reportItem, detailItem, viewerItem, inviteItem, bulkImportOpen, starterOpen, menuItem, profileOpen, helpItemTarget, memoryItem, addEditOpen, showOnboardReplay, person, tab]);

  const openPerson = useCallback((id: string, name: string, isFriendTab: boolean) => {
    setPerson({ id, name, isFriendTab });
  }, []);
  const closePerson = useCallback(() => setPerson(null), []);

  const onChangeTab = (t: TabKey) => { setPerson(null); setTab(t); };

  const openAdd = () => { setEditingItem(null); setAddEditOpen(true); };
  const openEdit = (item: Item) => { setMenuItem(null); setEditingItem(item); setAddEditOpen(true); };

  const submitAddEdit = async (payload: AddEditPayload) => {
    if (editingItem) {
      await editItem(editingItem.id, payload);
      showToast('꿈을 수정했어요');
    } else {
      await addItem(payload);
      showToast('새로운 꿈을 추가했어요');
    }
  };

  const submitMemory = async (payload: { photoUrls: string[]; text: string }) => {
    if (!memoryItem) return;
    const wasDone = memoryItem.done;
    await completeItem(memoryItem.id, { photos: payload.photoUrls, text: payload.text });
    showToast(wasDone ? '추억을 저장했어요' : '축하해요 · 꿈을 이뤘어요 ✦');
  };

  const submitHelp = async (payload: { title: string; emoji: string; text: string }) => {
    if (!helpItemTarget) return;
    await helpItem(helpItemTarget.id, payload);
    showToast(`${helpItemTarget.owner.name}님의 꿈을 도왔어요`);
  };

  const confirmDelete = async (item: Item) => {
    const ok = await confirmDialog({ title: '꿈을 삭제할까요?', message: item.title, confirmLabel: '삭제', destructive: true });
    if (!ok) return;
    setMenuItem(null);
    try {
      await deleteItem(item.id);
      showToast('꿈을 삭제했어요');
    } catch {
      showToast('삭제하지 못했어요. 잠시 뒤 다시 시도해주세요');
    }
  };

  let content: React.ReactNode;
  if (person) {
    content = (
      <PersonScreen
        userId={person.id}
        isFriendTab={person.isFriendTab}
        onBack={closePerson}
        onOpenViewer={setViewerItem}
        onHelp={setHelpItemTarget}
        onReport={setReportItem}
      />
    );
  } else if (tab === 'mine') {
    content = (
      <MineScreen
        onEditProfile={() => setProfileOpen(true)}
        onMemory={setMemoryItem}
        onShare={setViewerItem}
        onMenu={setMenuItem}
        onStarter={() => setStarterOpen(true)}
        onEdit={openEdit}
        onDetail={setDetailItem}
      />
    );
  } else if (tab === 'recommend') {
    content = <RecommendScreen onOpenPost={setRecommendPost} />;
  } else if (tab === 'friends') {
    content = <FriendsScreen onOpenPerson={(id, name) => openPerson(id, name, true)} onInvite={() => setInviteItem('general')} />;
  } else if (tab === 'explore') {
    content = <ExploreScreen onOpenItem={setDetailItem} onToast={showToast} />;
  } else {
    content = <MemoriesScreen onOpenViewer={setViewerItem} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <SkyBackground />
      <View style={styles.app}>
        <View style={[styles.main, { paddingTop: insets.top + 4 }]}>{content}</View>
        <BottomNav active={person ? (person.isFriendTab ? 'friends' : 'explore') : tab} onChange={onChangeTab} onAdd={openAdd} />
      </View>

      <Toast message={toast} />

      <AddEditSheet
        visible={addEditOpen}
        onClose={() => setAddEditOpen(false)}
        editingItem={editingItem}
        onSubmit={submitAddEdit}
        onBulkImport={() => { setAddEditOpen(false); setBulkImportOpen(true); }}
      />
      <MemorySheet visible={!!memoryItem} onClose={() => setMemoryItem(null)} item={memoryItem} onSubmit={submitMemory} />
      <HelpSheet visible={!!helpItemTarget} onClose={() => setHelpItemTarget(null)} item={helpItemTarget} onSubmit={submitHelp} />
      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} onReplayOnboarding={() => setShowOnboardReplay(true)} />
      <ItemMenuSheet
        visible={!!menuItem}
        onClose={() => setMenuItem(null)}
        item={menuItem}
        onInvite={(item) => { setMenuItem(null); setInviteItem(item); }}
        onEdit={openEdit}
        onDelete={confirmDelete}
      />
      <ViewerModal visible={!!viewerItem} item={viewerItem} onClose={() => setViewerItem(null)} />
      <BulkImportSheet
        visible={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onImported={(count) => showToast(`꿈 ${count}개를 추가했어요`)}
      />
      <StarterSheet
        visible={starterOpen}
        onClose={() => setStarterOpen(false)}
        onAdded={(count) => showToast(`꿈 ${count}개를 담았어요 ✦`)}
      />
      <ItemDetailSheet
        visible={!!detailItem}
        onClose={() => setDetailItem(null)}
        item={detailItem}
        onOpenPerson={(id, name) => openPerson(id, name, false)}
        onReport={setReportItem}
        onToast={showToast}
      />
      <ReportSheet
        visible={!!reportItem}
        onClose={() => setReportItem(null)}
        item={reportItem}
        onDone={showToast}
      />
      <RecommendPostModal
        post={recommendPost}
        onClose={() => setRecommendPost(null)}
        onToast={showToast}
      />
      <InviteModal
        visible={!!inviteItem}
        onClose={() => setInviteItem(null)}
        item={inviteItem === 'general' ? null : inviteItem}
        onToast={showToast}
      />

      {showOnboardReplay ? (
        <View style={StyleSheet.absoluteFill}>
          <OnboardingScreen onFinish={() => setShowOnboardReplay(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  main: { flex: 1, paddingHorizontal: 20 },
});
