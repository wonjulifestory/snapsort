import { useState, useEffect, useCallback, useRef } from 'react';
import type { CaptureItem } from '../db/database';
import {
  searchCaptures,
  filterByTag,
  filterBySource,
  getAllTags,
} from '../db/helpers';
import { db } from '../db/database';
import CaptureCard from './CaptureCard';
import CaptureDetail from './CaptureDetail';
import { downloadMarkdown, openInObsidian } from '../utils/export';

type FilterType = 'all' | 'tag' | 'source' | 'date';

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedItem, setSelectedItem] = useState<CaptureItem | null>(null);

  // 필터 옵션들
  const [tags, setTags] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 태그 및 소스 목록 로드
  useEffect(() => {
    (async () => {
      const allTags = await getAllTags();
      setTags(allTags);

      const allItems = await db.captures.toArray();
      const sourceSet = new Set<string>();
      for (const item of allItems) {
        if (item.sourceApp) sourceSet.add(item.sourceApp);
      }
      setSources(Array.from(sourceSet).sort());
    })();
  }, []);

  // 검색 실행
  const performSearch = useCallback(async () => {
    setLoading(true);
    try {
      let items: CaptureItem[];

      if (activeFilter === 'tag' && selectedTag) {
        items = await filterByTag(selectedTag);
      } else if (activeFilter === 'source' && selectedSource) {
        items = await filterBySource(selectedSource);
      } else if (activeFilter === 'date' && (dateFrom || dateTo)) {
        const allItems = await db.captures.toArray();
        items = allItems.filter((item) => {
          const d = item.createdAt instanceof Date
            ? item.createdAt
            : new Date(item.createdAt);
          if (dateFrom && d < new Date(dateFrom)) return false;
          if (dateTo) {
            const end = new Date(dateTo);
            end.setDate(end.getDate() + 1);
            if (d >= end) return false;
          }
          return true;
        });
      } else if (query.trim()) {
        items = await searchCaptures(query.trim());
      } else {
        items = [];
      }

      // 텍스트 검색어가 있으면 필터 결과에 추가 필터링
      if (query.trim() && activeFilter !== 'all') {
        const lq = query.toLowerCase();
        items = items.filter(
          (i) =>
            i.cleanedText.toLowerCase().includes(lq) ||
            i.summary.toLowerCase().includes(lq) ||
            i.rawText.toLowerCase().includes(lq),
        );
      }

      // 최신순 정렬
      items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setResults(items);
    } catch (err) {
      console.error('검색 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [query, activeFilter, selectedTag, selectedSource, dateFrom, dateTo]);

  // 디바운스 검색
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      performSearch();
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [performSearch]);

  const filterChips: { id: FilterType; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'tag', label: '태그별' },
    { id: 'source', label: '출처별' },
    { id: 'date', label: '날짜범위' },
  ];

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* 검색바 */}
      <div className="sticky top-14 z-10 bg-gray-50 pt-2 pb-1 px-1">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="캡처 내용 검색..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="검색어 지우기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* 필터 칩 */}
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === chip.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* 필터별 서브 옵션 */}
        {activeFilter === 'tag' && tags.length > 0 && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  selectedTag === tag
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {activeFilter === 'source' && sources.length > 0 && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
            {sources.map((src) => (
              <button
                key={src}
                onClick={() =>
                  setSelectedSource(selectedSource === src ? '' : src)
                }
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  selectedSource === src
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        )}

        {activeFilter === 'date' && (
          <div className="flex gap-2 mt-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="시작일"
            />
            <span className="text-gray-400 self-center text-xs">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="종료일"
            />
          </div>
        )}
      </div>

      {/* 검색 결과 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 px-1">
            {results.length}건의 결과
          </p>
          {results.map((item) => (
            <CaptureCard
              key={item.id}
              item={item}
              onTap={setSelectedItem}
            />
          ))}
        </div>
      ) : (query || activeFilter !== 'all') ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="mt-3 text-sm">검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="mt-3 text-sm">검색어를 입력하거나 필터를 선택하세요</p>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {selectedItem && (
        <CaptureDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={performSearch}
        />
      )}
    </div>
  );
}
