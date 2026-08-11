import { createId } from "./id";
import type { QuizQuestion } from "./types";

interface ParsedQuiz {
  prompt: string;
  options: Array<{ text: string; correct: boolean }>;
  explanation: string;
  cleanedBody: string;
}

/**
 * Extract inline multiple-choice questions from lesson body text.
 * Handles: "Question? A) one, B) two, C) three, D) four"
 */
export function parseInlineQuiz(body: string): ParsedQuiz | null {
  const patterns = [
    /([\s\S]+?\?)\s*A\)\s*([^,]+?),\s*B\)\s*([^,]+?),\s*C\)\s*([^,]+?),\s*D\)\s*([\s\S]+)$/i,
    /([\s\S]+?\?)\s*A\.\s*([^,]+?),\s*B\.\s*([^,]+?),\s*C\.\s*([^,]+?),\s*D\.\s*([\s\S]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (!match) continue;

    const prompt = match[1].trim();
    const optionTexts = [match[2], match[3], match[4], match[5]].map((t) => t.trim());
    const questionStart = body.indexOf(prompt);
    const cleanedBody = questionStart > 0 ? body.slice(0, questionStart).trim() : "";

    const answerHint = body.match(/(?:correct answer|answer)[:\s]+([A-D])/i);
    const correctIndex = answerHint
      ? answerHint[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0)
      : 0;

    return {
      prompt,
      options: optionTexts.map((text, i) => ({
        text,
        correct: i === correctIndex,
      })),
      explanation: "Review the lesson content if you missed this one.",
      cleanedBody: cleanedBody || body.slice(0, Math.max(0, questionStart)).trim(),
    };
  }

  return null;
}

export function resolveLessonQuestion(
  lessonType: string,
  body: string,
  existing?: QuizQuestion,
): QuizQuestion | undefined {
  if (existing?.options?.length) return existing;
  if (lessonType !== "quiz" && lessonType !== "problem" && lessonType !== "review") return existing;

  const parsed = parseInlineQuiz(body);
  if (!parsed) return existing;

  return {
    id: existing?.id ?? createId("q"),
    prompt: parsed.prompt,
    options: parsed.options.map((opt) => ({
      id: createId("opt"),
      text: opt.text,
      correct: opt.correct,
    })),
    explanation: existing?.explanation || parsed.explanation,
  };
}

export function bodyWithoutInlineQuiz(body: string, question?: QuizQuestion): string {
  if (!question) return body;
  const parsed = parseInlineQuiz(body);
  if (parsed?.cleanedBody) return parsed.cleanedBody;
  return body;
}
