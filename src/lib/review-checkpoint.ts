import { createId } from "./id";
import { resolveLessonQuestion } from "./parse-quiz";
import { getAllLessons, isUnitFullyCompleted, reconcileLessonLocks } from "./path-engine";
import type {
  ConfidenceLevel,
  LearningPath,
  Lesson,
  LessonContent,
  LessonStatus,
  QuizQuestion,
  Unit,
  UnitKind,
} from "./types";

export const MIN_CHECKPOINT_QUESTIONS = 3;
export const MAX_CHECKPOINT_QUESTIONS = 7;

const CHECKPOINT_TITLES = [
  "The Memory Bridge",
  "Recall Harbor",
  "The Archive",
  "What Stuck?",
  "Knowledge Roundup",
  "Memory Lane",
] as const;

const CHECKPOINT_DESCRIPTIONS = [
  "Revisit ideas from your journey — no new material, just active recall.",
  "A quick round-trip through what you've learned so far.",
  "Pull these answers from memory before moving on.",
  "Mixed recall from every unit you've completed.",
] as const;

interface RecallCandidate {
  lesson: Lesson;
  unit: Unit;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isContentUnit(unit: Unit): boolean {
  return unit.kind !== "checkpoint";
}

export function getContentUnits(path: LearningPath): Unit[] {
  return path.units.filter(isContentUnit);
}

export function getCheckpointUnits(path: LearningPath): Unit[] {
  return path.units.filter((unit) => unit.kind === "checkpoint");
}

export function countContentUnits(path: LearningPath): number {
  return getContentUnits(path).length;
}

function cloneQuestion(question: QuizQuestion): QuizQuestion {
  return {
    id: createId("q"),
    prompt: question.prompt,
    explanation: question.explanation,
    options: question.options.map((option) => ({
      id: createId("opt"),
      text: option.text,
      correct: option.correct,
    })),
  };
}

function recallTitle(sourceTitle: string, index: number): string {
  const prefixes = ["Flashback", "Still remember?", "Quick recall", "Memory check", "Recall round"];
  const prefix = prefixes[index % prefixes.length];
  const short =
    sourceTitle.length > 48 ? `${sourceTitle.slice(0, 45).trim()}…` : sourceTitle;
  return `${prefix}: ${short}`;
}

function buildReviewContent(candidate: RecallCandidate): LessonContent {
  const { lesson, unit } = candidate;
  const sourceType = inferRecallSourceType(lesson.title, lesson.type);
  const sourceLabel =
    sourceType === "problem"
      ? "practice problem"
      : sourceType === "quiz"
        ? "unit quiz"
        : "lesson";

  const resolvedQuestion = resolveLessonQuestion(
    sourceType,
    lesson.content.body,
    lesson.content.question,
  );

  return {
    summary: `Recall from ${unit.title}`,
    body: `You first worked through this as a ${sourceLabel} in "${unit.title}" (${lesson.title}).\n\nPause and try to answer from memory before tapping an option — that's what makes it stick.`,
    keyPoints: lesson.content.keyPoints.slice(0, 3),
    question: resolvedQuestion ? cloneQuestion(resolvedQuestion) : undefined,
    confidenceLevel: (lesson.content.confidenceLevel ?? "consensus") as ConfidenceLevel,
    caveats: ["Review round — tests recall from earlier lessons, not new facts."],
  };
}

function inferRecallSourceType(title: string, type: Lesson["type"]): Lesson["type"] {
  if (type === "quiz" || type === "problem" || type === "review") return type;
  if (/\bquiz\b|check your|review|recall|test your|knowledge check/i.test(title)) {
    return "quiz";
  }
  if (/\bproblem\b|practice|worked example|apply what/i.test(title)) {
    return "problem";
  }
  return type;
}

function isRecallSourceLesson(lesson: Lesson): boolean {
  const type = inferRecallSourceType(lesson.title, lesson.type);
  return type === "problem" || type === "quiz";
}

function lessonHasQuestion(lesson: Lesson): boolean {
  if (lesson.content.question?.options?.length) return true;
  return Boolean(
    lesson.content.body &&
      /\?[\s\S]*(?:A\)|A\.)\s*.+,\s*(?:B\)|B\.)/i.test(lesson.content.body),
  );
}
function collectRecallCandidates(path: LearningPath): RecallCandidate[] {
  const candidates: RecallCandidate[] = [];

  for (const unit of getContentUnits(path)) {
    for (const lesson of unit.lessons) {
      if (lesson.status !== "completed") continue;
      if (!isRecallSourceLesson(lesson)) continue;
      if (!lessonHasQuestion(lesson)) continue;
      candidates.push({ lesson, unit });
    }
  }

  return candidates;
}

function getUsedSourceLessonIds(path: LearningPath): Set<string> {
  const used = new Set<string>();
  for (const unit of getCheckpointUnits(path)) {
    for (const lesson of unit.lessons) {
      if (lesson.reviewSource?.lessonId) {
        used.add(lesson.reviewSource.lessonId);
      }
    }
  }
  return used;
}

