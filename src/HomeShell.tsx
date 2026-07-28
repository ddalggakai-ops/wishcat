import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkyBackground from './components/SkyBackground';
import BottomNav, { TabKey } from './components/BottomNav';
import Toast from './components/Toast';
import MineScreen from './screens/MineScreen';
import FriendsScreen from './screens/FriendsScreen';
import ExploreScreen from './screens/ExploreScreen';
import MemoriesScreen from './screens/MemoriesScreen';
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
import { useApp } from './context/AppContext';
import type { Item } from './api/types';

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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  }, []);

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

  const submitMemory = async (payload: { photoUrl: string | null; text: string }) => {
    if (!memoryItem) return;
    const wasDone = memoryItem.done;
    await completeItem(memoryItem.id, { photo: payload.photoUrl, text: payload.text });
    showToast(wasDone ? '추억을 저장했어요' : '축하해요 · 꿈을 이뤘어요 ✦');
  };

  const submitHelp = async (payload: { title: string; emoji: string; text: string }) => {
    if (!helpItemTarget) return;
    await helpItem(helpItemTarget.id, payload);
    showToast(`${helpItemTarget.owner.name}님의 꿈을 도왔어요`);
  };

  const confirmDelete = (item: Item) => {
    Alert.alert('꿈을 삭제할까요?', item.title, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          setMenuItem(null);
          await deleteItem(item.id);
          showToast('꿈을 삭제했어요');
        },
      },
    ]);
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
      />
    );
  } else if (tab === 'mine') {
    content = (
      <MineScreen
        onEditProfile={() => setProfileOpen(true)}
        onMemory={setMemoryItem}
        onShare={setViewerItem}
        onMenu={setMenuItem}
        onBulkImport={() => setBulkImportOpen(true)}
      />
    );
  } else if (tab === 'friends') {
    content = <FriendsScreen onOpenPerson={(id, name) => openPerson(id, name, true)} onInvite={() => setInviteItem('general')} />;
  } else if (tab === 'explore') {
    content = <ExploreScreen onOpenPerson={(id, name) => openPerson(id, name, false)} />;
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

      <AddEditSheet visible={addEditOpen} onClose={() => setAddEditOpen(false)} editingItem={editingItem} onSubmit={submitAddEdit} />
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
