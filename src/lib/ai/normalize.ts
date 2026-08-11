import type { AiExpansionResponse, AiPathResponse } from "./schemas";
import { UNIT_LESSONS_MAX } from "./schemas";
import { parseInlineQuiz } from "../parse-quiz";
import {
  buildQuestionFromStatements,
  extractFactualStatements,
  isPlaceholderText,
} from "@/lib/quiz-from-content";

const LESSON_TYPES = new Set([
  "concept",
  "analogy",
  "summary",
  "quiz",
  "problem",
  "deep-dive",
]);

const CONFIDENCE_LEVELS = new Set([
  "established",
  "consensus",
  "debated",
  "emerging",
  "unknown",
]);

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function normalizeLessonType(value: unknown): string {
  const raw = asString(value, "concept").toLowerCase().replace(/_/g, "-").trim();
  const aliases: Record<string, string> = {
    "deep dive": "deep-dive",
    deepdive: "deep-dive",
    "deep-dive": "deep-dive",
    introduction: "summary",
    intro: "summary",
    overview: "summary",
    exercise: "problem",
    practice: "problem",
    test: "quiz",
  };
  const mapped = aliases[raw] ?? raw;
  return LESSON_TYPES.has(mapped) ? mapped : "concept";
}

function normalizeConfidence(value: unknown): string {
  const raw = asString(value, "consensus").toLowerCase().trim();
  return CONFIDENCE_LEVELS.has(raw) ? raw : "consensus";
}

const DISTRACTOR_TEXTS = [
  "A related but incorrect idea",
  "A common misunderstanding",
  "An unrelated claim from a different context",
];

function isUsableFactText(text: string): boolean {
  return text.length >= 20 && !isPlaceholderText(text);
}

function isValidQuizQuestion(
  question: ReturnType<typeof normalizeQuestion> | undefined,
): boolean {
  if (!question) return false;
  if (question.prompt.length < 12 || question.prompt === "Review question") return false;
  if (question.options.length !== 4) return false;
  if (!question.options.some((o) => o.correct)) return false;
  if (question.options.some((o) => !o.text || o.text.startsWith("Option "))) return false;
  return question.explanation.length > 8;
}

function synthesizeQuestion(
  content: ReturnType<typeof normalizeContent>,
  title: string,
): NonNullable<ReturnType<typeof normalizeQuestion>> | undefined {
  const statements = extractFactualStatements(
    content.summary,
    content.body,
    ...content.keyPoints,
  );
  const fromContent = buildQuestionFromStatements(statements, { title });
  if (fromContent) {
    return {
      prompt: fromContent.prompt,
      options: fromContent.options.map((o) => ({ text: o.text, correct: o.correct })),
      explanation: fromContent.explanation,
    };
  }

  const facts = statements.filter(isUsableFactText);
  const correct = facts[0] ?? (isUsableFactText(content.summary) ? content.summary.slice(0, 120) : null);
  if (!correct) return undefined;

  const distractors = [
    ...content.keyPoints.filter(isUsableFactText),
    ...content.caveats.filter(isUsableFactText),
    ...DISTRACTOR_TEXTS,
  ]
    .filter((t) => t !== correct)
    .slice(0, 3);

  while (distractors.length < 3) {
    distractors.push(DISTRACTOR_TEXTS[distractors.length] ?? "An incorrect alternative");
  }

  return {
    prompt: `Which statement about this topic is correct?`,
    options: [
      { text: correct, correct: true },
      { text: distractors[0], correct: false },
      { text: distractors[1], correct: false },
      { text: distractors[2], correct: false },
    ],
    explanation: isUsableFactText(content.summary)
      ? content.summary.slice(0, 300)
      : `Review the lesson on ${title} for the correct answer.`,
  };
}

