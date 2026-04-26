import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LanguageCode = "en" | "es" | "hi";

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  es: "Spanish",
  hi: "Hindi",
};

const SYSTEM_PROMPT_TEMPLATE = `You are MedExplain, a patient billing advocate. Write a professional
appeal letter from the patient to the hospital billing department.

Goal: {goal}

The letter MUST:
- Be addressed to 'Hospital Billing Department'
- Reference the specific charges and amounts from the bill
- Cite 45 CFR 164.524 for itemized billing rights
- Cite IRS 501(r) if hospital appears non-profit
- Cite the No Surprises Act if relevant
- Request a written response within 30 days
- Tone: firm, professional, informed - not angry
- End with space for patient signature

Return ONLY valid JSON with this exact shape:
{
  "englishLetter": "full letter in English",
  "translatedLetter": "full letter in {LANGUAGE} (if language is en, repeat the English letter here)"
}

CRITICAL: The "translatedLetter" field MUST be written ENTIRELY in
{LANGUAGE} language. Every single word must be translated.
If language is "hi" (Hindi), write the COMPLETE letter in Hindi using
Devanagari script only. If "es" (Spanish), write entirely in Spanish.
If "en", repeat the English letter.
DO NOT mix languages. DO NOT leave any English in translatedLetter
when the target language is not English.

BILL CONTEXT: {fileText}`;
const GEMINI_MODEL = "gemini-2.5-flash";

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
  return text.includes("authentication") || text.includes("api key not valid");
}

function extractRetrySeconds(message: string): number | null {
  const match = message.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds);
}

function friendlyLimitMessage(rawMessage: string): string {
  const retrySeconds = extractRetrySeconds(rawMessage);
  const retryPart = retrySeconds ? ` Please retry in about ${retrySeconds}s.` : " Please retry shortly.";
  return `Gemini is temporarily rate-limited or over quota.${retryPart} If this keeps happening, upgrade your Gemini API plan or wait for quota reset.`;
}

function friendlyAuthMessage(): string {
  return "Authentication failed. Check GEMINI_API_KEY in .env.local and restart the server.";
}

function hasInvalidBytes(input: string): boolean {
  return [...input].some((char) => char.charCodeAt(0) > 255);
}

function isLikelyPlaceholder(input: string): boolean {
  return (
    input === "" ||
    input === "YOUR_GEMINI_API_KEY_HERE" ||
    input.toLowerCase().includes("placeholder") ||
    input.toLowerCase().includes("your_")
  );
}

async function callGemini(input: { apiKey: string; systemPrompt: string }): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: [{ role: "user", parts: [{ text: "Generate the letter now." }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    }
  );

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini request failed.");
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim();
  return text || "";
}

function parseLetterResponse(raw: string): { englishLetter: string; translatedLetter: string } {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return valid JSON.");
  }

  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
    englishLetter?: string;
    translatedLetter?: string;
  };

  if (typeof parsed.englishLetter !== "string" || typeof parsed.translatedLetter !== "string") {
    throw new Error("Response JSON missing letter fields.");
  }

  return {
    englishLetter: parsed.englishLetter.trim(),
    translatedLetter: parsed.translatedLetter.trim(),
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
    if (isLikelyPlaceholder(apiKey)) {
      return NextResponse.json(
        { error: "Set a real GEMINI_API_KEY in .env.local and restart the dev server." },
        { status: 500 }
      );
    }

    if (hasInvalidBytes(apiKey)) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY contains invalid characters. Paste the raw key again." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      fileText?: string;
      goal?: string;
      language?: LanguageCode;
      patientName?: string;
    };

    if (
      typeof body.fileText !== "string" ||
      typeof body.goal !== "string" ||
      (body.language !== "en" && body.language !== "es" && body.language !== "hi")
    ) {
      return NextResponse.json(
        { error: "Invalid request. Expected { fileText, goal, language, patientName? }." },
        { status: 400 }
      );
    }

    const fileText = body.fileText.trim();
    const goal = body.goal.trim();
    const patientName = (body.patientName ?? "").trim();

    if (!fileText) {
      return NextResponse.json({ error: "Missing bill context." }, { status: 400 });
    }

    if (!goal) {
      return NextResponse.json({ error: "Goal is required." }, { status: 400 });
    }

    const languageName = LANGUAGE_NAMES[body.language];
    const goalWithName = patientName ? `${goal}. Patient name: ${patientName}.` : goal;
    const system = SYSTEM_PROMPT_TEMPLATE.replace("{goal}", goalWithName)
      .replace("{LANGUAGE}", languageName)
      .replace("{fileText}", fileText);

    const rawText = await callGemini({ apiKey, systemPrompt: system });
    if (!rawText) {
      return NextResponse.json({ error: "No letter returned. Please try again." }, { status: 500 });
    }

    const parsed = parseLetterResponse(rawText);
    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate letter. Please try again.";
    if (isAuthError(message)) {
      return NextResponse.json({ error: friendlyAuthMessage() }, { status: 401 });
    }
    if (isRateLimitOrQuotaError(message)) {
      return NextResponse.json({ error: friendlyLimitMessage(message) }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
