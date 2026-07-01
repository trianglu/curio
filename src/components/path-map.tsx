"use client";

import Link from "next/link";
import type { Lesson, Unit } from "@/lib/types";

const TYPE_ICONS: Record<string, string> = {
  concept: "💡",
  analogy: "🌉",
  summary: "📝",
  quiz: "❓",
  problem: "🧩",
  "deep-dive": "🔬",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-500 text-white ring-emerald-600",
  available: "bg-indigo-500 text-white ring-indigo-600 shadow-lg shadow-indigo-200 animate-bounce-subtle",
  in_progress: "bg-amber-400 text-white ring-amber-500",
  locked: "bg-stone-200 text-stone-400 ring-stone-300",
};

interface PathMapProps {
  pathId: string;
  units: Unit[];
  mode: "passive" | "aggressive";
}

export function PathMap({ pathId, units, mode }: PathMapProps) {
  return (
    <div className="space-y-8">
      {units.map((unit, unitIndex) => {
        const visibleLessons = unit.lessons.filter(
          (lesson) => lesson.mode === "both" || lesson.mode === mode,
        );

        if (visibleLessons.length === 0) return null;

        return (
          <section key={unit.id}>
            <div className="mb-4 text-center">
              <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                Unit {unitIndex + 1}
              </span>
              <h2 className="mt-2 text-lg font-semibold text-stone-900">{unit.title}</h2>
              <p className="text-sm text-stone-500">{unit.description}</p>
            </div>

            <div className="relative mx-auto flex max-w-xs flex-col items-center gap-3">
              {unitIndex % 2 === 1 && <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-stone-200" />}
              {visibleLessons.map((lesson, lessonIndex) => (
                <LessonNode
                  key={lesson.id}
                  lesson={lesson}
                  pathId={pathId}
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

function LessonNode({
  lesson,
  pathId,
  offset,
}: {
  lesson: Lesson;
  pathId: string;
  offset: "left" | "right";
}) {
  const icon = TYPE_ICONS[lesson.type] ?? "📖";
  const style = STATUS_STYLES[lesson.status];
  const isClickable = lesson.status === "available" || lesson.status === "completed";

  const node = (
    <div
      className={`relative flex h-16 w-16 items-center justify-center rounded-full ring-4 transition-transform ${style} ${
        isClickable ? "hover:scale-105" : ""
      } ${offset === "left" ? "-translate-x-8" : "translate-x-8"}`}
      title={lesson.title}
    >
      <span className="text-xl">{icon}</span>
      {lesson.status === "completed" && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs text-emerald-600 ring-2 ring-emerald-500">
          ✓
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-1">
      {isClickable ? (
        <Link href={`/lesson/${pathId}/${lesson.id}`}>{node}</Link>
      ) : (
        node
      )}
      <p className={`max-w-[140px] text-center text-xs ${lesson.status === "locked" ? "text-stone-400" : "text-stone-700"}`}>
        {lesson.title}
        {lesson.isNew && (
          <span className="ml-1 inline-block rounded bg-violet-100 px-1 text-[10px] font-medium text-violet-700">
            NEW
          </span>
        )}
      </p>
      <p className="text-[10px] text-stone-400">{lesson.estimatedMinutes} min</p>
    </div>
  );
}
