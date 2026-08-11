import { createId } from "./id";
import type { Lesson, LessonContent, QuizQuestion, Unit } from "./types";

const PLACEHOLDER_PHRASES = [
  "see lesson body for details",
  "key point",
  "lesson summary",
  "lesson content",
  "content simplified for beginners",
  "legacy lesson",
  "content unavailable",
  "a related but incorrect idea",
  "a common misunderstanding",
  "an unrelated claim from a different context",
  "an incorrect alternative",
  "review the lesson content",
  "review question",
  "accuracy metadata",
];

export function isPlaceholderText(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (lower.length < 12) return true;
  return PLACEHOLDER_PHRASES.some((phrase) => lower.includes(phrase));
}

export function isLowQualityQuestion(question?: QuizQuestion): boolean {
  if (!question?.options?.length || question.options.length < 4) return true;
  if (question.prompt.includes("Which statement best reflects what you learned in")) {
    return true;
  }
  const texts = question.options.map((o) => o.text.trim().toLowerCase());
  if (new Set(texts).size < question.options.length) return true;
  const placeholderCount = question.options.filter((o) => isPlaceholderText(o.text)).length;
  return placeholderCount >= 1;
}

export function extractFactualStatements(...sources: string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const source of sources) {
    if (!source?.trim()) continue;
    const parts = source.split(/(?<=[.!?])\s+|\n+/);
    for (let part of parts) {
      part = part.trim().replace(/\s+/g, " ");
      if (part.length < 28 || part.length > 200) continue;
      if (isPlaceholderText(part)) continue;
      if (/^(this (lesson|quiz|unit)|let's|test your|review your)/i.test(part)) continue;
      const key = part.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(part.endsWith(".") ? part : `${part}.`);
    }
  }

  return results;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function gatherUnitFacts(unit: Unit): string[] {
  const sources: string[] = [];
  for (const lesson of unit.lessons) {
    if (lesson.type === "quiz" || lesson.type === "problem" || lesson.type === "review") {
      continue;
    }
    sources.push(lesson.content.summary, lesson.content.body, ...lesson.content.keyPoints);
  }
  return extractFactualStatements(...sources);
}

export function gatherLessonFacts(content: LessonContent): string[] {
  return extractFactualStatements(content.summary, content.body, ...content.keyPoints);
}

export function buildQuestionFromStatements(
  statements: string[],
  options: { title: string; subject?: string; existingId?: string },
): QuizQuestion | undefined {
  const pool = statements.filter((s) => !isPlaceholderText(s));
  if (pool.length < 4) return undefined;

  const ordered = shuffle(pool);
  const correct = ordered[0];
  const distractors = ordered.slice(1, 4);
  const topic = options.subject?.trim() || options.title.replace(/^quiz:\s*/i, "").trim();

  return {
    id: options.existingId ?? createId("q"),
    prompt: topic
      ? `Which statement about ${topic} is supported by what you learned in this unit?`
      : `Which statement from "${options.title}" is correct?`,
    options: [
      { id: createId("opt"), text: correct, correct: true },
      ...distractors.map((text) => ({ id: createId("opt"), text, correct: false })),
    ],
    explanation: `As covered in this unit: ${correct}`,
  };
}

export function rebuildLessonQuestion(
  lesson: Lesson,
  unit: Unit,
  pathSubject?: string,
): QuizQuestion | undefined {
  const unitFacts = gatherUnitFacts(unit);
  const lessonFacts = gatherLessonFacts(lesson.content);
  const statements = [...new Set([...lessonFacts, ...unitFacts])];

  return buildQuestionFromStatements(statements, {
    title: lesson.title,
    subject: pathSubject,
    existingId: lesson.content.question?.id,
  });
}