function normalizeQuestion(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const q = value as Record<string, unknown>;
  const options = Array.isArray(q.options) ? q.options : [];
  const normalizedOptions = options
    .filter((o) => o && typeof o === "object")
    .map((o) => {
      const opt = o as Record<string, unknown>;
      return {
        text: asString(opt.text, ""),
        correct: Boolean(opt.correct),
      };
    })
    .filter((o) => o.text.length > 0)
    .slice(0, 4);

  while (normalizedOptions.length < 4) {
    normalizedOptions.push({
      text: DISTRACTOR_TEXTS[normalizedOptions.length] ?? `Incorrect alternative ${normalizedOptions.length + 1}`,
      correct: false,
    });
  }
  if (!normalizedOptions.some((o) => o.correct) && normalizedOptions[0]) {
    normalizedOptions[0].correct = true;
  }

  return {
    prompt: asString(q.prompt, "Review question"),
    options: normalizedOptions,
    explanation: asString(q.explanation, "Review the lesson content for the correct answer."),
  };
}

function repairLessonQuestion(
  type: string,
  title: string,
  content: ReturnType<typeof normalizeContent>,
): ReturnType<typeof normalizeContent> {
  if (type !== "quiz" && type !== "problem") return content;
  if (isValidQuizQuestion(content.question)) return content;

  const parsed = parseInlineQuiz(content.body);
  if (parsed) {
    const fromBody = normalizeQuestion({
      prompt: parsed.prompt,
      options: parsed.options,
      explanation: parsed.explanation,
    });
    if (isValidQuizQuestion(fromBody)) {
      return {
        ...content,
        body: parsed.cleanedBody || content.body,
        question: fromBody,
      };
    }
  }

  const synthesized = synthesizeQuestion(content, title);
  if (synthesized && isValidQuizQuestion(synthesized)) {
    return { ...content, question: synthesized };
  }
  return content;
}

function normalizeDisputedClaims(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const claims = value
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const claim = c as Record<string, unknown>;
      const perspectives = Array.isArray(claim.perspectives)
        ? claim.perspectives.map((p) => asString(p)).filter(Boolean)
        : [];
      return {
        topic: asString(claim.topic),
        perspectives,
      };
    })
    .filter((c) => c.topic && c.perspectives.length >= 2);
  return claims.length > 0 ? claims : undefined;
}

