import type { CaptureItem } from '../db/database';

/**
 * CaptureItem을 Obsidian 호환 마크다운 문자열로 변환한다.
 */
export function exportToMarkdown(item: CaptureItem): string {
  const date = item.createdAt instanceof Date
    ? item.createdAt
    : new Date(item.createdAt);

  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');

  const tagsYaml = `[${item.tags.join(', ')}]`;
  const title = item.summary
    ? item.summary.split('\n')[0].slice(0, 80)
    : '무제';

  const lines = [
    '---',
    `tags: ${tagsYaml}`,
    `source: ${item.sourceApp || '알 수 없음'}`,
    `date: ${dateStr}`,
    '---',
    '',
    `## ${title}`,
    '',
    '### 요약',
    item.summary || '(요약 없음)',
    '',
    '### 핵심 내용',
    item.editedText || item.cleanedText || item.rawText || '(내용 없음)',
    '',
    `![[capture_${dateStr}_${timeStr}.png]]`,
    '',
  ];

  return lines.join('\n');
}

/**
 * Blob을 파일로 다운로드하는 헬퍼.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * CaptureItem의 마크다운 파일과 이미지 파일을 각각 다운로드한다.
 */
export function downloadMarkdown(item: CaptureItem): void {
  const date = item.createdAt instanceof Date
    ? item.createdAt
    : new Date(item.createdAt);

  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
  const baseName = `capture_${dateStr}_${timeStr}`;

  // 마크다운 파일 다운로드
  const md = exportToMarkdown(item);
  const mdBlob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(mdBlob, `${baseName}.md`);

  // 이미지 파일 다운로드
  if (item.imageBlob) {
    triggerDownload(item.imageBlob, `${baseName}.png`);
  }
}

/**
 * 모든 캡처 항목을 개별 다운로드한다.
 * (ZIP 라이브러리 없이 개별 파일 다운로드로 대체)
 */
export async function downloadAllAsZip(items: CaptureItem[]): Promise<void> {
  if (items.length === 0) return;

  // 한 번에 모두 다운로드하면 브라우저가 차단할 수 있으므로
  // 200ms 간격으로 순차 다운로드한다.
  for (let i = 0; i < items.length; i++) {
    downloadMarkdown(items[i]);
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

/**
 * Obsidian URI 프로토콜을 사용하여 새 노트로 연다.
 */
export function openInObsidian(item: CaptureItem): void {
  const md = exportToMarkdown(item);
  const title = item.summary
    ? item.summary.split('\n')[0].slice(0, 60)
    : 'SnapSort 캡처';

  const params = new URLSearchParams({
    name: title,
    content: md,
  });

  window.open(`obsidian://new?${params.toString()}`, '_self');
}
