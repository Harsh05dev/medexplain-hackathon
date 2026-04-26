import Anthropic from "@anthropic-ai/sdk";
import pdfParseLib from "pdf-parse/lib/pdf-parse.js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LanguageCode = "en" | "es" | "hi";
type Severity = "high" | "medium" | "low";
type AcceptedImageMediaType = "image/png" | "image/jpeg" | "image/webp";
type Provider = "gemini" | "claude";

type AnalyzeIssue = {
  severity: Severity;
  title: string;
  explanation: string;
  chargeAmount: string | null;
  law: string | null;
};

type AnalyzeResponse = {
  summary: string;
  totalAmount: string;
  issues: AnalyzeIssue[];
  fileText: string;
};

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  es: "Spanish",
  hi: "Hindi",
};

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const GEMINI_MODEL = "gemini-2.5-flash";
const CLAUDE_MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT_TEMPLATE = `You are MedExplain, a patient billing advocate. Analyze this US hospital bill and respond ONLY in valid JSON with this exact shape:
{
  "summary": "3-sentence plain-language summary in {LANGUAGE}",
  "totalAmount": "$X,XXX.XX",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "title": "short title in {LANGUAGE}",
      "explanation": "one sentence in {LANGUAGE}",
      "chargeAmount": "$XXX.XX or null",
      "law": "relevant law if applicable, else null"
    }
  ]
}
Identify 3-5 specific issues. Be specific, cite dollar amounts. Do not include any text outside the JSON.`;

function parseClaudeJson(raw: string): AnalyzeResponse {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return valid JSON.");
  }

  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as AnalyzeResponse;

  if (
    typeof parsed?.summary !== "string" ||
    typeof parsed?.totalAmount !== "string" ||
    !Array.isArray(parsed?.issues)
  ) {
    throw new Error("Response JSON missing required fields.");
  }

  return {
    summary: parsed.summary,
    totalAmount: parsed.totalAmount,
    issues: parsed.issues.map((issue) => ({
      severity:
        issue?.severity === "high" || issue?.severity === "medium" || issue?.severity === "low"
          ? issue.severity
          : "low",
      title: typeof issue?.title === "string" ? issue.title : "",
      explanation: typeof issue?.explanation === "string" ? issue.explanation : "",
      chargeAmount: typeof issue?.chargeAmount === "string" ? issue.chargeAmount : null,
      law: typeof issue?.law === "string" ? issue.law : null,
    })),
    fileText: "",
  };
}

async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  const pdfParse = pdfParseLib as (dataBuffer: Buffer) => Promise<{ text?: string }>;
  const parsed = await pdfParse(fileBuffer);
  return parsed.text?.trim() ?? "";
}

function getTextFromResponse(message: Anthropic.Messages.Message): string {
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  return text;
}

function toAcceptedImageMediaType(fileType: string): AcceptedImageMediaType | null {
  if (fileType === "image/png") return "image/png";
  if (fileType === "image/jpeg" || fileType === "image/jpg") return "image/jpeg";
  if (fileType === "image/webp") return "image/webp";
  return null;
}

function getProvider(): Provider {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (raw === "claude") return "claude";
  return "gemini";
}

function isRateLimitOrQuotaError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("quota exceeded") ||
    text.includes("rate limit") ||
    text.includes("resource_exhausted") ||
    text.includes("too many requests") ||
    text.includes("free_tier_requests")
  );
}

function isAuthError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("authentication") ||
    text.includes("invalid x-api-key") ||
    text.includes("api key not valid")
  );
}

function extractRetrySeconds(message: string): number | null {
  const match = message.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds);
}

function friendlyLimitMessage(provider: Provider, rawMessage: string): string {
  const retrySeconds = extractRetrySeconds(rawMessage);
  const providerName = provider === "gemini" ? "Gemini" : "Claude";
  const retryPart = retrySeconds ? ` Please retry in about ${retrySeconds}s.` : " Please retry shortly.";
  return `${providerName} is temporarily rate-limited or over quota.${retryPart} If this keeps happening, switch provider or upgrade your API plan.`;
}

function friendlyAuthMessage(provider: Provider): string {
  const keyName = provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
  return `Authentication failed. Check ${keyName} in .env.local and restart the server.`;
}

function hasInvalidBytes(input: string): boolean {
  return [...input].some((char) => char.charCodeAt(0) > 255);
}

function isLikelyPlaceholder(input: string, placeholder: string): boolean {
  return (
    input === "" ||
    input === placeholder ||
    input.toLowerCase().includes("placeholder") ||
    input.toLowerCase().includes("your_")
  );
}

async function callGeminiForText(input: {
  apiKey: string;
  systemPrompt: string;
  extractedText: string;
}): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `Hospital bill text:\n\n${input.extractedText}` }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    }
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini request failed.");
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim();
  return text || "";
}

