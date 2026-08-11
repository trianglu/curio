import { NextResponse } from "next/server";
import { generatePathUpgrade } from "@/lib/ai/client";
import { applyPathUpgrade } from "@/lib/ai/transform";
import { getAllLessons, needsGeminiUpgrade } from "@/lib/path-engine";
import { countContentUnits } from "@/lib/review-checkpoint";
import type { LearningPath } from "@/lib/types";

interface UpgradeRequestBody {
  path?: LearningPath;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpgradeRequestBody;
    const path = body.path;

    if (!path?.id || !path.subject || !path.aiGenerated) {
      return NextResponse.json({ error: "Valid AI-generated path is required" }, { status: 400 });
    }

    if (!needsGeminiUpgrade(path)) {
      return NextResponse.json({ error: "Path does not need Gemini upgrade" }, { status: 400 });
    }

    const lessons = getAllLessons(path);
    if (lessons.length === 0) {
      return NextResponse.json({ error: "Path has no lessons" }, { status: 400 });
    }

    const result = await generatePathUpgrade(path.subject, lessons, countContentUnits(path));

    if ("error" in result) {
      const status =
        result.error === "rate_limit" ? 429 : result.error === "not_configured" ? 503 : 502;
      return NextResponse.json(
        {
          error: result.message,
          code: result.error,
          retryAfterMs: result.retryAfterMs,
        },
        { status },
      );
    }

    const existingTitles = new Set(lessons.map((lesson) => lesson.title));
    const matched = result.data.enrichedLessons.filter((lesson) => existingTitles.has(lesson.title));
    if (matched.length === 0) {
      return NextResponse.json(
        { error: "Upgrade response did not match any existing lessons", code: "validation_failed" },
        { status: 502 },
      );
    }

    const upgradedPath = applyPathUpgrade(path, {
      ...result.data,
      enrichedLessons: matched,
    });

    return NextResponse.json({
      path: upgradedPath,
      provider: result.provider,
      enrichedCount: matched.length,
      addedUnit: Boolean(result.data.additionalUnit),
    });
  } catch (error) {
    console.error("Path upgrade error:", error);
    return NextResponse.json({ error: "Failed to upgrade learning path" }, { status: 500 });
  }
}
