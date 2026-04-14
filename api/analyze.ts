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

const PROMPT = `SNS 스크린샷에서 핵심만 추출. UI요소(상태바,네비,프로필,좋아요,광고) 무시. 여러장이면 합쳐서 하나로. 간결하게 응답. 순수 JSON만:
{"raw_text":"전체텍스트","cleaned_text":"핵심만","summary":"1~2줄요약","tags":["태그"],"source_app":"쓰레드/페이스북/인스타/X/기타","confidence":0.9}`;

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
  const prefixMatch = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (!prefixMatch) throw new Error("Invalid image data URI");

  const mimeType = prefixMatch[1];
  const data = input.slice(prefixMatch[0].length);
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

  // 개인용 앱 - 인증 생략

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
          maxOutputTokens: 2048,
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
