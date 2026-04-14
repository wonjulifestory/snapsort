import { useCallback, useEffect, useState } from 'react';
import type { CaptureItem } from '../db/database';
import { db } from '../db/database';
import { getInbox, updateCapture } from '../db/helpers';
import { analyzeScreenshots } from '../api/client';
import CaptureCard from './CaptureCard';
import CaptureDetail from './CaptureDetail';

export default function InboxView() {
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CaptureItem | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const data = await getInbox();
      setItems(data);
      if (data.length === 0) {
        const { db } = await import('../db/database');
        const all = await db.captures.toArray();
        const total = all.length;
        const states = all.map(i => `${i.id}:${i.state}`).join(', ');
        setError(`인박스 0건, DB 전체 ${total}건, states=[${states}]`);
      }
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

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
        <p className="mt-3 text-sm font-medium">인박스가 비어 있습니다</p>
        <p className="mt-1 text-xs text-gray-300 text-center">
          스크린샷을 가져와서 시작하세요
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
          className="w-full mb-3 py-2.5 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
            <>전체 분석 ({importedCount}건)</>
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
