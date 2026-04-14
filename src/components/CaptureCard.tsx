import { useMemo } from 'react';
import type { CaptureItem } from '../db/database';

interface CaptureCardProps {
  item: CaptureItem;
  onTap?: (item: CaptureItem) => void;
  onConfirm?: (item: CaptureItem) => void;
  onRetry?: (item: CaptureItem) => void;
  onDelete?: (item: CaptureItem) => void;
}

export default function CaptureCard({ item, onTap, onConfirm, onRetry, onDelete }: CaptureCardProps) {
  const thumbUrl = useMemo(() => {
    const blob = item.thumbnailBlob ?? item.imageBlob;
    return blob ? URL.createObjectURL(blob) : null;
  }, [item.thumbnailBlob, item.imageBlob]);

  const date = item.createdAt instanceof Date
    ? item.createdAt
    : new Date(item.createdAt);

  const dateStr = date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const summaryText = item.summary || item.editedText || item.cleanedText || item.rawText || '';

  return (
    <article
      className="relative flex gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:bg-gray-50 transition-colors duration-200 cursor-pointer group"
      onClick={() => onTap?.(item)}
    >
      {/* X 삭제 버튼 - 항상 표시 */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete?.(item); }}
        className="absolute top-1.5 right-1.5 flex items-center justify-center w-7 h-7 min-w-[44px] min-h-[44px] text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200 z-10"
        aria-label="삭제"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* 썸네일 */}
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className="w-[60px] h-[60px] rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-[60px] h-[60px] rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </div>
      )}

      {/* 내용 */}
      <div className="flex-1 min-w-0 pr-5">
        {/* 요약 텍스트 2줄 말줄임 */}
        <p className="text-sm text-gray-900 line-clamp-2 leading-snug">
          {summaryText || '(내용 없음)'}
        </p>

        {/* 태그 칩 + 출처 + 날짜 */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[10px] text-gray-400">+{item.tags.length - 3}</span>
          )}
          {item.sourceApp && (
            <span className="text-[10px] text-gray-400">{item.sourceApp}</span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">{dateStr}</span>
        </div>

        {/* State 기반 표시 */}
        <div className="mt-2">
          {item.state === 'imported' && (
            <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-yellow-50 text-yellow-700 rounded-full">
              분석 대기중
            </span>
          )}

          {item.state === 'processing' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-600 rounded-full">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              분석 중...
            </span>
          )}

          {item.state === 'completed' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-green-600 font-medium">분석 완료</span>
              <button
                onClick={(e) => { e.stopPropagation(); onConfirm?.(item); }}
                className="px-2.5 py-1 min-h-[44px] text-[11px] font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors"
              >
                확인
              </button>
            </div>
          )}

          {item.state === 'confirmed' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-green-50 text-green-600 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              저장 완료
            </span>
          )}

          {item.state === 'failed' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-red-500 font-medium">실패</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRetry?.(item); }}
                className="px-2.5 py-1 min-h-[44px] text-[11px] font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors"
              >
                재시도
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
