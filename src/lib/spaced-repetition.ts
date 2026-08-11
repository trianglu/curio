/**
 * SM-2 spaced repetition algorithm (simplified).
 * Quality: 0-5 where 0=complete blackout, 5=perfect recall.
 */

import { createId } from "./id";
import type { ReviewCard } from "./types";

export interface Sm2Input {
  easeFactor: number;
  interval: number;
  repetitions: number;
}

export interface Sm2Result extends Sm2Input {
  nextReviewDate: string;
}

export function sm2Update(
  card: Sm2Input,
  quality: number,
  today = new Date(),
): Sm2Result {
  const q = Math.max(0, Math.min(5, quality));
  let { easeFactor, interval, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 3;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  const next = new Date(today);
  next.setDate(next.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: next.toISOString().slice(0, 10),
  };
}

export function qualityFromAnswer(correct: boolean, hesitated: boolean): number {
  if (correct && !hesitated) return 5;
  if (correct && hesitated) return 4;
  if (!correct) return 1;
  return 2;
}

export function isDueForReview(nextReviewDate: string, today = new Date()): boolean {
  const todayStr = today.toISOString().slice(0, 10);
  return nextReviewDate <= todayStr;
}

export function createReviewCardFromQuestion(
  question: {
    id: string;
    prompt: string;
    options: Array<{ id: string; text: string; correct: boolean }>;
    explanation: string;
  },
  meta: { lessonId: string; pathId: string; subject: string },
): ReviewCard {
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: createId("review"),
    questionId: question.id,
    lessonId: meta.lessonId,
    pathId: meta.pathId,
    subject: meta.subject,
    prompt: question.prompt,
    options: question.options,
    explanation: question.explanation,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: today,
    lastReviewDate: null,
  };
}
