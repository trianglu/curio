import {
  aiCompactPathResponseSchema,
  aiExpansionResponseSchema,
  aiPathResponseSchema,
  type AiExpansionResponse,
  type AiPathResponse,
} from "./schemas";
import { normalizeExpansionResponse, normalizePathResponse } from "./normalize";
import { ACCURACY_SYSTEM_PROMPT, EXPANSION_SYSTEM_PROMPT } from "./prompts";

export type AiProvider = "groq" | "gemini" | "none";

export type AiErrorCode = "rate_limit" | "api_error" | "validation_failed" | "not_configured";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface AiCallResult {
  raw: string | null;
  errorCode?: AiErrorCode;
  errorMessage?: string;
  /** Groq/Gemini retry-after hint in milliseconds, when available. */
  retryAfterMs?: number;
}

type AiError = { error: AiErrorCode; message: string; retryAfterMs?: number };

const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"] as const;

/** Groq free tier is 6K TPM — one 5-lesson path can exceed that in a single request. */
const GROQ_EXPANSION_MODELS = ["llama-3.1-8b-instant"] as const;

/** Lite first — separate daily quota (2.5-flash free tier is only ~20 req/day per project). */
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

function parseRetryAfterMs(response: Response, bodyText: string): number | undefined {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  }
  const match =
    bodyText.match(/try again in ([\d.]+)s/i) ??
    bodyText.match(/retry in ([\d.]+)s/i);
  if (match) {
    const seconds = Number(match[1]);
    if (!Number.isNaN(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  }
  return undefined;
}

async function callGroq(
  messages: ChatMessage[],
  model: string,
  maxTokens = 6000,
): Promise<AiCallResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { raw: null };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Groq API error (${model}):`, text);
    const retryAfterMs = parseRetryAfterMs(response, text);
    if (text.includes("rate_limit") || text.includes("Rate limit")) {
      const tooLarge = text.includes("Request too large");
      return {
        raw: null,
        errorCode: "rate_limit",
        errorMessage: tooLarge
          ? "Groq request too large for free tier (6K token cap per request)"
          : retryAfterMs
            ? `Groq token limit — try again in ~${Math.ceil(retryAfterMs / 1000)}s`
            : "Groq rate limit — wait ~1 min and try again",
        retryAfterMs,
      };
    }
    return { raw: null, errorCode: "api_error", errorMessage: "Groq API request failed" };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return { raw: data.choices?.[0]?.message?.content ?? null };
}

async function callGemini(
  messages: ChatMessage[],
  maxTokens = 6000,
  model: string = GEMINI_MODELS[0],
): Promise<AiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { raw: null };

  const systemContent =
    messages.find((m) => m.role === "system")?.content ?? ACCURACY_SYSTEM_PROMPT;
  const userContent = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemContent }] },
        contents: [{ parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`Gemini API error (${model}):`, text);
    const retryAfterMs = parseRetryAfterMs(response, text);
    if (text.includes("429") || text.includes("RESOURCE_EXHAUSTED") || text.includes("quota")) {
      return {
        raw: null,
        errorCode: "rate_limit",
        errorMessage: `Gemini quota exceeded (${model})`,
        retryAfterMs,
      };
    }
    return {
      raw: null,
      errorCode: "api_error",
      errorMessage: `Gemini API request failed (${model})`,
    };
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return { raw: data.candidates?.[0]?.content?.parts?.[0]?.text ?? null };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

interface GenerateAiOptions {
  systemPrompt?: string;
  maxTokens?: number;
  models?: readonly string[];
  /** Which provider to try first when both are configured. */
  prefer?: AiProvider;
  /** Skip Groq fallback — use when Groq TPM cannot fit the request (expansion). */
  geminiOnly?: boolean;
  /** Skip Gemini fallback — use for compact Groq path generation. */
  groqOnly?: boolean;
}

function mergeErrors(current: AiError | null, next: AiCallResult): AiError {
  const error = next.errorCode ?? "api_error";
  return {
    error,
    message: next.errorMessage ?? "AI generation failed",
    retryAfterMs: next.retryAfterMs ?? current?.retryAfterMs,
  };
}

async function tryGroq<T>(
  messages: ChatMessage[],
  models: readonly string[],
  maxTokens: number,
  schema: { parse: (data: unknown) => T },
  normalize: (data: unknown) => unknown,
): Promise<{ data: T } | { error: AiError }> {
  let lastError: AiError | null = null;

  for (const model of models) {
    if (!process.env.GROQ_API_KEY) break;
    const result = await callGroq(messages, model, maxTokens);
    if (result.errorCode) {
      lastError = mergeErrors(lastError, result);
      if (result.errorCode === "rate_limit") break;
      continue;
    }
    if (result.raw) {
      try {
        const parsed = schema.parse(normalize(JSON.parse(extractJson(result.raw))));
        return { data: parsed };
      } catch (error) {
        console.error(`AI validation error (${model}):`, error);
        lastError = { error: "validation_failed", message: "Generation incomplete — wait ~1 min and try again" };
      }
    }
  }

  return { error: lastError ?? { error: "api_error", message: "Groq generation failed" } };
}

async function tryGemini<T>(
  messages: ChatMessage[],
  maxTokens: number,
  schema: { parse: (data: unknown) => T },
  normalize: (data: unknown) => unknown,
): Promise<{ data: T } | { error: AiError }> {
  if (!process.env.GEMINI_API_KEY) {
    return { error: { error: "not_configured", message: "Gemini not configured" } };
  }

  let lastError: AiError | null = null;
  const failureMessages: string[] = [];

  for (const model of GEMINI_MODELS) {
    const result = await callGemini(messages, maxTokens, model);
    if (result.errorCode) {
      if (result.errorMessage) failureMessages.push(result.errorMessage);
      lastError = mergeErrors(lastError, result);
      if (result.errorCode === "rate_limit") continue;
      continue;
    }
    if (result.raw) {
      try {
        const parsed = schema.parse(normalize(JSON.parse(extractJson(result.raw))));
        return { data: parsed };
      } catch (error) {
        console.error(`Gemini validation error (${model}):`, error);
        failureMessages.push(`Response format invalid (${model})`);
        lastError = { error: "validation_failed", message: `AI response format invalid (${model})` };
        continue;
      }
    }
  }

  if (!lastError) {
    return { error: { error: "api_error", message: "Gemini generation failed" } };
  }

  return {
    error: {
      ...lastError,
      message:
        failureMessages.length > 1
          ? `Tried ${GEMINI_MODELS.join(" → ")}: ${failureMessages.join("; then ")}`
          : lastError.message,
    },
  };
}

export async function generateAiJson<T>(
  userPrompt: string,
  schema: { parse: (data: unknown) => T },
  normalize: (data: unknown) => unknown,
  options: GenerateAiOptions = {},
): Promise<
  | { data: T; provider: AiProvider }
  | { error: AiErrorCode; message: string; retryAfterMs?: number }
> {
  const systemPrompt = options.systemPrompt ?? ACCURACY_SYSTEM_PROMPT;
  const maxTokens = options.maxTokens ?? 6000;
  const models = options.models ?? GROQ_MODELS;
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const prefer =
    options.prefer ??
    (hasGroq ? "groq" : hasGemini ? "gemini" : "none");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const providers: AiProvider[] =
    options.groqOnly && hasGroq
      ? (["groq"] as const)
      : options.geminiOnly && hasGemini
        ? (["gemini"] as const)
        : prefer === "gemini"
          ? (["gemini", "groq"] as const)
          : (["groq", "gemini"] as const);

  let lastError: AiError | null = null;
  const failureMessages: string[] = [];

  for (const provider of providers) {
    if (provider === "groq" && !hasGroq) continue;
    if (provider === "gemini" && !hasGemini) continue;

    const attempt =
      provider === "groq"
        ? await tryGroq(messages, models, maxTokens, schema, normalize)
        : await tryGemini(messages, maxTokens, schema, normalize);

    if ("data" in attempt) {
      return { data: attempt.data, provider };
    }

    failureMessages.push(attempt.error.message);
    const retryAfterMs = Math.max(
      lastError?.retryAfterMs ?? 0,
      attempt.error.retryAfterMs ?? 0,
    );
    lastError = {
      ...attempt.error,
      retryAfterMs: retryAfterMs > 0 ? retryAfterMs : undefined,
    };
    if (attempt.error.error === "validation_failed") break;
  }

  if (!lastError) {
    return { error: "api_error", message: "AI generation failed" };
  }

  return {
    error: lastError.error,
    message:
      failureMessages.length > 1
        ? `${failureMessages.join("; then ")} — wait a minute and retry`
        : lastError.message,
    retryAfterMs: lastError.retryAfterMs,
  };
}

export async function generateInitialPath(
  subject: string,
): Promise<
  | { data: AiPathResponse; provider: AiProvider }
  | { error: AiErrorCode; message: string; retryAfterMs?: number }
> {
  const { buildInitialPathPrompt, buildInitialPathPromptCompact, GROQ_COMPACT_SYSTEM_PROMPT } =
    await import("./prompts");
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (hasGemini) {
    const gemini = await generateAiJson(
      buildInitialPathPrompt(subject),
      aiPathResponseSchema,
      normalizePathResponse,
      {
        maxTokens: 16_000,
        models: GROQ_EXPANSION_MODELS,
        prefer: "gemini",
        geminiOnly: true,
      },
    );
    if (!("error" in gemini)) return gemini;
    if (!hasGroq || (gemini.error !== "rate_limit" && gemini.error !== "api_error")) {
      return {
        ...gemini,
        message:
          gemini.error === "rate_limit"
            ? `${gemini.message} — Gemini free tier allows ~20 requests/day per Google project. Try again tomorrow, use a different Google account, or enable billing at aistudio.google.com.`
            : gemini.message,
      };
    }
    console.warn("Curio: Gemini unavailable, falling back to Groq for initial path");
  }

  if (!hasGroq) {
    return { error: "not_configured", message: "No AI provider available" };
  }

  return generateAiJson(
    buildInitialPathPromptCompact(subject),
    aiCompactPathResponseSchema,
    normalizePathResponse,
    {
      systemPrompt: GROQ_COMPACT_SYSTEM_PROMPT,
      maxTokens: 3_800,
      models: GROQ_EXPANSION_MODELS,
      prefer: "groq",
      groqOnly: true,
    },
  );
}

export async function generateExpansion(
  subject: string,
  existingTitles: string[],
  depth: number,
): Promise<
  | { data: AiExpansionResponse; provider: AiProvider }
  | { error: AiErrorCode; message: string; retryAfterMs?: number }
> {
  const { buildExpansionPrompt } = await import("./prompts");
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  return generateAiJson(
    buildExpansionPrompt(subject, existingTitles, depth),
    aiExpansionResponseSchema,
    normalizeExpansionResponse,
    {
      systemPrompt: EXPANSION_SYSTEM_PROMPT,
      maxTokens: hasGemini ? 12_000 : 8_000,
      models: GROQ_EXPANSION_MODELS,
      prefer: hasGemini ? "gemini" : "groq",
    },
  );
}

export async function generatePathUpgrade(
  subject: string,
  lessons: Array<{ title: string; type: string; content: { summary: string; body: string; question?: unknown } }>,
  unitCount: number,
): Promise<
  | { data: import("./schemas").AiPathUpgradeResponse; provider: AiProvider }
  | { error: AiErrorCode; message: string; retryAfterMs?: number }
> {
  const { buildPathUpgradePrompt, PATH_UPGRADE_SYSTEM_PROMPT, summarizePathForUpgrade } =
    await import("./prompts");
  const { aiPathUpgradeResponseSchema } = await import("./schemas");
  const { normalizePathUpgradeResponse } = await import("./normalize");

  if (!process.env.GEMINI_API_KEY) {
    return { error: "not_configured", message: "Gemini not configured" };
  }

  return generateAiJson(
    buildPathUpgradePrompt(subject, summarizePathForUpgrade(lessons), unitCount),
    aiPathUpgradeResponseSchema,
    normalizePathUpgradeResponse,
    {
      systemPrompt: PATH_UPGRADE_SYSTEM_PROMPT,
      maxTokens: 16_000,
      prefer: "gemini",
      geminiOnly: true,
    },
  );
}

export function getConfiguredProviders(): AiProvider[] {
  const providers: AiProvider[] = [];
  if (process.env.GROQ_API_KEY) providers.push("groq");
  if (process.env.GEMINI_API_KEY) providers.push("gemini");
  return providers;
}
