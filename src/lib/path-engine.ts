import type { LearningMode, LearningPath, Lesson, LessonStatus, Unit } from "./types";

export function getAllLessons(path: LearningPath): Lesson[] {
  return path.units.flatMap((unit) => unit.lessons);
}

export function getLesson(path: LearningPath, lessonId: string): Lesson | undefined {
  return getAllLessons(path).find((lesson) => lesson.id === lessonId);
}

export function getNextAvailableLesson(path: LearningPath): Lesson | undefined {
  return getAllLessons(path).find((lesson) => lesson.status === "available");
}

export function isLessonUnlockedForMode(lesson: Lesson, mode: LearningMode): boolean {
  if (lesson.mode === "both") return true;
  return lesson.mode === mode;
}

export function getVisibleLessons(path: LearningPath): Lesson[] {
  return getAllLessons(path).filter((lesson) =>
    isLessonUnlockedForMode(lesson, path.mode),
  );
}

export function getPathProgress(path: LearningPath): {
  completed: number;
  total: number;
  percent: number;
} {
  const visible = getVisibleLessons(path);
  const completed = visible.filter((l) => l.status === "completed").length;
  const total = visible.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function unlockNextLesson(path: LearningPath): LearningPath {
  const lessons = getAllLessons(path);
  const completedIds = new Set(
    lessons.filter((l) => l.status === "completed").map((l) => l.id),
  );

  let foundAvailable = false;
  const updatedLessons = lessons.map((lesson) => {
    if (lesson.status === "completed" || lesson.status === "in_progress") {
      return lesson;
    }
    if (!foundAvailable && !completedIds.has(lesson.id)) {
      foundAvailable = true;
      return { ...lesson, status: "available" as LessonStatus };
    }
    return lesson;
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
  const lessons = getAllLessons(path).map((lesson) => {
    if (lesson.id !== lessonId) return lesson;
    return { ...lesson, status: "completed" as LessonStatus };
  });

  const xpGain = path.mode === "passive" ? 10 : 25;
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
  const previousLessons = getAllLessons(path);
  const lastCompletedIndex = previousLessons.reduce(
    (max, lesson, index) => (lesson.status === "completed" ? index : max),
    -1,
  );

  const newLessons = newUnit.lessons.map((lesson, index) => {
    const globalIndex = previousLessons.length + index;
    if (globalIndex === lastCompletedIndex + 1 || (lastCompletedIndex === -1 && index === 0)) {
      return { ...lesson, status: "available" as LessonStatus, isNew: lesson.isNew ?? index === 0 };
    }
    return lesson;
  });

  return {
    ...path,
    units: [...path.units, { ...newUnit, lessons: newLessons }],
    expansionDepth: path.expansionDepth + 1,
    expansionStatus: "expanding",
    updatedAt: new Date().toISOString(),
  };
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
  return path.expansionStatus === "expanding" && path.expansionDepth < 8;
}

export function toggleExpansion(path: LearningPath): LearningPath {
  return {
    ...path,
    expansionStatus: path.expansionStatus === "expanding" ? "paused" : "expanding",
    updatedAt: new Date().toISOString(),
  };
}
