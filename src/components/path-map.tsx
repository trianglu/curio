"use client";

import Link from "next/link";
import { getUnitTheme, LESSON_TYPE_RING } from "@/lib/theme";
import type { Lesson, Unit } from "@/lib/types";

const TYPE_ICONS: Record<string, string> = {
  concept: "💡",
  analogy: "🌉",
  summary: "📝",
  quiz: "❓",
  problem: "🧩",
  review: "🧠",
  "deep-dive": "🔬",
};

interface PathMapProps {
  pathId: string;
  units: Unit[];
}

export function PathMap({ pathId, units }: PathMapProps) {
  let contentUnitNumber = 0;

  return (
    <div className="space-y-10">
      {units.map((unit) => {
        const visibleLessons = unit.lessons;
        if (visibleLessons.length === 0) return null;

        const isCheckpoint = unit.kind === "checkpoint";
        if (!isCheckpoint) contentUnitNumber += 1;
        const theme = getUnitTheme(contentUnitNumber - 1, unit.kind);

        return (
          <section
            key={unit.id}
            className={`curio-card rounded-3xl border p-5 shadow-md ${
              isCheckpoint
                ? "border-amber-200/90 bg-gradient-to-b from-amber-50/90 to-orange-50/50 shadow-amber-100/50"
                : "border-white/80"
            }`}
          >
            <div className="mb-6 text-center">
              <span
                className={`inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${theme.badge}`}
              >
                {isCheckpoint ? "🧠 Recall round" : `Unit ${contentUnitNumber}`}
              </span>
              <h2 className={`mt-2 text-xl font-bold ${theme.title}`}>{unit.title}</h2>
              <p className="mt-1 text-sm font-medium text-stone-700">{unit.description}</p>
              {isCheckpoint && (
                <p className="mt-2 text-xs text-amber-800/80">
                  Mixed questions from everything you&apos;ve learned so far — no new teaching.
                </p>
              )}
            </div>

            <div className="relative mx-auto flex max-w-sm flex-col items-center gap-6">
              <div
                className={`absolute inset-y-6 left-1/2 z-0 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b ${theme.connector}`}
              />
              {visibleLessons.map((lesson, lessonIndex) => (
                <LessonNode
                  key={lesson.id}
                  lesson={lesson}
                  pathId={pathId}
                  theme={theme}
                  offset={lessonIndex % 2 === 0 ? "left" : "right"}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function lessonStyle(
  lesson: Lesson,
  theme: ReturnType<typeof getUnitTheme>,
): string {
  const typeRing = LESSON_TYPE_RING[lesson.type] ?? "ring-indigo-300";
  const base = `ring-4 shadow-lg ${typeRing}`;

  if (lesson.status === "completed") return `${base} ${theme.completed}`;
  if (lesson.status === "available") {
    return `${base} ${theme.available} animate-bounce-subtle`;
  }
  if (lesson.status === "in_progress") {
    return `${base} bg-amber-400 text-white ring-amber-300 shadow-amber-200/50`;
  }
  return `${base} ${theme.locked}`;
}

function labelStyles(status: Lesson["status"]) {
  switch (status) {
    case "available":
      return {
        card: "border-violet-200 bg-white shadow-md ring-1 ring-violet-100",
        title: "text-stone-900 font-semibold",
        meta: "text-violet-700 font-semibold",
      };
    case "completed":
      return {
        card: "border-emerald-200 bg-white shadow-sm ring-1 ring-emerald-100",
        title: "text-stone-900 font-semibold",
        meta: "text-emerald-700 font-medium",
      };
    case "in_progress":
      return {
        card: "border-amber-200 bg-white shadow-sm ring-1 ring-amber-100",
        title: "text-stone-900 font-semibold",
        meta: "text-amber-700 font-medium",
      };
    default:
      return {
        card: "border-stone-200 bg-stone-50/95 shadow-sm",
        title: "text-stone-700 font-medium",
        meta: "text-stone-600 font-medium",
      };
  }
}

function LessonNode({
  lesson,
  pathId,
  theme,
  offset,
}: {
  lesson: Lesson;
  pathId: string;
  theme: ReturnType<typeof getUnitTheme>;
  offset: "left" | "right";
}) {
  const icon = TYPE_ICONS[lesson.type] ?? "📖";
  const style = lessonStyle(lesson, theme);
  const labels = labelStyles(lesson.status);
  const isClickable = lesson.status === "available" || lesson.status === "completed";
  const isUpNext = lesson.status === "available";

  const node = (
    <div
      className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full transition-transform ${style} ${
        isClickable ? "hover:scale-110" : "opacity-90"
      } ${offset === "left" ? "-translate-x-6 sm:-translate-x-8" : "translate-x-6 sm:translate-x-8"}`}
      title={lesson.title}
    >
      <span className="text-xl">{icon}</span>
      {lesson.status === "completed" && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-600 ring-2 ring-emerald-400">
          ✓
        </span>
      )}
      {lesson.type === "review" && lesson.status !== "completed" && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white ring-2 ring-white">
          🧠
        </span>
      )}
    </div>
  );

  return (
    <div className="relative z-10 flex w-full max-w-[220px] flex-col items-center gap-2">
      {isClickable ? (
        <Link href={`/lesson/${pathId}/${lesson.id}`} className="flex flex-col items-center gap-2">
          {node}
          <LessonLabel lesson={lesson} labels={labels} isUpNext={isUpNext} />
        </Link>
      ) : (
        <>
          {node}
          <LessonLabel lesson={lesson} labels={labels} isUpNext={isUpNext} />
        </>
      )}
    </div>
  );
}

function LessonLabel({
  lesson,
  labels,
  isUpNext,
}: {
  lesson: Lesson;
  labels: ReturnType<typeof labelStyles>;
  isUpNext?: boolean;
}) {
  return (
    <div
      className={`relative z-20 w-full rounded-xl border px-3 py-2 text-center ${labels.card}`}
    >
      {isUpNext && (
        <span className="mb-1.5 inline-block rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Up next
        </span>
      )}
      <p className={`text-sm leading-snug ${labels.title}`}>{lesson.title}</p>
      {lesson.reviewSource && (
        <p className="mt-0.5 text-[10px] font-medium text-amber-700">
          {lesson.reviewSource.unitTitle}
        </p>
      )}
      <p className={`mt-0.5 text-xs ${labels.meta}`}>{lesson.estimatedMinutes} min</p>
      {lesson.isNew && (
        <span className="mt-1 inline-block rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          New
        </span>
      )}
    </div>
  );
}
