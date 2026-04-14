export interface AnalysisResult {
  raw_text: string;
  cleaned_text: string;
  summary: string;
  tags: string[];
  source_app: string;
  confidence: number;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const APP_API_TOKEN = import.meta.env.VITE_APP_API_TOKEN ?? "";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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
  const MAX_WIDTH = 1200;
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
        0.85
      );
    });
  } catch {
    return blob; // 리사이즈 실패 시 원본
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeScreenshots(
  images: Blob[],
): Promise<AnalysisResult> {
  if (images.length === 0) {
    throw new Error("At least one image is required");
  }

  // Resize and convert to base64
  const resized = await Promise.all(images.map(resizeForApi));
  const base64Images = await Promise.all(resized.map(blobToBase64));

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS * attempt);
      }

      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Token": APP_API_TOKEN,
        },
        body: JSON.stringify({ images: base64Images }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
            `Request failed with status ${response.status}`,
        );
      }

      return (await response.json()) as AnalysisResult;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt + 1} failed:`, lastError.message);

      // Don't retry on client errors (4xx) or auth errors
      if (
        lastError.message.includes("Unauthorized") ||
        lastError.message.includes("status 4")
      ) {
        break;
      }
    }
  }

  throw lastError ?? new Error("Analysis failed");
}
