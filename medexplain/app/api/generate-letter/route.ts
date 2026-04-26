import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LanguageCode = "en" | "es" | "hi";

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  es: "Spanish",
  hi: "Hindi",
};

const CLAUDE_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;
const MAX_FILE_TEXT_CHARS = 4000;

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

Use the generate_letter tool to return both letters.

The "translatedLetter" MUST be written ENTIRELY in {LANGUAGE}.
If "hi" (Hindi): Devanagari script only. If "es": Spanish only. If "en": repeat English letter.
DO NOT mix languages.

BILL CONTEXT: {fileText}`;

function hasInvalidBytes(input: string): boolean {
  return [...input].some((char) => char.charCodeAt(0) > 255);
}

function isLikelyPlaceholder(input: string): boolean {
  return (
    input === "" ||
    input.toLowerCase().includes("placeholder") ||
    input.toLowerCase().includes("your_")
  );
}

function parseLetterResponse(raw: string): { englishLetter: string; translatedLetter: string } {
  // Strip markdown code fences if present
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return valid JSON.");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
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
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";

    if (isLikelyPlaceholder(anthropicApiKey)) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured. Set it in .env.local and restart." },
        { status: 500 }
      );
    }

    if (hasInvalidBytes(anthropicApiKey)) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY contains invalid characters. Paste the raw key again." },
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

    const fileText = body.fileText.trim().slice(0, MAX_FILE_TEXT_CHARS);
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
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace("{goal}", goalWithName)
      .replace("{LANGUAGE}", languageName)
      .replace("{LANGUAGE}", languageName)
      .replace("{fileText}", fileText);

    const client = new Anthropic({ apiKey: anthropicApiKey });
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: [
        {
          name: "generate_letter",
          description: "Generate the English and translated appeal letters.",
          input_schema: {
            type: "object" as const,
            properties: {
              englishLetter: { type: "string", description: "Full appeal letter in English" },
              translatedLetter: { type: "string", description: "Full appeal letter in the target language" },
            },
            required: ["englishLetter", "translatedLetter"],
          },
        },
      ],
      tool_choice: { type: "tool" as const, name: "generate_letter" },
      messages: [{ role: "user", content: "Generate the letter now." }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use") as
      | { type: "tool_use"; input: { englishLetter?: string; translatedLetter?: string } }
      | undefined;

    if (!toolBlock?.input?.englishLetter || !toolBlock?.input?.translatedLetter) {
      const debug = JSON.stringify({ stop_reason: response.stop_reason, content: response.content });
      return NextResponse.json({ error: `No letter returned. Debug: ${debug}` }, { status: 500 });
    }

    return NextResponse.json({
      englishLetter: toolBlock.input.englishLetter.trim(),
      translatedLetter: toolBlock.input.translatedLetter.trim(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate letter. Please try again.";

    if (message.toLowerCase().includes("rate_limit") || message.toLowerCase().includes("overloaded")) {
      return NextResponse.json(
        { error: "Claude is rate-limited. Please retry in a moment." },
        { status: 429 }
      );
    }

    if (message.toLowerCase().includes("authentication") || message.toLowerCase().includes("api key")) {
      return NextResponse.json(
        { error: "Authentication failed. Check ANTHROPIC_API_KEY." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