function normalizeContent(value: unknown) {
  const c = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const keyPoints = Array.isArray(c.keyPoints)
    ? c.keyPoints.map((p) => asString(p)).filter(Boolean).slice(0, 5)
    : ["Key point"];

  while (keyPoints.length < 2) {
    keyPoints.push("See lesson body for details");
  }

  const caveats = Array.isArray(c.caveats)
    ? c.caveats.map((p) => asString(p)).filter(Boolean)
    : ["Content simplified for beginners"];

  return {
    summary: asString(c.summary, "Lesson summary"),
    body: asString(c.body, "Lesson content"),
    analogy: c.analogy ? asString(c.analogy) : undefined,
    keyPoints,
    question: normalizeQuestion(c.question),
    confidenceLevel: normalizeConfidence(c.confidenceLevel),
    caveats,
    disputedClaims: normalizeDisputedClaims(c.disputedClaims),
    verifyWith: Array.isArray(c.verifyWith)
      ? c.verifyWith.map((v) => asString(v)).filter(Boolean)
      : undefined,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const COMPACT_BODY_MIN: Record<string, number> = {
  "deep-dive": 140,
  problem: 70,
  concept: 90,
  summary: 90,
  analogy: 90,
};

function padTeachingBody(
  type: string,
  body: string,
  summary: string,
  keyPoints: string[],
): string {
  if (type === "quiz") return body;
  const min = COMPACT_BODY_MIN[type] ?? 90;
  let text = body.trim();
  if (countWords(text) >= min) return text;

  for (const part of [summary, ...keyPoints]) {
    if (!part || text.includes(part.slice(0, 40))) continue;
    text = text ? `${text}\n\n${part}` : part;
    if (countWords(text) >= min) break;
  }
  return text;
}

function inferQuizTypeFromTitle(title: string, type: string): string {
  if (type === "quiz" || type === "problem") return type;
  if (/\bquiz\b|check your|review|recall|test your|knowledge check/i.test(title)) {
    return "quiz";
  }
  return type;
}

function normalizeLesson(value: unknown) {
  const l = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const minutes = Number(l.estimatedMinutes);
  const title = asString(l.title, "Lesson");
  const type = inferQuizTypeFromTitle(title, normalizeLessonType(l.type));
  const baseContent = normalizeContent(l.content);
  let content = repairLessonQuestion(type, title, {
    ...baseContent,
    body: padTeachingBody(type, baseContent.body, baseContent.summary, baseContent.keyPoints),
  });

  return {
    title,
    type,
    estimatedMinutes: Number.isFinite(minutes) ? Math.min(45, Math.max(1, Math.round(minutes))) : 5,
    content,
  };
}

function enforceExpansionUnitStructure(unit: ReturnType<typeof normalizeUnit>) {
  let lessons = reorderUnitLessons([...unit.lessons]);

  if (lessons.length >= 3) {
    const lastIndex = lessons.length - 1;
    const last = lessons[lastIndex];
    if (last.type !== "quiz") {
      lessons[lastIndex] = { ...last, type: "quiz" };
    }
  }

  return { ...unit, lessons };
}

function reorderUnitLessons(lessons: ReturnType<typeof normalizeLesson>[]) {
  const teaching = lessons.filter(
    (l) => l.type !== "quiz" && l.type !== "problem",
  );
  const problems = lessons.filter((l) => l.type === "problem");
  const quizzes = lessons.filter((l) => l.type === "quiz");
  return [...teaching, ...problems, ...quizzes];
}

function normalizeUnit(value: unknown) {
  const u = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const lessons = Array.isArray(u.lessons) ? u.lessons.map(normalizeLesson) : [];
  const ordered = reorderUnitLessons(lessons);
  const depth = Number(u.depth);
  return {
    title: asString(u.title, "Unit"),
    description: asString(u.description, ""),
    depth: Number.isFinite(depth) ? Math.min(5, Math.max(1, Math.round(depth))) : 1,
    lessons: ordered.length >= 2 ? ordered.slice(0, UNIT_LESSONS_MAX) : [
      normalizeLesson({ title: "Introduction", type: "summary", estimatedMinutes: 5, content: {} }),
      normalizeLesson({ title: "Core concepts", type: "concept", estimatedMinutes: 6, content: {} }),
    ],
  };
}

export function normalizePathResponse(data: unknown): unknown {
  if (!data || typeof data !== "object") return { units: [] };
  const d = data as Record<string, unknown>;
  const units = Array.isArray(d.units) ? d.units.map(normalizeUnit) : [];
  return { units: units.length > 0 ? units.slice(0, 4) : [normalizeUnit({ title: "Foundations", lessons: [] })] };
}

export function normalizeExpansionResponse(data: unknown): unknown {
  if (!data || typeof data !== "object") return { unit: normalizeUnit({}) };
  const d = data as Record<string, unknown>;
  if (d.canExpand === false) {
    return {
      canExpand: false,
      stopReason: asString(d.stopReason, "No more reliable topics remain for this subject."),
    };
  }
  const unit = enforceExpansionUnitStructure(normalizeUnit(d.unit));
  return { canExpand: true, unit };
}

function normalizeEnrichedLesson(value: unknown) {
  const l = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const lesson = normalizeLesson(l);
  return {
    title: lesson.title,
    type: lesson.type,
    estimatedMinutes: lesson.estimatedMinutes,
    content: lesson.content,
  };
}

export function normalizePathUpgradeResponse(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return { enrichedLessons: [] };
  }
  const d = data as Record<string, unknown>;
  const enrichedLessons = Array.isArray(d.enrichedLessons)
    ? d.enrichedLessons.map(normalizeEnrichedLesson)
    : [];
  const additionalUnit = d.additionalUnit
    ? enforceExpansionUnitStructure(normalizeUnit(d.additionalUnit))
    : undefined;
  return {
    enrichedLessons,
    ...(additionalUnit ? { additionalUnit } : {}),
  };
}
