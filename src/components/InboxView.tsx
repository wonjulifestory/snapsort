import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureItem } from '../db/database';
import { db } from '../db/database';
import { getInbox, updateCapture } from '../db/helpers';
import { analyzeScreenshots } from '../api/client';
import CaptureCard from './CaptureCard';
import CaptureDetail from './CaptureDetail';

interface InboxViewProps {
  onImportClick?: () => void;
}

export default function InboxView({ onImportClick: _onImportClick }: InboxViewProps) {
  void _onImportClick;
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CaptureItem | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const data = await getInbox();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const analyzeOne = async (item: CaptureItem) => {
    if (!item.id) return;
    setAnalyzeError(null);
    try {
      await updateCapture(item.id, { state: 'processing' });
      await loadItems();

      const result = await analyzeScreenshots([item.imageBlob]);
      await updateCapture(item.id, {
        state: 'completed',
        rawText: result.raw_text,
        cleanedText: result.cleaned_text,
        summary: result.summary,
        tags: result.tags,
        sourceApp: result.source_app,
        confidence: result.confidence,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('분석 실패:', msg);
      setAnalyzeError(msg);
      if (item.id) {
        await updateCapture(item.id, { state: 'failed' });
      }
    }
    await loadItems();
  };

  const handleBulkAnalyze = async () => {
    const importedItems = items.filter((i) => i.state === 'imported');
    if (importedItems.length === 0) return;

    setAnalyzing(true);
    for (const item of importedItems) {
      await analyzeOne(item);
    }
    setAnalyzing(false);
  };

  const handleConfirm = async (item: CaptureItem) => {
    if (!item.id) return;
    await updateCapture(item.id, { state: 'confirmed' });
    await loadItems();
  };

  const handleRetry = async (item: CaptureItem) => {
    await analyzeOne(item);
  };

  const handleDelete = async (item: CaptureItem) => {
    if (!item.id) return;
    await db.captures.delete(item.id);
    await loadItems();
  };

  const importedCount = items.filter((i) => i.state === 'imported').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDirectImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      try {
        await (await import('../db/helpers')).addCapture(file);
      } catch { /* 중복 등 무시 */ }
    }
    e.target.value = '';
    await loadItems();
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 active:bg-blue-700 active:scale-95 transition-all duration-200 mb-4"
          aria-label="사진 추가"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleDirectImport}
          className="hidden"
        />
        <p className="text-base font-semibold text-gray-600">사진을 추가해보세요</p>
        <p className="mt-1 text-sm text-gray-400 text-center">
          탭하면 바로 사진을 선택할 수 있어요
        </p>
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {/* 전체 분석 버튼 */}
      {importedCount > 0 && (
        <button
          onClick={handleBulkAnalyze}
          disabled={analyzing}
          className="w-full mb-3 py-3 text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              분석 중...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M11 8v6" />
                <path d="M8 11h6" />
              </svg>
              전체 분석 ({importedCount}건)
            </>
          )}
        </button>
      )}

      {/* 분석 에러 표시 */}
      {analyzeError && (
        <div className="mb-3 p-3 bg-red-50 rounded-xl text-xs text-red-600">
          분석 실패: {analyzeError}
        </div>
      )}

      {/* 캡처 목록 */}
      <div className="space-y-2">
        {items.map((item) => (
          <CaptureCard
            key={item.id}
            item={item}
            onTap={setSelectedItem}
            onConfirm={handleConfirm}
            onRetry={handleRetry}
            onDelete={handleDelete}
          />
        ))}
      </div>

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
