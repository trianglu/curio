import { NextResponse } from "next/server";
import { generateExpansion } from "@/lib/ai/client";
import { aiExpansionToUnit, getExistingLessonTitles } from "@/lib/ai/transform";
import { generateExpansionUnit } from "@/lib/mock-generator";
import type { LearningPath } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      path?: LearningPath;
      templateIndex?: number;
    };

    const path = body.path;
    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const depth = Math.min(path.expansionDepth + 1, 4);
    const existingTitles = getExistingLessonTitles(path);

    const result = await generateExpansion(path.subject, path.mode, existingTitles, depth);

    if (result) {
      const unit = aiExpansionToUnit(path, result.data);
      return NextResponse.json({
        unit,
        provider: result.provider,
        aiGenerated: true,
      });
    }

    const templateIndex = body.templateIndex ?? path.expansionDepth;
    const mockUnit = generateExpansionUnit(path, templateIndex);
    if (!mockUnit) {
      return NextResponse.json({ error: "No more content to expand" }, { status: 404 });
    }

    return NextResponse.json({
      unit: { ...mockUnit, lessons: mockUnit.lessons.map((l, i) => ({ ...l, isNew: i === 0 })) },
      provider: "none",
      aiGenerated: false,
    });
  } catch (error) {
    console.error("Expansion error:", error);
    return NextResponse.json({ error: "Failed to expand path" }, { status: 500 });
  }
}
