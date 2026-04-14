import { useState } from 'react';
import Header from './components/Header';
import BottomNav, { type TabId } from './components/BottomNav';
import ImageImport from './components/ImageImport';
import InboxView from './components/InboxView';
import SavedView from './components/SavedView';
import SearchView from './components/SearchView';
import SettingsView from './components/SettingsView';

const tabViews: Record<TabId, () => JSX.Element> = {
  inbox: InboxView,
  saved: SavedView,
  search: SearchView,
  settings: SettingsView,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('inbox');
  const [importOpen, setImportOpen] = useState(false);

  const ActiveView = tabViews[activeTab];

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      <Header onImportClick={() => setImportOpen(true)} />

      {/* Main content area between header and bottom nav */}
      <main className="flex-1 overflow-y-auto pt-14 pb-16">
        <ActiveView />
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <ImageImport open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
