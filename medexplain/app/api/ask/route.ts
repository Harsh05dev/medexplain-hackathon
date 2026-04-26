import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LanguageCode = "en" | "es" | "hi";
type Provider = "gemini" | "claude";

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  es: "Spanish",
  hi: "Hindi",
};

const SYSTEM_PROMPT_TEMPLATE = `You are MedExplain, a patient billing advocate. The user has uploaded
a hospital bill (provided as context below). Answer their question in
{LANGUAGE}. Cite specific charges from the bill by dollar amount or
CPT code when relevant. Reference patient rights laws when applicable
(No Surprises Act, IRS 501(r) for nonprofit hospitals, 45 CFR 164.524
for itemized billing rights). Keep answers under 4 sentences. Always
end with: 'Verify with a healthcare advocate. This is not legal advice.'

BILL CONTEXT:
{fileText}`;

const REQUIRED_ENDING = "Verify with a healthcare advocate. This is not legal advice.";
const GEMINI_MODEL = "gemini-2.5-flash";
const CLAUDE_MODEL = "claude-sonnet-4-5";

function hasInvalidBytes(input: string): boolean {
  return [...input].some((char) => char.charCodeAt(0) > 255);
}

function isLikelyPlaceholder(input: string): boolean {
  return (
    input === "" ||
    input === "YOUR_ANTHROPIC_API_KEY_HERE" ||
    input === "YOUR_GEMINI_API_KEY_HERE" ||
    input.toLowerCase().includes("placeholder") ||
    input.toLowerCase().includes("your_")
  );
}

function getTextFromResponse(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
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

async function callGemini(input: {
  apiKey: string;
  systemPrompt: string;
  question: string;
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
            parts: [{ text: input.question }],
          },
        ],
        generationConfig: {
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

export async function POST(request: Request) {
  try {
    const provider = getProvider();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";

    const body = (await request.json()) as {
      fileText?: string;
      question?: string;
      language?: LanguageCode;
    };

    if (
      typeof body.fileText !== "string" ||
      typeof body.question !== "string" ||
      (body.language !== "en" && body.language !== "es" && body.language !== "hi")
    ) {
      return NextResponse.json(
        { error: "Invalid request. Expected { fileText, question, language }." },
        { status: 400 }
      );
    }

    const fileText = body.fileText.trim();
    const question = body.question.trim();

    if (!fileText) {
      return NextResponse.json({ error: "Missing bill context." }, { status: 400 });
    }

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const languageName = LANGUAGE_NAMES[body.language];
    const system = SYSTEM_PROMPT_TEMPLATE.replace("{LANGUAGE}", languageName).replace(
      "{fileText}",
      fileText
    );

    let answer = "";

    if (provider === "gemini") {
      if (isLikelyPlaceholder(geminiApiKey)) {
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
      answer = await callGemini({
        apiKey: geminiApiKey,
        systemPrompt: system,
        question,
      });
    } else {
      if (isLikelyPlaceholder(anthropicApiKey)) {
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
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: question }],
      });

      answer = getTextFromResponse(message);
    }

    if (!answer) {
      return NextResponse.json({ error: "No answer returned. Please try again." }, { status: 500 });
    }

    if (!answer.endsWith(REQUIRED_ENDING)) {
      answer = `${answer.replace(/\s+$/, "")} ${REQUIRED_ENDING}`;
    }

    return NextResponse.json({ answer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to answer question. Please try again.";
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
