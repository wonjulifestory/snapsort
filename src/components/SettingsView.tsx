import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { getAllTags } from '../db/helpers';
import { downloadAllAsZip } from '../utils/export';

export default function SettingsView() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [totalCaptures, setTotalCaptures] = useState(0);
  const [tagStats, setTagStats] = useState<{ tag: string; count: number }[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE ?? '';

  // API 헬스체크
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        setApiStatus(res.ok ? 'ok' : 'error');
      } catch {
        setApiStatus('error');
      }
    })();
  }, [API_BASE]);

  // 데이터 통계 로드
  useEffect(() => {
    (async () => {
      const count = await db.captures.count();
      setTotalCaptures(count);

      const tags = await getAllTags();
      const allItems = await db.captures.toArray();
      const countMap = new Map<string, number>();
      for (const item of allItems) {
        for (const tag of item.tags) {
          countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
        }
      }
      setTagStats(
        tags.map((tag) => ({ tag, count: countMap.get(tag) ?? 0 }))
          .sort((a, b) => b.count - a.count),
      );
    })();
  }, []);

  // 일괄 내보내기
  const handleExportAll = async () => {
    setExporting(true);
    try {
      const items = await db.captures.toArray();
      await downloadAllAsZip(items);
    } catch (err) {
      console.error('내보내기 오류:', err);
      alert('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  // 데이터 초기화
  const handleReset = async () => {
    try {
      await db.captures.clear();
      setTotalCaptures(0);
      setTagStats([]);
      setShowResetDialog(false);
      alert('모든 데이터가 초기화되었습니다.');
    } catch (err) {
      console.error('초기화 오류:', err);
      alert('데이터 초기화 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* API 상태 */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">API 상태</h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              apiStatus === 'ok'
                ? 'bg-green-500'
                : apiStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-yellow-400 animate-pulse'
            }`}
          />
          <span className="text-sm text-gray-600">
            {apiStatus === 'ok' && '연결됨'}
            {apiStatus === 'error' && '연결 실패'}
            {apiStatus === 'checking' && '확인 중...'}
          </span>
          {apiStatus === 'error' && (
            <button
              onClick={() => {
                setApiStatus('checking');
                fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
                  .then((r) => setApiStatus(r.ok ? 'ok' : 'error'))
                  .catch(() => setApiStatus('error'));
              }}
              className="ml-auto text-xs text-blue-500 hover:text-blue-600"
            >
              재시도
            </button>
          )}
        </div>
      </section>

      {/* 데이터 통계 */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">데이터 통계</h2>

        <div className="flex items-center justify-between py-2 border-b border-gray-50">
          <span className="text-sm text-gray-600">총 캡처 수</span>
          <span className="text-sm font-semibold text-gray-900">{totalCaptures}건</span>
        </div>

        {tagStats.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-2">태그별 수</p>
            <div className="flex flex-wrap gap-2">
              {tagStats.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-full"
                >
                  #{tag}
                  <span className="text-blue-400 font-medium">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {tagStats.length === 0 && totalCaptures === 0 && (
          <p className="text-xs text-gray-400 mt-2">저장된 데이터가 없습니다.</p>
        )}
      </section>

      {/* 내보내기 */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">내보내기</h2>
        <button
          onClick={handleExportAll}
          disabled={exporting || totalCaptures === 0}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
        >
          {exporting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              내보내는 중...
            </span>
          ) : (
            `전체 내보내기 (${totalCaptures}건)`
          )}
        </button>
        <p className="text-[11px] text-gray-400 mt-1.5">
          모든 캡처를 마크다운 + 이미지 파일로 다운로드합니다.
        </p>
      </section>

      {/* 데이터 초기화 */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">데이터 관리</h2>
        <button
          onClick={() => setShowResetDialog(true)}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 transition-colors"
        >
          데이터 초기화
        </button>
        <p className="text-[11px] text-gray-400 mt-1.5">
          모든 캡처 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
        </p>
      </section>

      {/* 앱 버전 */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">SnapSort v0.5</p>
      </div>

      {/* 초기화 확인 다이얼로그 */}
      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              데이터를 초기화하시겠습니까?
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              모든 캡처 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수
              없습니다.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowResetDialog(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
