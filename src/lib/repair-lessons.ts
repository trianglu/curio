import { reconcileLessonLocks } from "./path-engine";
import { isLowQualityQuestion, rebuildLessonQuestion } from "@/lib/quiz-from-content";
import { backfillMissingCheckpoints } from "./review-checkpoint";
import { resolveLessonQuestion } from "./parse-quiz";
import type { Lesson, LearningPath, Unit } from "./types";

function inferQuizType(title: string, type: Lesson["type"]): Lesson["type"] {
  if (type === "quiz" || type === "problem" || type === "review") return type;
  if (/\bquiz\b|check your|review|recall|test your|knowledge check/i.test(title)) {
    return "quiz";
  }
  return type;
}

/** Fix mislabeled quiz lessons saved before expansion quiz validation. */
export function repairLesson(lesson: Lesson, unit?: Unit, pathSubject?: string): Lesson {
  const type = inferQuizType(lesson.title, lesson.type);
  if (type === lesson.type && type !== "quiz" && type !== "problem") {
    return lesson;
  }

  let question = resolveLessonQuestion(type, lesson.content.body, lesson.content.question);

  if (unit && (type === "quiz" || type === "problem") && isLowQualityQuestion(question)) {
    const rebuilt = rebuildLessonQuestion({ ...lesson, type }, unit, pathSubject);
    if (rebuilt) question = rebuilt;
  }

  return {
    ...lesson,
    type,
    content: {
      ...lesson.content,
      question,
    },
  };
}

export function repairUnit(unit: Unit, pathSubject?: string): Unit {
  const lessons = unit.lessons.map((lesson) => repairLesson(lesson, unit, pathSubject));
  if (lessons.length >= 3) {
    const lastIndex = lessons.length - 1;
    const last = lessons[lastIndex];
    if (last.type !== "quiz") {
      lessons[lastIndex] = repairLesson({ ...last, type: "quiz" });
    }
  }
  return { ...unit, lessons };
}

export function repairPath(path: LearningPath): LearningPath {
  const repaired = reconcileLessonLocks({
    ...path,
    units: path.units.map((unit) => repairUnit(unit, path.subject)),
  });
  return backfillMissingCheckpoints(repaired);
}
