import { useState, useRef, useCallback, useEffect } from 'react';
import { addCapture } from '../db/helpers';

interface ImageImportProps {
  open: boolean;
  onClose: () => void;
}

export default function ImageImport({ open, onClose }: ImageImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStatus(null);
      setProcessing(false);
    }
  }, [open]);

  const processFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setStatus({ type: 'error', message: '이미지 파일을 선택해 주세요.' });
      return;
    }

    setProcessing(true);
    let added = 0;
    let duplicates = 0;
    let errors = 0;

    const errorMessages: string[] = [];
    for (const file of imageFiles) {
      try {
        await addCapture(file);
        added++;
      } catch (err) {
        if (err instanceof Error && err.message.includes('중복')) {
          duplicates++;
        } else {
          errors++;
          errorMessages.push(err instanceof Error ? err.message : String(err));
        }
      }
    }

    setProcessing(false);

    const parts: string[] = [];
    if (added > 0) parts.push(`${added}장 저장 완료`);
    if (duplicates > 0) parts.push(`${duplicates}장 중복`);
    if (errors > 0) parts.push(`${errors}장 오류`);

    if (errorMessages.length > 0) {
      parts.push(`(${errorMessages[0]})`);
    }

    const statusType = duplicates > 0 || errors > 0 ? (added > 0 ? 'info' : 'error') : 'success';

    setStatus({
      type: statusType,
      message: parts.join(', '),
    });

    // Auto-close after 2 seconds on success, show toast
    if (added > 0) {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
        setToastMessage(`저장 완료! 인박스에서 확인하세요`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
      }, 2000);
    }
  }, [onClose]);

  // Paste handler
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open, processFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <>
      {/* Toast notification (shown after modal closes) */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-fade-in-down">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-xl shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {toastMessage}
          </div>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => {
              if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
              onClose();
            }}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md mx-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:mb-0 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">사진 가져오기</h2>
              <button
                onClick={() => {
                  if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
                  onClose();
                }}
                className="flex items-center justify-center w-11 h-11 -mr-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100 active:bg-gray-200"
                aria-label="닫기"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  탭하여 사진 선택
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  드래그 앤 드롭 또는 클립보드 붙여넣기(Ctrl+V)
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Status message */}
            {processing && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-500 font-medium transition-opacity duration-300">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                처리 중...
              </div>
            )}
            {status && !processing && (
              <div
                className={`mt-4 text-center text-sm font-medium transition-opacity duration-300 ${
                  status.type === 'success'
                    ? 'text-green-600'
                    : status.type === 'error'
                      ? 'text-red-500'
                      : 'text-amber-600'
                }`}
              >
                <p>{status.message}</p>
                {status.type === 'success' && (
                  <p className="mt-1 text-xs text-gray-400">잠시 후 자동으로 닫힙니다...</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
