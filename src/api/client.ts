export interface AnalysisResult {
  raw_text: string;
  cleaned_text: string;
  summary: string;
  tags: string[];
  source_app: string;
  confidence: number;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

// 이미지를 최대 1200px 너비로 리사이즈 + JPEG 압축 (API 전송 최적화)
async function resizeForApi(blob: Blob): Promise<Blob> {
  const MAX_WIDTH = 600; // 작을수록 빠름, OCR에는 충분
  try {
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width <= MAX_WIDTH) {
      bitmap.close();
      return blob; // 이미 작으면 그대로
    }
    const scale = MAX_WIDTH / bitmap.width;
    const w = MAX_WIDTH;
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return blob; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b ?? blob),
        'image/jpeg',
        0.4 // 낮은 품질 = 빠른 전송, OCR에는 충분
      );
    });
  } catch {
    return blob; // 리사이즈 실패 시 원본
  }
}

export async function analyzeScreenshots(
  images: Blob[],
): Promise<AnalysisResult> {
  if (images.length === 0) {
    throw new Error("At least one image is required");
  }

  const resized = await Promise.all(images.map(resizeForApi));
  const base64Images = await Promise.all(resized.map(blobToBase64));

  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: base64Images }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; rawPreview?: string };
    const msg = body.error ?? `Request failed with status ${response.status}`;
    throw new Error(body.rawPreview ? `${msg} [${body.rawPreview.substring(0, 100)}]` : msg);
  }

  return (await response.json()) as AnalysisResult;
}
