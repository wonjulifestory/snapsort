import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const APP_API_TOKEN = process.env.APP_API_TOKEN;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image

const ALLOWED_ORIGINS = new Set([
  process.env.ALLOWED_ORIGIN ?? "https://snapsort.vercel.app",
  "http://localhost:5173",
]);

const PROMPT = `이 SNS 스크린샷에서 핵심 정보만 추출해주세요. 상태바, 네비게이션, 프로필 사진, 좋아요/댓글 수, 광고 등 UI 요소는 무시하세요.

여러 장의 이미지가 제공된 경우, 같은 글의 연속된 스크린샷인지 판단하세요. 같은 글이면 내용을 합쳐서 하나의 결과로 반환하세요.

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
{
  "raw_text": "이미지에서 읽은 전체 텍스트",
  "cleaned_text": "UI 잡음을 제거한 핵심 정보 텍스트",
  "summary": "2~3줄 요약",
  "tags": ["태그1", "태그2"],
  "source_app": "쓰레드/페이스북/인스타그램/X/기타",
  "confidence": 0.0
}`;

interface AnalysisResult {
  raw_text: string;
  cleaned_text: string;
  summary: string;
  tags: string[];
  source_app: string;
  confidence: number;
}

function isAnalysisResult(v: unknown): v is AnalysisResult {
  const x = v as AnalysisResult;
  return (
    !!x &&
    typeof x.raw_text === "string" &&
    typeof x.cleaned_text === "string" &&
    typeof x.summary === "string" &&
    Array.isArray(x.tags) &&
    x.tags.every((t) => typeof t === "string") &&
    typeof x.source_app === "string" &&
    typeof x.confidence === "number" &&
    x.confidence >= 0 &&
    x.confidence <= 1
  );
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-App-Token");
}

function parseDataUri(input: string): { mimeType: string; data: string } {
  const match = input.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!match) throw new Error("Invalid image data URI");

  const [, mimeType, data] = match;
  const sizeEstimate = Math.ceil((data.length * 3) / 4);
  if (sizeEstimate > MAX_IMAGE_BYTES) throw new Error("Image too large (max 5MB)");

  return { mimeType, data };
}

interface RequestBody {
  images: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authentication: require app token
  const token = req.headers["x-app-token"];
  if (!APP_API_TOKEN || token !== APP_API_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { images } = req.body as RequestBody;

    if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
      return res
        .status(400)
        .json({ error: `1~${MAX_IMAGES}장의 이미지가 필요합니다` });
    }

    // Build Gemini request parts with validation
    const parts: Record<string, unknown>[] = [{ text: PROMPT }];

    for (const base64Image of images) {
      const { mimeType, data } = parseDataUri(base64Image);
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data,
        },
      });
    }

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorBody);
      return res.status(502).json({ error: "AI 처리에 실패했습니다" });
    }

    const geminiData = await geminiResponse.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Parse and validate JSON response
    const jsonString = rawText.replace(/```json\s*|```\s*/g, "").trim();
    const parsed: unknown = JSON.parse(jsonString);

    if (!isAnalysisResult(parsed)) {
      return res.status(502).json({ error: "AI 응답 형식이 올바르지 않습니다" });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("analyze error:", error);

    if (error instanceof SyntaxError) {
      return res.status(502).json({ error: "AI 응답을 파싱할 수 없습니다" });
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Invalid image") || message.includes("too large")) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
}
