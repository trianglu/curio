"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccuracyPanel } from "@/components/accuracy-panel";
import { AudioPlayer } from "@/components/audio-player";
import { LessonCelebration } from "@/components/lesson-celebration";
import { useLearning } from "@/context/learning-context";
import { bodyWithoutInlineQuiz, resolveLessonQuestion } from "@/lib/parse-quiz";
import {
  completeLesson,
  getLessonXpGain,
  getNextAvailableLesson,
  getUnitForLesson,
  isUnitFullyCompleted,
} from "@/lib/path-engine";
import type { LearningPath, Lesson } from "@/lib/types";

interface LessonPlayerProps {
  lesson: Lesson;
  path: LearningPath;
  pathId: string;
}

export function LessonPlayer({ lesson, path, pathId }: LessonPlayerProps) {
  const router = useRouter();
  const { completeLessonById } = useLearning();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [completed, setCompleted] = useState(lesson.status === "completed");
  const [celebration, setCelebration] = useState<{
    variant: "lesson" | "unit" | "checkpoint";
    xp: number;
    nextLesson?: Lesson;
    unitTitle?: string;
  } | null>(null);

  const question = useMemo(
    () => resolveLessonQuestion(lesson.type, lesson.content.body, lesson.content.question),
    [lesson.type, lesson.content.body, lesson.content.question],
  );

  const displayBody = useMemo(
    () => bodyWithoutInlineQuiz(lesson.content.body, question),
    [lesson.content.body, question],
  );

  const hasQuiz = Boolean(question);
  const isProblemLesson = lesson.type === "problem";
  const isQuizLesson = lesson.type === "quiz";
  const isReviewLesson = lesson.type === "review";
  const canComplete = !hasQuiz || showExplanation;
  const showAudio = !isQuizLesson && !isProblemLesson && !isReviewLesson;

  const finishCelebration = useCallback(() => {
    router.push(`/learn/${pathId}`);
  }, [pathId, router]);

  function handleComplete() {
    if (!canComplete || completed || celebration) return;

    const updatedPath = completeLesson(path, lesson.id);
    const unit = getUnitForLesson(updatedPath, lesson.id);
    const updatedUnit = unit
      ? updatedPath.units.find((candidate) => candidate.id === unit.id)
      : undefined;
    const unitComplete = updatedUnit ? isUnitFullyCompleted(updatedUnit) : false;
    const nextLesson = getNextAvailableLesson(updatedPath);
    const xp = getLessonXpGain(lesson);

    completeLessonById(lesson.id);
    setCompleted(true);
    setCelebration({
      variant: unitComplete ? (unit?.kind === "checkpoint" ? "checkpoint" : "unit") : "lesson",
      xp,
      nextLesson,
      unitTitle: unit?.title,
    });
  }

  function handleOptionSelect(optionId: string) {
    if (showExplanation) return;
    setSelectedOption(optionId);
    setShowExplanation(true);
  }

  return (
    <>
      {celebration && (
        <LessonCelebration
          variant={celebration.variant}
          xp={celebration.xp}
          lessonTitle={lesson.title}
          unitTitle={celebration.unitTitle}
          nextLesson={celebration.nextLesson}
          onDone={finishCelebration}
        />
      )}

      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium capitalize text-indigo-700">
              {isReviewLesson ? "recall round" : lesson.type.replace("-", " ")}
            </span>
            {isReviewLesson && lesson.reviewSource && (
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                From {lesson.reviewSource.unitTitle}
              </span>
            )}
            {!isReviewLesson &&
              !lesson.content.caveats?.some((c) => c.includes("template")) && (
              <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                AI generated
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-bold text-stone-900">{lesson.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{lesson.estimatedMinutes} min</p>
        </div>

        {showAudio && (
          <AudioPlayer content={lesson.content} title={lesson.title} autoPlay={false} />
        )}

        {isReviewLesson && lesson.reviewSource && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-sm text-amber-950">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Memory bridge</p>
            <p className="mt-1">
              Originally a {lesson.reviewSource.sourceType === "problem" ? "practice problem" : "unit quiz"} in{" "}
              <span className="font-semibold">{lesson.reviewSource.unitTitle}</span>
              {" — "}
              <span className="text-amber-900/80">{lesson.reviewSource.lessonTitle}</span>
            </p>
            <button
              type="button"
              onClick={() => router.push(`/lesson/${pathId}/${lesson.reviewSource!.lessonId}`)}
              className="mt-2 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950"
            >
              Revisit the original lesson
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-indigo-600">{lesson.content.summary}</p>
          {displayBody && (
            <div className="mt-4 whitespace-pre-line leading-relaxed text-stone-700">{displayBody}</div>
          )}

          {lesson.type === "deep-dive" && (
            <div className="mt-4 rounded-xl bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
              Deep dive — expect a longer, more detailed lesson
            </div>
          )}

          {lesson.content.analogy && (
            <div className="mt-6 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Analogy</p>
              <p className="mt-2 text-stone-700">{lesson.content.analogy}</p>
            </div>
          )}

          {lesson.content.keyPoints.length > 0 && !isQuizLesson && !isReviewLesson && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Key points</p>
              <ul className="mt-2 space-y-2">
                {lesson.content.keyPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!isQuizLesson && !isProblemLesson && !isReviewLesson && (
          <AccuracyPanel content={lesson.content} />
        )}

        {isReviewLesson && !question && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This recall card is missing its question — complete other lessons first, then regenerate if needed.
          </div>
        )}

        {question ? (
          <div className={`rounded-2xl border bg-white p-6 shadow-sm ${
            isReviewLesson ? "border-amber-200 ring-1 ring-amber-100" : "border-stone-200"
          }`}>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              {isReviewLesson
                ? "Pull it from memory"
                : isQuizLesson
                  ? "Unit review — based on what you just learned"
                  : isProblemLesson
                    ? "Active recall — apply what you learned"
                    : "Active recall"}
            </p>
            {(isQuizLesson || isProblemLesson || isReviewLesson) && (
              <p className="mt-1 text-xs text-stone-500">
                {isReviewLesson
                  ? "No hints in the question — see how much stuck from earlier units."
                  : isQuizLesson
                    ? "This quiz tests facts from every lesson before it in this unit."
                    : "Work through the scenario above, then answer to check your understanding."}
              </p>
            )}
            <p className="mt-2 font-medium text-stone-900">{question.prompt}</p>
            <div className="mt-4 space-y-2">
              {question.options.map((option) => {
                const isSelected = selectedOption === option.id;
                let optionStyle =
                  "border-stone-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer";

                if (showExplanation) {
                  if (option.correct) optionStyle = "border-emerald-400 bg-emerald-50";
                  else if (isSelected) optionStyle = "border-red-300 bg-red-50";
                  else optionStyle = "border-stone-200 opacity-60";
                } else if (isSelected) {
                  optionStyle = "border-indigo-400 bg-indigo-50";
                }

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={showExplanation}
                    onClick={() => handleOptionSelect(option.id)}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors ${optionStyle}`}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>
            {showExplanation && (
              <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
                {question.explanation}
              </p>
            )}
          </div>
        ) : isQuizLesson ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This quiz lesson is missing interactive options. Regenerate the path with AI to fix it.
          </div>
        ) : null}

        <div className="flex gap-3 pb-8">
          <button
            type="button"
            onClick={() => router.push(`/learn/${pathId}`)}
            className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Back to path
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={!canComplete || completed || Boolean(celebration)}
            className={`flex-1 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
              completed
                ? "bg-emerald-100 text-emerald-700"
                : canComplete
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            {completed
              ? "Completed ✓"
              : hasQuiz && !showExplanation
                ? "Select an answer to continue"
                : "Complete lesson"}
          </button>
        </div>
      </div>
    </>
  );
}
