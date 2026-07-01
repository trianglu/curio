import { NextResponse } from "next/server";
import { generateInitialPath, getConfiguredProviders } from "@/lib/ai/client";
import { aiResponseToPath } from "@/lib/ai/transform";
import { generateInitialPath as mockInitialPath } from "@/lib/mock-generator";
import type { LearningMode } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { subject?: string; mode?: LearningMode };
    const subject = body.subject?.trim();
    const mode = body.mode ?? "passive";

    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    const result = await generateInitialPath(subject, mode);

    if (result) {
      const path = aiResponseToPath(subject, mode, result.data);
      return NextResponse.json({
        path,
        provider: result.provider,
        aiGenerated: true,
      });
    }

    const path = mockInitialPath(subject, mode);
    return NextResponse.json({
      path: { ...path, aiGenerated: false },
      provider: "none",
      aiGenerated: false,
      warning:
        "No AI API key configured. Using template content. Add GROQ_API_KEY or GEMINI_API_KEY to .env.local for real generation.",
      configuredProviders: getConfiguredProviders(),
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
