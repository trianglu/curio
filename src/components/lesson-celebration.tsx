"use client";

import { useMemo } from "react";
import type { Lesson } from "@/lib/types";

interface LessonCelebrationProps {
  variant: "lesson" | "unit" | "checkpoint";
  xp: number;
  lessonTitle: string;
  unitTitle?: string;
  nextLesson?: Lesson;
  onDone: () => void;
}

function Confetti({ count }: { count: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 11) % 100}%`,
        delay: `${(i % 8) * 0.08}s`,
        duration: `${1.8 + (i % 5) * 0.2}s`,
        color: ["#6366f1", "#a855f7", "#ec4899", "#10b981", "#f59e0b", "#38bdf8"][i % 6],
        size: 6 + (i % 4) * 2,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="celebration-confetti absolute top-0 rounded-sm"
          style={{
            left: piece.left,
            width: piece.size,
            height: piece.size * 1.4,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
        />
      ))}
    </div>
  );
}

export function LessonCelebration({
  variant,
  xp,
  lessonTitle,
  unitTitle,
  nextLesson,
  onDone,
}: LessonCelebrationProps) {
  const isUnit = variant === "unit";
  const isCheckpoint = variant === "checkpoint";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-live="polite"
      aria-label={isCheckpoint ? "Recall round complete" : isUnit ? "Unit complete" : "Lesson complete"}
    >
      <Confetti count={isCheckpoint ? 22 : isUnit ? 28 : 14} />

      <div
        className={`celebration-pop relative w-full max-w-sm rounded-3xl border bg-white p-6 text-center shadow-2xl ${
          isCheckpoint
            ? "border-amber-200 ring-4 ring-amber-100"
            : isUnit
              ? "border-amber-200 ring-4 ring-amber-100"
              : "border-emerald-200 ring-4 ring-emerald-100"
        }`}
      >
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
            isCheckpoint
              ? "bg-gradient-to-br from-amber-400 to-orange-400"
              : isUnit
                ? "bg-gradient-to-br from-amber-300 to-orange-400"
                : "bg-gradient-to-br from-emerald-400 to-teal-500"
          }`}
        >
          {isCheckpoint ? "🧠" : isUnit ? "🏆" : "✓"}
        </div>

        <p
          className={`mt-4 text-xs font-bold uppercase tracking-widest ${
            isCheckpoint || isUnit ? "text-amber-600" : "text-emerald-600"
          }`}
        >
          {isCheckpoint ? "Recall round complete!" : isUnit ? "Unit complete!" : "Lesson complete!"}
        </p>

        <h2 className="mt-2 text-xl font-bold text-stone-900">
          {isUnit || isCheckpoint ? unitTitle : lessonTitle}
        </h2>

        {isCheckpoint && (
          <p className="mt-1 text-sm text-stone-500">
            Memory strengthened — you recycled everything you&apos;ve learned so far
          </p>
        )}

        {isUnit && !isCheckpoint && (
          <p className="mt-1 text-sm text-stone-500">You finished every lesson in this unit</p>
        )}

        <p
          className={`mt-4 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${
            isCheckpoint || isUnit ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          +{xp} XP
        </p>

        {nextLesson ? (
          <div className="celebration-next mt-5 rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
              {isCheckpoint ? "Next on your path" : isUnit ? "Next unit starts with" : "Up next"}
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">{nextLesson.title}</p>
            <p className="mt-2 text-xs text-violet-700">↓ Unlocking on your path</p>
          </div>
        ) : (
          <p className="mt-5 text-sm text-stone-500">You&apos;re caught up — more lessons coming soon</p>
        )}

        <button
          type="button"
          onClick={onDone}
          className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] ${
            isCheckpoint || isUnit
              ? "bg-gradient-to-r from-amber-500 to-orange-500"
              : "curio-btn-primary"
          }`}
        >
          {nextLesson ? "Continue to path" : "Back to path"}
        </button>
      </div>
    </div>
  );
}
