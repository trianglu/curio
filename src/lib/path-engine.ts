import type { LearningPath, Lesson, LessonStatus, Unit } from "./types";
import { EXPANSION_EMPTY_PASS_LIMIT } from "./expansion-runner";

export function getAllLessons(path: LearningPath): Lesson[] {
  return path.units.flatMap((unit) => unit.lessons);
}

export function getLesson(path: LearningPath, lessonId: string): Lesson | undefined {
  return getAllLessons(path).find((lesson) => lesson.id === lessonId);
}

export function getUnitForLesson(path: LearningPath, lessonId: string): Unit | undefined {
  return path.units.find((unit) => unit.lessons.some((lesson) => lesson.id === lessonId));
}

export function getLessonXpGain(lesson: Lesson): number {
  if (lesson.type === "review") return 12;
  return lesson.type === "quiz" || lesson.type === "problem" ? 20 : 15;
}

export function isUnitFullyCompleted(unit: Unit): boolean {
  return unit.lessons.length > 0 && unit.lessons.every((lesson) => lesson.status === "completed");
}

export function getNextAvailableLesson(path: LearningPath): Lesson | undefined {
  return getAllLessons(path).find((lesson) => lesson.status === "available");
}

/** True when the learner has finished every lesson currently on the path. */
export function isPathCaughtUp(path: LearningPath): boolean {
  const lessons = getAllLessons(path);
  if (lessons.length === 0) return false;
  return lessons.every((lesson) => lesson.status === "completed");
}

