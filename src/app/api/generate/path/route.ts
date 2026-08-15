import { NextResponse } from "next/server";
import { generateInitialPath, getConfiguredProviders } from "@/lib/ai/client";
import { aiResponseToPath } from "@/lib/ai/transform";
import { readCachedPath, writeCachedPath } from "@/lib/content-cache";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { subject?: string; bypassCache?: boolean };
    const subject = body.subject?.trim();

    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!body.bypassCache) {
      const cached = await readCachedPath(subject);
      if (cached) {
        return NextResponse.json({
          path: aiResponseToPath(subject, cached.data, cached.provider),
          provider: cached.provider,
          aiGenerated: true,
          cached: true,
          cachedAt: cached.generatedAt,
        });
      }
    }

    const providers = getConfiguredProviders();
    if (providers.length === 0) {
      return NextResponse.json(
        {
          error:
            "AI is required to generate real lesson content. Add GROQ_API_KEY or GEMINI_API_KEY to .env.local and restart the dev server.",
          code: "AI_NOT_CONFIGURED",
          setup: {
            groq: "https://console.groq.com — free tier",
            gemini: "https://aistudio.google.com/apikey — free tier",
          },
        },
        { status: 503 },
      );
    }

    const result = await generateInitialPath(subject);

    if ("error" in result) {
      const status = result.error === "rate_limit" ? 429 : 502;
      return NextResponse.json(
        {
          error: result.message,
          code: result.error,
          retryAfterMs: result.retryAfterMs,
          hint:
            result.error === "rate_limit"
              ? "Gemini free tier has a ~20 requests/day limit per Google project (new keys share the same quota). Curio will try Groq automatically when configured — restart the dev server after changing .env.local."
              : "Your API key works, but the AI response could not be parsed. Try again.",
        },
        { status },
      );
    }

    const provider = result.provider === "groq" ? "groq" : "gemini";
    const path = aiResponseToPath(subject, result.data, provider);
    await writeCachedPath(subject, result.data, provider);

    return NextResponse.json({
      path,
      provider: result.provider,
      aiGenerated: true,
      cached: false,
    });
  } catch (error) {
    console.error("Path generation error:", error);
    return NextResponse.json({ error: "Failed to generate learning path" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    configuredProviders: getConfiguredProviders(),
    hasAi: getConfiguredProviders().length > 0,
  });
}
