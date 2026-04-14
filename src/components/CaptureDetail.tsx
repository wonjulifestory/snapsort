import { useEffect, useMemo, useState } from 'react';
import type { CaptureItem } from '../db/database';
import { updateCapture } from '../db/helpers';

const SOURCE_OPTIONS = ['쓰레드', '페이스북', '인스타그램', 'X', '기타'];

interface CaptureDetailProps {
  item: CaptureItem;
  onClose: () => void;
  onUpdated: () => void;
}

export default function CaptureDetail({ item, onClose, onUpdated }: CaptureDetailProps) {
  const [cleanedText, setCleanedText] = useState(item.editedText || item.cleanedText);
  const [summary] = useState(item.summary);
  const [tags, setTags] = useState<string[]>([...item.tags]);
  const [sourceApp, setSourceApp] = useState(item.sourceApp);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const imageUrl = useMemo(
    () => URL.createObjectURL(item.imageBlob),
    [item.imageBlob],
  );

  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleConfirm = async () => {
    if (!item.id) return;
    setSaving(true);
    try {
      await updateCapture(item.id, {
        editedText: cleanedText,
        tags,
        sourceApp,
        state: 'confirmed',
      });
      onUpdated();
      onClose();
    } catch (err) {
      console.error('저장 실패:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item.id) return;
    if (!confirm('이 캡처를 삭제하시겠습니까?')) return;
    const { db } = await import('../db/database');
    await db.captures.delete(item.id);
    onUpdated();
    onClose();
  };

  const handleExportObsidian = () => {
    const content = [
      `# ${summary || '캡처'}`,
      '',
      cleanedText,
      '',
      `> 출처: ${sourceApp || '알 수 없음'}`,
      `> 태그: ${tags.map((t) => `#${t}`).join(' ')}`,
      `> 날짜: ${item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date(item.createdAt).toISOString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capture-${item.id ?? 'unknown'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg max-h-[90dvh] rounded-t-2xl sm:rounded-2xl overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">상세 보기</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 원본 이미지 */}
          <img
            src={imageUrl}
            alt="원본 캡처"
            className="w-full rounded-xl border border-gray-100"
          />

          {/* AI 요약 */}
          {summary && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">AI 요약</label>
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{summary}</p>
            </div>
          )}

          {/* 핵심 텍스트 (수정 가능) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">핵심 텍스트</label>
            <textarea
              value={cleanedText}
              onChange={(e) => setCleanedText(e.target.value)}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
              placeholder="추출된 텍스트..."
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">태그</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-800"
                    aria-label={`${tag} 삭제`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                placeholder="태그 추가..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                추가
              </button>
            </div>
          </div>

          {/* 출처 앱 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">출처 앱</label>
            <select
              value={sourceApp}
              onChange={(e) => setSourceApp(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              <option value="">선택하세요</option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-2 pb-4">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '확인 / 저장'}
            </button>
            <button
              onClick={handleExportObsidian}
              className="px-4 py-2.5 text-sm font-medium bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors"
            >
              Obsidian
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 text-sm font-medium bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
