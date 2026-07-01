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
  mode: z.enum(["passive", "aggressive", "both"]),
  estimatedMinutes: z.number().int().min(1).max(45),
  content: aiLessonContentSchema,
});

export const aiUnitSchema = z.object({
  title: z.string(),
  description: z.string(),
  depth: z.number().int().min(1).max(5),
  lessons: z.array(aiLessonSchema).min(2).max(6),
});

export const aiPathResponseSchema = z.object({
  units: z.array(aiUnitSchema).min(1).max(4),
});

export const aiExpansionResponseSchema = z.object({
  unit: aiUnitSchema,
});

export type AiPathResponse = z.infer<typeof aiPathResponseSchema>;
export type AiExpansionResponse = z.infer<typeof aiExpansionResponseSchema>;
export type AiLesson = z.infer<typeof aiLessonSchema>;
export type AiUnit = z.infer<typeof aiUnitSchema>;
