import {
  aiExpansionResponseSchema,
  aiPathResponseSchema,
  type AiExpansionResponse,
  type AiPathResponse,
} from "./schemas";
import { ACCURACY_SYSTEM_PROMPT } from "./prompts";

export type AiProvider = "groq" | "gemini" | "none";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

async function callGroq(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.3,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    console.error("Groq API error:", await response.text());
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

async function callGemini(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const userContent = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ACCURACY_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    console.error("Gemini API error:", await response.text());
    return null;
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

export async function generateAiJson<T>(
  userPrompt: string,
  schema: { parse: (data: unknown) => T },
): Promise<{ data: T; provider: AiProvider } | null> {
  const messages: ChatMessage[] = [
    { role: "system", content: ACCURACY_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let raw: string | null = null;
  let provider: AiProvider = "none";

  raw = await callGroq(messages);
  if (raw) {
    provider = "groq";
  } else {
    raw = await callGemini(messages);
    if (raw) provider = "gemini";
  }

  if (!raw) return null;

  try {
    const parsed = schema.parse(JSON.parse(extractJson(raw)));
    return { data: parsed, provider };
  } catch (error) {
    console.error("AI JSON parse/validation error:", error);
    return null;
  }
}

export async function generateInitialPath(
  subject: string,
  mode: string,
): Promise<{ data: AiPathResponse; provider: AiProvider } | null> {
  const { buildInitialPathPrompt } = await import("./prompts");
  return generateAiJson(buildInitialPathPrompt(subject, mode), aiPathResponseSchema);
}

export async function generateExpansion(
  subject: string,
  mode: string,
  existingTitles: string[],
  depth: number,
): Promise<{ data: AiExpansionResponse; provider: AiProvider } | null> {
  const { buildExpansionPrompt } = await import("./prompts");
  return generateAiJson(
    buildExpansionPrompt(subject, mode, existingTitles, depth),
    aiExpansionResponseSchema,
  );
}

export function getConfiguredProviders(): AiProvider[] {
  const providers: AiProvider[] = [];
  if (process.env.GROQ_API_KEY) providers.push("groq");
  if (process.env.GEMINI_API_KEY) providers.push("gemini");
  return providers;
}