export function getPathProgress(path: LearningPath): {
  completed: number;
  total: number;
  percent: number;
} {
  const lessons = getAllLessons(path);
  const completed = lessons.filter((l) => l.status === "completed").length;
  const total = lessons.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function unlockNextLesson(path: LearningPath): LearningPath {
  return reconcileLessonLocks(path);
}

/** Exactly one lesson is available (or in_progress) — same rules for initial and expanded units. */
export function reconcileLessonLocks(path: LearningPath): LearningPath {
  const lessons = getAllLessons(path);
  const inProgress = lessons.find((l) => l.status === "in_progress");

  let unlocked = false;
  const updatedLessons = lessons.map((lesson) => {
    if (lesson.status === "completed") return lesson;

    if (inProgress) {
      return lesson.id === inProgress.id
        ? lesson
        : { ...lesson, status: "locked" as LessonStatus };
    }

    if (!unlocked) {
      unlocked = true;
      return { ...lesson, status: "available" as LessonStatus };
    }

    return { ...lesson, status: "locked" as LessonStatus };
  });

  return applyLessonsToPath(path, updatedLessons);
}

function applyLessonsToPath(path: LearningPath, lessons: Lesson[]): LearningPath {
  let cursor = 0;
  const units = path.units.map((unit) => {
    const unitLessons = lessons.slice(cursor, cursor + unit.lessons.length);
    cursor += unit.lessons.length;
    return { ...unit, lessons: unitLessons };
  });
  return { ...path, units };
}

export function completeLesson(path: LearningPath, lessonId: string): LearningPath {
  const completedLesson = getLesson(path, lessonId);
  const lessons = getAllLessons(path).map((lesson) => {
    if (lesson.id !== lessonId) return lesson;
    return { ...lesson, status: "completed" as LessonStatus };
  });

  const xpGain = completedLesson ? getLessonXpGain(completedLesson) : 15;
  const today = new Date().toISOString().slice(0, 10);
  const streak =
    path.lastActiveDate === today
      ? path.streak
      : path.lastActiveDate === yesterday()
        ? path.streak + 1
        : 1;

  const updated = unlockNextLesson({
    ...applyLessonsToPath(path, lessons),
    totalXp: path.totalXp + xpGain,
    lessonsCompleted: path.lessonsCompleted + 1,
    streak,
    lastActiveDate: today,
    updatedAt: new Date().toISOString(),
  });

  return updated;
}

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function appendUnit(path: LearningPath, newUnit: Unit): LearningPath {
  const unitWithFlags = {
    ...newUnit,
    lessons: newUnit.lessons.map((lesson, index) => ({
      ...lesson,
      status: "locked" as LessonStatus,
      isNew: lesson.isNew ?? index === 0,
    })),
  };

  return reconcileLessonLocks({
    ...path,
    units: [...path.units, unitWithFlags],
    expansionDepth: path.expansionDepth + 1,
    expansionStatus: "expanding",
    updatedAt: new Date().toISOString(),
    lastAddedUnitTitle: newUnit.title,
    lastAddedUnitAt: new Date().toISOString(),
    expansionEmptyPasses: 0,
    expansionStopReason: undefined,
  });
}

export function clearNewFlags(path: LearningPath): LearningPath {
  return {
    ...path,
    units: path.units.map((unit) => ({
      ...unit,
      lessons: unit.lessons.map((lesson) => ({ ...lesson, isNew: false })),
    })),
  };
}

export function getExpansionLabel(path: LearningPath): string {
  if (path.expansionStatus === "generating") return "Generating new lessons with AI…";
  const depth = path.expansionDepth;
  if (depth <= 1) return "Researching foundational topics…";
  if (depth <= 2) return "Adding intermediate lessons…";
  if (depth <= 3) return "Discovering advanced perspectives…";
  return "Expanding specialized content…";
}

export function shouldContinueExpanding(path: LearningPath): boolean {
  return (
    path.aiGenerated &&
    path.expansionStatus !== "paused" &&
    path.expansionStatus !== "exhausted"
  );
}

export function needsGeminiUpgrade(path: LearningPath): boolean {
  if (!path.aiGenerated || path.geminiUpgraded) return false;
  if (path.generationProvider === "groq") return true;
  // Legacy compact paths created before provider tracking
  const lessons = getAllLessons(path);
  return !path.generationProvider && path.units.length === 1 && lessons.length >= 4 && lessons.length <= 7;
}

/** Reset stuck or legacy statuses so background expansion can run. */
export function ensureExpansionRunning(path: LearningPath): LearningPath {
  if (!path.aiGenerated || path.expansionStatus === "paused" || path.expansionStatus === "exhausted") {
    return path;
  }
  if (path.expansionStatus === "idle" || path.expansionStatus === "generating") {
    return { ...path, expansionStatus: "expanding" };
  }
  return path;
}

export function isExpansionActive(path: LearningPath): boolean {
  return path.expansionStatus === "expanding" || path.expansionStatus === "generating";
}

export function toggleExpansion(path: LearningPath): LearningPath {
  if (path.expansionStatus === "exhausted") {
    return {
      ...path,
      expansionStatus: "expanding",
      expansionStopReason: undefined,
      expansionEmptyPasses: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  const pausing = path.expansionStatus !== "paused";
  return {
    ...path,
    expansionStatus: pausing ? "paused" : "expanding",
    updatedAt: new Date().toISOString(),
  };
}

export function markExpansionExhausted(path: LearningPath, reason: string): LearningPath {
  return {
    ...path,
    expansionStatus: "exhausted",
    expansionStopReason: reason,
    updatedAt: new Date().toISOString(),
  };
}

export function recordExpansionEmptyPass(
  path: LearningPath,
  reason: string,
): { path: LearningPath; exhausted: boolean } {
  const passes = (path.expansionEmptyPasses ?? 0) + 1;
  if (passes >= EXPANSION_EMPTY_PASS_LIMIT) {
    return {
      path: markExpansionExhausted({ ...path, expansionEmptyPasses: passes }, reason),
      exhausted: true,
    };
  }
  return {
    path: {
      ...path,
      expansionStatus: "expanding",
      expansionEmptyPasses: passes,
      expansionStopReason: reason,
      updatedAt: new Date().toISOString(),
    },
    exhausted: false,
  };
}
