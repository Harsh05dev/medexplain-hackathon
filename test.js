import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const rawApiKey = process.env.ANTHROPIC_API_KEY;
const apiKey = rawApiKey?.trim();

console.log("API KEY:", apiKey ? "Loaded" : "Missing");

if (!apiKey) {
  console.error(
    "Missing ANTHROPIC_API_KEY in .env. Add a valid key and re-run `node test.js`."
  );
  process.exit(1);
}

if (!apiKey.startsWith("sk-ant-")) {
  console.error(
    "ANTHROPIC_API_KEY looks invalid (expected to start with 'sk-ant-'). Check your .env value."
  );
  process.exit(1);
}

const client = new Anthropic({
  apiKey,
});

async function test() {
  console.log("Starting test...");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{ role: "user", content: "Say hello in one sentence" }],
    });

    console.log("Response:", msg.content);
  } catch (err) {
    if (err?.status === 401) {
      console.error(
        "Authentication failed (401). Your ANTHROPIC_API_KEY is invalid or expired."
      );
      return;
    }

    console.error("Request failed:", err?.message ?? err);
  }
}

test();