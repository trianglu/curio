import { z } from "zod";

export const confidenceLevelSchema = z.enum([
  "established",
  "consensus",
  "debated",
  "emerging",
  "unknown",
]);

export const disputedClaimSchema = z.object({
  topic: z.string(),
  perspectives: z.array(z.string()).min(2).max(4),
});

export const aiQuizOptionSchema = z.object({
  text: z.string(),
  correct: z.boolean(),
});

export const aiQuizSchema = z.object({
  prompt: z.string(),
  options: z.array(aiQuizOptionSchema).length(4),
  explanation: z.string(),
});

export const aiLessonContentSchema = z.object({
  summary: z.string(),
  body: z.string(),
  analogy: z.string().optional(),
  keyPoints: z.array(z.string()).min(2).max(5),
  question: aiQuizSchema.optional(),
  confidenceLevel: confidenceLevelSchema,
  caveats: z.array(z.string()),
  disputedClaims: z.array(disputedClaimSchema).optional(),
  verifyWith: z.array(z.string()).optional(),
});

export const aiLessonSchema = z.object({
  title: z.string(),
  type: z.enum(["concept", "analogy", "summary", "quiz", "problem", "deep-dive"]),
  estimatedMinutes: z.number().int().min(1).max(45),
  content: aiLessonContentSchema,
});

export const UNIT_LESSONS_MIN = 7;
export const UNIT_LESSONS_MAX = 12;

export const aiUnitSchema = z.object({
  title: z.string(),
  description: z.string(),
  depth: z.number().int().min(1).max(5),
  lessons: z.array(aiLessonSchema).min(UNIT_LESSONS_MIN).max(UNIT_LESSONS_MAX),
});

const aiPathUnitSchema = aiUnitSchema.superRefine((unit, ctx) => {
  refineExpansionUnit(unit, ctx, false);
});

export const aiPathResponseSchema = z.object({
  units: z.array(aiPathUnitSchema).min(1).max(4),
});

/** Groq free tier cannot fit 7-12 lesson units in one request. */
export const aiCompactUnitSchema = z.object({
  title: z.string(),
  description: z.string(),
  depth: z.number().int().min(1).max(5),
  lessons: z.array(aiLessonSchema).min(5).max(7),
});

export const aiExpansionUnitSchema = aiUnitSchema;

function hasValidQuizQuestion(lesson: z.infer<typeof aiLessonSchema>): boolean {
  const q = lesson.content.question;
  if (!q) return false;
  if (q.prompt.length < 12 || q.prompt === "Review question") return false;
  if (q.options.length !== 4) return false;
  if (!q.options.some((o) => o.correct)) return false;
  if (q.options.some((o) => !o.text || o.text.startsWith("Option "))) return false;
  return q.explanation.length > 8;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function minBodyWords(type: string, compact: boolean): number | null {
  if (type === "quiz") return null;
  if (compact) {
    if (type === "deep-dive") return 140;
    if (type === "problem") return 70;
    return 90;
  }
  if (type === "deep-dive") return 550;
  if (type === "problem") return 200;
  return 320;
}

function refineTeachingLessonDepth(
  lesson: z.infer<typeof aiLessonSchema>,
  lessonIndex: number,
  ctx: z.RefinementCtx,
  compact: boolean,
) {
  const min = minBodyWords(lesson.type, compact);
  if (min === null) return;
  const words = countWords(lesson.content.body);
  if (words < min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Lesson "${lesson.title}" body too short (${words} words, need ${min}+) — add more paragraphs`,
      path: ["lessons", lessonIndex, "content", "body"],
    });
  }
}

function refineExpansionUnit(
  unit: z.infer<typeof aiExpansionUnitSchema>,
  ctx: z.RefinementCtx,
  compact = false,
) {
  unit.lessons.forEach((lesson, index) => {
    refineTeachingLessonDepth(lesson, index, ctx, compact);
  });
  const last = unit.lessons[unit.lessons.length - 1];
  if (last.type !== "quiz") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Last lesson must have type quiz",
      path: ["lessons", unit.lessons.length - 1, "type"],
    });
  }
  if (!hasValidQuizQuestion(last)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Quiz lesson must include a valid content.question",
      path: ["lessons", unit.lessons.length - 1, "content", "question"],
    });
  }

  const problem = unit.lessons.find((l) => l.type === "problem");
  if (problem && !hasValidQuizQuestion(problem)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Problem lesson must include a valid content.question",
      path: ["lessons", unit.lessons.indexOf(problem), "content", "question"],
    });
  }
}

const aiExpansionUnitWithQuizSchema = aiExpansionUnitSchema.superRefine((unit, ctx) => {
  refineExpansionUnit(unit, ctx, false);
});

const aiCompactUnitWithQuizSchema = aiCompactUnitSchema.superRefine((unit, ctx) => {
  refineExpansionUnit(unit, ctx, true);
});

export const aiCompactPathResponseSchema = z.object({
  units: z.array(aiCompactUnitWithQuizSchema).min(1).max(1),
});

export const aiExpansionResponseSchema = z
  .object({
    canExpand: z.boolean().optional(),
    stopReason: z.string().optional(),
    unit: aiExpansionUnitWithQuizSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.canExpand === false) {
      if (!data.stopReason || data.stopReason.trim().length < 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "stopReason required when canExpand is false",
          path: ["stopReason"],
        });
      }
      return;
    }
    if (!data.unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unit required when expanding",
        path: ["unit"],
      });
    }
  });

const aiEnrichedLessonSchema = z.object({
  title: z.string(),
  type: z
    .enum(["concept", "analogy", "summary", "quiz", "problem", "deep-dive"])
    .optional(),
  estimatedMinutes: z.number().int().min(1).max(45).optional(),
  content: aiLessonContentSchema,
});

export const aiPathUpgradeResponseSchema = z.object({
  enrichedLessons: z.array(aiEnrichedLessonSchema).min(1),
  additionalUnit: aiExpansionUnitWithQuizSchema.optional(),
});

export type AiPathResponse = z.infer<typeof aiPathResponseSchema>;
export type AiExpansionResponse = z.infer<typeof aiExpansionResponseSchema>;
export type AiPathUpgradeResponse = z.infer<typeof aiPathUpgradeResponseSchema>;

export function isExpansionStopResponse(
  response: AiExpansionResponse,
): response is AiExpansionResponse & { canExpand: false; stopReason: string } {
  return response.canExpand === false;
}
export type AiLesson = z.infer<typeof aiLessonSchema>;
export type AiUnit = z.infer<typeof aiUnitSchema>;
