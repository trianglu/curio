import { createId } from "../id";
import type {
  AiExpansionResponse,
  AiLesson,
  AiPathResponse,
} from "./schemas";
import type {
  LearningMode,
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
    mode: aiLesson.mode,
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
  mode: LearningMode,
  response: AiPathResponse,
): LearningPath {
  const pathId = createId("path");
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: pathId,
    subject,
    mode,
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
  };
}

export function aiExpansionToUnit(
  path: LearningPath,
  response: AiExpansionResponse,
): Unit {
  const unitId = createId("unit");
  const lessonOrder = path.units.reduce((sum, u) => sum + u.lessons.length, 0);

  return {
    id: unitId,
    pathId: path.id,
    title: response.unit.title,
    description: response.unit.description,
    order: path.units.length,
    depth: response.unit.depth,
    lessons: mapLessons(response.unit.lessons, unitId, response.unit.depth, lessonOrder).map(
      (lesson, index) => ({
        ...lesson,
        isNew: true,
        status: index === 0 ? ("available" as LessonStatus) : lesson.status,
      }),
    ),
  };
}

export function getExistingLessonTitles(path: LearningPath): string[] {
  return path.units.flatMap((u) => u.lessons.map((l) => l.title));
}