function selectCheckpointQuestions(
  pool: RecallCandidate[],
  usedLessonIds: Set<string>,
  justCompletedUnitId: string,
  limit: number,
): RecallCandidate[] {
  const unused = pool.filter((candidate) => !usedLessonIds.has(candidate.lesson.id));
  const sourcePool = unused.length >= MIN_CHECKPOINT_QUESTIONS ? unused : pool;

  const fromCompletedUnit = shuffle(
    sourcePool.filter((candidate) => candidate.unit.id === justCompletedUnitId),
  );
  const fromOtherUnits = shuffle(
    sourcePool.filter((candidate) => candidate.unit.id !== justCompletedUnitId),
  );

  const selected: RecallCandidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: RecallCandidate) => {
    if (selected.length >= limit) return;
    if (seen.has(candidate.lesson.id)) return;
    seen.add(candidate.lesson.id);
    selected.push(candidate);
  };

  fromCompletedUnit.slice(0, Math.min(3, limit)).forEach(push);

  let otherIndex = 0;
  while (selected.length < limit && otherIndex < fromOtherUnits.length) {
    push(fromOtherUnits[otherIndex]);
    otherIndex += 1;
  }

  if (selected.length < limit) {
    shuffle(sourcePool).forEach(push);
  }

  return selected.slice(0, limit);
}

export function needsCheckpointAfterUnit(path: LearningPath, unitId: string): boolean {
  const unit = path.units.find((candidate) => candidate.id === unitId);
  if (!unit || !isContentUnit(unit) || !isUnitFullyCompleted(unit)) return false;

  const unitIndex = path.units.findIndex((candidate) => candidate.id === unitId);
  const nextUnit = path.units[unitIndex + 1];
  if (nextUnit?.kind === "checkpoint" && nextUnit.checkpointAfterUnit === unit.order) {
    return false;
  }

  return !getCheckpointUnits(path).some(
    (checkpoint) => checkpoint.checkpointAfterUnit === unit.order,
  );
}

export function shouldInsertCheckpoint(path: LearningPath, completedUnitId: string): boolean {
  if (!needsCheckpointAfterUnit(path, completedUnitId)) return false;

  const lastUnit = path.units[path.units.length - 1];
  if (lastUnit?.kind === "checkpoint" && !isUnitFullyCompleted(lastUnit)) {
    return false;
  }

  return true;
}

export function buildCheckpointUnit(
  path: LearningPath,
  afterUnitId: string,
): Unit | null {
  const pool = collectRecallCandidates(path);
  if (pool.length < MIN_CHECKPOINT_QUESTIONS) return null;

  const afterUnit = path.units.find((unit) => unit.id === afterUnitId);
  if (!afterUnit) return null;

  const usedLessonIds = getUsedSourceLessonIds(path);
  const selected = selectCheckpointQuestions(
    pool,
    usedLessonIds,
    afterUnitId,
    MAX_CHECKPOINT_QUESTIONS,
  );
  if (selected.length < MIN_CHECKPOINT_QUESTIONS) return null;

  const checkpointIndex = getCheckpointUnits(path).length;
  const unitId = createId("unit");
  const startOrder = getAllLessons(path).length;

  const lessons: Lesson[] = selected.map((candidate, index) => ({
    id: createId("lesson"),
    unitId,
    title: recallTitle(candidate.lesson.title, index),
    type: "review",
    content: buildReviewContent(candidate),
    status: "locked" as LessonStatus,
    order: startOrder + index,
    depth: candidate.unit.depth,
    estimatedMinutes: 2,
    reviewSource: {
      lessonId: candidate.lesson.id,
      lessonTitle: candidate.lesson.title,
      unitTitle: candidate.unit.title,
      unitOrder: candidate.unit.order,
      sourceType:
        inferRecallSourceType(candidate.lesson.title, candidate.lesson.type) === "problem"
          ? "problem"
          : "quiz",
    },
  }));

  return {
    id: unitId,
    pathId: path.id,
    title: CHECKPOINT_TITLES[checkpointIndex % CHECKPOINT_TITLES.length],
    description:
      CHECKPOINT_DESCRIPTIONS[checkpointIndex % CHECKPOINT_DESCRIPTIONS.length],
    order: path.units.length,
    depth: afterUnit.depth,
    kind: "checkpoint" as UnitKind,
    checkpointAfterUnit: afterUnit.order,
    lessons,
  };
}

export function insertCheckpointUnit(
  path: LearningPath,
  checkpoint: Unit,
  afterUnitId: string,
): LearningPath {
  const insertAt = path.units.findIndex((unit) => unit.id === afterUnitId);
  const unitWithLocks = {
    ...checkpoint,
    lessons: checkpoint.lessons.map((lesson) => ({
      ...lesson,
      status: "locked" as LessonStatus,
    })),
  };

  const units =
    insertAt < 0
      ? [...path.units, unitWithLocks]
      : [
          ...path.units.slice(0, insertAt + 1),
          { ...unitWithLocks, order: insertAt + 1 },
          ...path.units.slice(insertAt + 1).map((unit, index) => ({
            ...unit,
            order: insertAt + 2 + index,
          })),
        ];

  return reconcileLessonLocks({
    ...path,
    units,
    updatedAt: new Date().toISOString(),
  });
}

export function maybeInsertCheckpoint(
  path: LearningPath,
  completedUnitId: string,
): LearningPath {
  if (!shouldInsertCheckpoint(path, completedUnitId)) return path;
  const checkpoint = buildCheckpointUnit(path, completedUnitId);
  if (!checkpoint) return path;
  return insertCheckpointUnit(path, checkpoint, completedUnitId);
}

/** Insert recall rounds after completed units that never got one (e.g. finished before feature shipped). */
export function backfillMissingCheckpoints(path: LearningPath): LearningPath {
  let updated = path;

  for (const unit of getContentUnits(updated)) {
    if (!needsCheckpointAfterUnit(updated, unit.id)) continue;
    const checkpoint = buildCheckpointUnit(updated, unit.id);
    if (!checkpoint) continue;
    updated = insertCheckpointUnit(updated, checkpoint, unit.id);
  }

  return updated;
}