async function callGeminiForImage(input: {
  apiKey: string;
  systemPrompt: string;
  mediaType: AcceptedImageMediaType;
  base64Image: string;
}): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Analyze this hospital bill image." },
              {
                inline_data: {
                  mime_type: input.mediaType,
                  data: input.base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    }
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini vision request failed.");
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim();
  return text || "";
}

export async function POST(request: Request) {
  try {
    const provider = getProvider();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";

    const formData = await request.formData();
    const file = formData.get("file");
    const language = formData.get("language");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing required file." }, { status: 400 });
    }

    if (language !== "en" && language !== "es" && language !== "hi") {
      return NextResponse.json({ error: "Invalid language selection." }, { status: 400 });
    }

    const languageName = LANGUAGE_NAMES[language];
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replaceAll("{LANGUAGE}", languageName);
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    let textResponse = "";
    let extractedFileText = "";

    if (file.type === "application/pdf") {
      const extractedText = await extractPdfText(fileBuffer);
      if (!extractedText) {
        return NextResponse.json(
          { error: "Couldn't read this file. Try a clearer scan." },
          { status: 400 }
        );
      }
      extractedFileText = extractedText;

      if (provider === "gemini") {
        if (isLikelyPlaceholder(geminiApiKey, "YOUR_GEMINI_API_KEY_HERE")) {
          return NextResponse.json(
            { error: "Set a real GEMINI_API_KEY in .env.local and restart the dev server." },
            { status: 500 }
          );
        }
        if (hasInvalidBytes(geminiApiKey)) {
          return NextResponse.json(
            { error: "GEMINI_API_KEY contains invalid characters. Paste the raw key again." },
            { status: 500 }
          );
        }
        textResponse = await callGeminiForText({
          apiKey: geminiApiKey,
          systemPrompt,
          extractedText,
        });
      } else {
        if (isLikelyPlaceholder(anthropicApiKey, "YOUR_ANTHROPIC_API_KEY_HERE")) {
          return NextResponse.json(
            { error: "Set a real ANTHROPIC_API_KEY in .env.local and restart the dev server." },
            { status: 500 }
          );
        }
        if (hasInvalidBytes(anthropicApiKey)) {
          return NextResponse.json(
            { error: "ANTHROPIC_API_KEY contains invalid characters. Paste the raw key again." },
            { status: 500 }
          );
        }

        const client = new Anthropic({ apiKey: anthropicApiKey });
        const message = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1600,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Hospital bill text:\n\n${extractedText}`,
            },
          ],
        });
        textResponse = getTextFromResponse(message);
      }
    } else if (IMAGE_TYPES.has(file.type)) {
      const base64Image = fileBuffer.toString("base64");
      const mediaType = toAcceptedImageMediaType(file.type);
      if (!mediaType) {
        return NextResponse.json(
          { error: "Unsupported file type. Please upload a PDF or image." },
          { status: 400 }
        );
      }

      if (provider === "gemini") {
        if (isLikelyPlaceholder(geminiApiKey, "YOUR_GEMINI_API_KEY_HERE")) {
          return NextResponse.json(
            { error: "Set a real GEMINI_API_KEY in .env.local and restart the dev server." },
            { status: 500 }
          );
        }
        if (hasInvalidBytes(geminiApiKey)) {
          return NextResponse.json(
            { error: "GEMINI_API_KEY contains invalid characters. Paste the raw key again." },
            { status: 500 }
          );
        }
        textResponse = await callGeminiForImage({
          apiKey: geminiApiKey,
          systemPrompt,
          mediaType,
          base64Image,
        });
      } else {
        if (isLikelyPlaceholder(anthropicApiKey, "YOUR_ANTHROPIC_API_KEY_HERE")) {
          return NextResponse.json(
            { error: "Set a real ANTHROPIC_API_KEY in .env.local and restart the dev server." },
            { status: 500 }
          );
        }
        if (hasInvalidBytes(anthropicApiKey)) {
          return NextResponse.json(
            { error: "ANTHROPIC_API_KEY contains invalid characters. Paste the raw key again." },
            { status: 500 }
          );
        }

        const client = new Anthropic({ apiKey: anthropicApiKey });
        const message = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1600,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this hospital bill image.",
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        });
        textResponse = getTextFromResponse(message);
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or image." },
        { status: 400 }
      );
    }

    if (!textResponse) {
      return NextResponse.json(
        { error: "Couldn't read this file. Try a clearer scan." },
        { status: 400 }
      );
    }

    const parsed = parseClaudeJson(textResponse);
    const fileText = extractedFileText || `Image-based bill context:\n${textResponse}`;
    parsed.fileText = fileText;
    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze this bill. Please try again.";
    const provider = getProvider();
    if (isAuthError(message)) {
      return NextResponse.json({ error: friendlyAuthMessage(provider) }, { status: 401 });
    }
    if (isRateLimitOrQuotaError(message)) {
      return NextResponse.json({ error: friendlyLimitMessage(provider, message) }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
