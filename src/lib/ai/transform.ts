import { createId } from "../id";
import { reconcileLessonLocks } from "../path-engine";
import type {
  AiExpansionResponse,
  AiLesson,
  AiPathResponse,
  AiPathUpgradeResponse,
} from "./schemas";
import type {
  LearningPath,
  Lesson,
  LessonContent,
  LessonStatus,
  QuizQuestion,
  Unit,
} from "../types";

function mapQuiz(question: NonNullable<AiLesson["content"]["question"]>): QuizQuestion {
  return {
    id: createId("q"),
    prompt: question.prompt,
    options: question.options.map((opt) => ({
      id: createId("opt"),
      text: opt.text,
      correct: opt.correct,
    })),
    explanation: question.explanation,
  };
}

function mapContent(content: AiLesson["content"]): LessonContent {
  return {
    summary: content.summary,
    body: content.body,
    analogy: content.analogy,
    keyPoints: content.keyPoints,
    question: content.question ? mapQuiz(content.question) : undefined,
    confidenceLevel: content.confidenceLevel,
    caveats: content.caveats,
    disputedClaims: content.disputedClaims,
    verifyWith: content.verifyWith,
  };
}

function mapLessons(
  aiLessons: AiLesson[],
  unitId: string,
  depth: number,
  startOrder: number,
): Lesson[] {
  return aiLessons.map((aiLesson, index) => ({
    id: createId("lesson"),
    unitId,
    title: aiLesson.title,
    type: aiLesson.type,
    content: mapContent(aiLesson.content),
    status: (index === 0 && startOrder === 0 ? "available" : "locked") as LessonStatus,
    order: startOrder + index,
    depth,
    estimatedMinutes: aiLesson.estimatedMinutes,
  }));
}

function mapUnits(pathId: string, aiUnits: AiPathResponse["units"]): Unit[] {
  let lessonOrder = 0;
  return aiUnits.map((aiUnit, index) => {
    const unitId = createId("unit");
    const lessons = mapLessons(aiUnit.lessons, unitId, aiUnit.depth, lessonOrder);
    lessonOrder += lessons.length;
    return {
      id: unitId,
      pathId,
      title: aiUnit.title,
      description: aiUnit.description,
      order: index,
      depth: aiUnit.depth,
      lessons,
    };
  });
}

export function aiResponseToPath(
  subject: string,
  response: AiPathResponse,
  provider: "groq" | "gemini" = "gemini",
): LearningPath {
  const pathId = createId("path");
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: pathId,
    subject,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    units: mapUnits(pathId, response.units),
    expansionStatus: "expanding",
    expansionDepth: 1,
    totalXp: 0,
    streak: 1,
    lastActiveDate: today,
    lessonsCompleted: 0,
    aiGenerated: true,
    generationProvider: provider,
    geminiUpgraded: provider === "gemini",
  };
}

export interface ExpansionPathContext {
  id: string;
  unitCount: number;
  lessonCount: number;
}

export function aiExpansionToUnit(
  path: LearningPath | ExpansionPathContext,
  response: AiExpansionResponse,
): Unit {
  if (!response.unit) {
    throw new Error("Expansion response is missing unit");
  }
  const { unit } = response;
  const unitId = createId("unit");
  const lessonOrder =
    "units" in path
      ? path.units.reduce((sum, u) => sum + u.lessons.length, 0)
      : path.lessonCount;
  const unitOrder = "units" in path ? path.units.length : path.unitCount;

  return {
    id: unitId,
    pathId: path.id,
    title: unit.title,
    description: unit.description,
    order: unitOrder,
    depth: unit.depth,
    lessons: mapLessons(unit.lessons, unitId, unit.depth, lessonOrder).map((lesson, index) => ({
      ...lesson,
      isNew: true,
    })),
  };
}

export function getExistingLessonTitles(path: LearningPath): string[] {
  return path.units.flatMap((u) => u.lessons.map((l) => l.title));
}

export function applyPathUpgrade(
  path: LearningPath,
  upgrade: AiPathUpgradeResponse,
): LearningPath {
  const enrichmentByTitle = new Map(upgrade.enrichedLessons.map((lesson) => [lesson.title, lesson]));

  const units = path.units.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((lesson) => {
      const enriched = enrichmentByTitle.get(lesson.title);
      if (!enriched) return lesson;
      return {
        ...lesson,
        type: enriched.type ?? lesson.type,
        estimatedMinutes: enriched.estimatedMinutes ?? lesson.estimatedMinutes,
        content: mapContent(enriched.content),
      };
    }),
  }));

  let updated: LearningPath = {
    ...path,
    units,
    geminiUpgraded: true,
    updatedAt: new Date().toISOString(),
  };

  if (upgrade.additionalUnit) {
    updated = appendFoundationalUnit(updated, aiExpansionToUnit(updated, { unit: upgrade.additionalUnit }));
  }

  return reconcileLessonLocks(updated);
}

function appendFoundationalUnit(path: LearningPath, newUnit: Unit): LearningPath {
  const unitWithFlags = {
    ...newUnit,
    lessons: newUnit.lessons.map((lesson) => ({
      ...lesson,
      status: "locked" as LessonStatus,
      isNew: false,
    })),
  };

  return reconcileLessonLocks({
    ...path,
    units: [...path.units, unitWithFlags],
    updatedAt: new Date().toISOString(),
  });
}
