import { useCallback, useEffect, useState } from 'react';
import type { CaptureItem } from '../db/database';
import { getConfirmed, getAllTags } from '../db/helpers';
import CaptureCard from './CaptureCard';
import CaptureDetail from './CaptureDetail';

export default function SavedView() {
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CaptureItem | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const [data, tags] = await Promise.all([getConfirmed(), getAllTags()]);
      setItems(data);
      setAllTags(tags);
    } catch (err) {
      console.error('저장 목록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = selectedTag
    ? items.filter((item) => item.tags.includes(selectedTag))
    : items;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
        <p className="mt-3 text-sm font-medium">저장된 항목이 없습니다</p>
        <p className="mt-1 text-xs text-gray-300 text-center">
          인박스에서 분석 완료된 캡처를 확인하면 여기에 저장됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {/* 태그 필터 칩 */}
      {allTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button
            onClick={() => setSelectedTag(null)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              selectedTag === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                selectedTag === tag
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 결과 수 */}
      <p className="text-xs text-gray-400 mb-2">
        {filteredItems.length}건
        {selectedTag && <span> &middot; #{selectedTag}</span>}
      </p>

      {/* 카드 목록 */}
      {filteredItems.length > 0 ? (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <CaptureCard
              key={item.id}
              item={item}
              onTap={setSelectedItem}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400 py-8">
          해당 태그의 항목이 없습니다
        </p>
      )}

      {/* 상세 보기 모달 */}
      {selectedItem && (
        <CaptureDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={loadItems}
        />
      )}
    </div>
  );
}
