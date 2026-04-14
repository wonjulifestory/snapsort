import { useState, type ReactNode } from 'react';
import Header from './components/Header';
import BottomNav, { type TabId } from './components/BottomNav';
import ImageImport from './components/ImageImport';
import InboxView from './components/InboxView';
import SavedView from './components/SavedView';
import SearchView from './components/SearchView';
import SettingsView from './components/SettingsView';

type TabViewComponent = (props: { onImportClick?: () => void }) => ReactNode;

const tabViews: Record<TabId, TabViewComponent> = {
  inbox: InboxView,
  saved: SavedView,
  search: SearchView,
  settings: SettingsView,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('inbox');
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportClose = () => {
    setImportOpen(false);
    setRefreshKey((k) => k + 1); // 인박스 새로고침 트리거
    setActiveTab('inbox'); // 인박스 탭으로 이동
  };

  const ActiveView = tabViews[activeTab];

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      <Header onImportClick={() => setImportOpen(true)} />

      <main className="flex-1 overflow-y-auto pt-14 pb-16">
        <ActiveView key={refreshKey} onImportClick={() => setImportOpen(true)} />
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <ImageImport open={importOpen} onClose={handleImportClose} />
    </div>
  );
}
