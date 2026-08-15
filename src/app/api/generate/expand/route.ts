import { NextResponse } from "next/server";
import { generateExpansion } from "@/lib/ai/client";
import { isExpansionStopResponse } from "@/lib/ai/schemas";
import { aiExpansionToUnit, getExistingLessonTitles } from "@/lib/ai/transform";
import { readCachedExpansion, writeCachedExpansion } from "@/lib/content-cache";
import type { LearningPath } from "@/lib/types";

interface ExpandRequestBody {
  path?: LearningPath;
  pathId?: string;
  subject?: string;
  expansionDepth?: number;
  existingTitles?: string[];
  aiGenerated?: boolean;
  unitCount?: number;
  bypassCache?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExpandRequestBody;

    const path = body.path;
    const subject = body.subject ?? path?.subject;
    const aiGenerated = body.aiGenerated ?? path?.aiGenerated;
    const expansionDepth = body.expansionDepth ?? path?.expansionDepth ?? 0;
    const pathId = body.pathId ?? path?.id;

    if (!subject || !pathId) {
      return NextResponse.json({ error: "Subject and pathId are required" }, { status: 400 });
    }

    if (!aiGenerated) {
      return NextResponse.json({ error: "Path not AI-generated yet" }, { status: 400 });
    }

    const existingTitles =
      body.existingTitles ?? (path ? getExistingLessonTitles(path) : []);

    const depth = Math.min(expansionDepth + 1, 4);

    const pathContext = path ?? {
      id: pathId,
      unitCount: body.unitCount ?? 0,
      lessonCount: existingTitles.length,
    };

    if (!body.bypassCache) {
      const cached = await readCachedExpansion(subject, depth, existingTitles);
      if (cached) {
        if (isExpansionStopResponse(cached.data)) {
          return NextResponse.json({
            exhausted: true,
            reason: cached.data.stopReason,
            provider: cached.provider,
            cached: true,
          });
        }
        return NextResponse.json({
          unit: aiExpansionToUnit(pathContext, cached.data),
          provider: cached.provider,
          aiGenerated: true,
          cached: true,
          cachedAt: cached.generatedAt,
        });
      }
    }

    const result = await generateExpansion(subject, existingTitles, depth);

    if ("error" in result) {
      const status = result.error === "rate_limit" ? 429 : 502;
      return NextResponse.json(
        {
          error: result.message,
          code: result.error,
          retryAfterMs: result.retryAfterMs,
        },
        { status },
      );
    }

    const provider = result.provider === "groq" ? "groq" : "gemini";
    await writeCachedExpansion(subject, depth, existingTitles, result.data, provider);

    if (isExpansionStopResponse(result.data)) {
      return NextResponse.json({
        exhausted: true,
        reason: result.data.stopReason,
        provider: result.provider,
        cached: false,
      });
    }

    return NextResponse.json({
      unit: aiExpansionToUnit(pathContext, result.data),
      provider: result.provider,
      aiGenerated: true,
      cached: false,
    });
  } catch (error) {
    console.error("Expansion error:", error);
    return NextResponse.json({ error: "Failed to expand path" }, { status: 500 });
  }
}
