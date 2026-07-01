"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccuracyPanel } from "@/components/accuracy-panel";
import { AudioPlayer } from "@/components/audio-player";
import { useLearning } from "@/context/learning-context";
import type { Lesson } from "@/lib/types";

interface LessonPlayerProps {
  lesson: Lesson;
  pathId: string;
  pathMode: "passive" | "aggressive";
}

export function LessonPlayer({ lesson, pathId, pathMode }: LessonPlayerProps) {
  const router = useRouter();
  const { completeLessonById } = useLearning();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [completed, setCompleted] = useState(lesson.status === "completed");

  const question = lesson.content.question;
  const hasQuiz = Boolean(question);
  const canComplete = !hasQuiz || showExplanation;
  const showAudio = pathMode === "passive" || lesson.mode === "passive" || lesson.mode === "both";

  function handleComplete() {
    if (!canComplete || completed) return;
    completeLessonById(lesson.id);
    setCompleted(true);
  }

  function handleOptionSelect(optionId: string) {
    if (showExplanation) return;
    setSelectedOption(optionId);
    setShowExplanation(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium capitalize text-indigo-700">
            {lesson.type.replace("-", " ")}
          </span>
          {!lesson.content.caveats?.some((c) => c.includes("template")) && (
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              AI generated
            </span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-stone-900">{lesson.title}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {lesson.estimatedMinutes} min ·{" "}
          {lesson.mode === "both" ? "All modes" : `${lesson.mode} mode`}
        </p>
      </div>

      {showAudio && (
        <AudioPlayer content={lesson.content} title={lesson.title} autoPlay={pathMode === "passive"} />
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-indigo-600">{lesson.content.summary}</p>
        <div className="mt-4 whitespace-pre-line leading-relaxed text-stone-700">
          {lesson.content.body}
        </div>

        {lesson.content.analogy && (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Analogy</p>
            <p className="mt-2 text-stone-700">{lesson.content.analogy}</p>
          </div>
        )}

        {lesson.content.keyPoints.length > 0 && (
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

      <AccuracyPanel content={lesson.content} />

      {question && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            Active recall — added to spaced repetition
          </p>
          <p className="mt-2 font-medium text-stone-900">{question.prompt}</p>
          <div className="mt-4 space-y-2">
            {question.options.map((option) => {
              const isSelected = selectedOption === option.id;
              let optionStyle = "border-stone-200 hover:border-indigo-300 hover:bg-indigo-50/50";

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
      )}

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
          disabled={!canComplete || completed}
          className={`flex-1 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
            completed
              ? "bg-emerald-100 text-emerald-700"
              : canComplete
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-stone-200 text-stone-400"
          }`}
        >
          {completed
            ? "Completed ✓"
            : hasQuiz && !showExplanation
              ? "Answer to continue"
              : "Complete lesson"}
        </button>
      </div>
    </div>
  );
}
