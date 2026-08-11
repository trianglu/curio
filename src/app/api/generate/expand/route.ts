import { NextResponse } from "next/server";
import { generateExpansion } from "@/lib/ai/client";
import { isExpansionStopResponse } from "@/lib/ai/schemas";
import { aiExpansionToUnit, getExistingLessonTitles } from "@/lib/ai/transform";
import type { LearningPath } from "@/lib/types";

interface ExpandRequestBody {
  path?: LearningPath;
  pathId?: string;
  subject?: string;
  expansionDepth?: number;
  existingTitles?: string[];
  aiGenerated?: boolean;
  unitCount?: number;
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

    if (isExpansionStopResponse(result.data)) {
      return NextResponse.json({
        exhausted: true,
        reason: result.data.stopReason,
        provider: result.provider,
      });
    }

    const unit = aiExpansionToUnit(
      path ?? {
        id: pathId,
        unitCount: body.unitCount ?? 0,
        lessonCount: existingTitles.length,
      },
      result.data,
    );

    return NextResponse.json({
      unit,
      provider: result.provider,
      aiGenerated: true,
    });
  } catch (error) {
    console.error("Expansion error:", error);
    return NextResponse.json({ error: "Failed to expand path" }, { status: 500 });
  }
}
