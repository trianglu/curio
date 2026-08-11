"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLearning } from "@/context/learning-context";
import { generateInitialPath } from "@/lib/mock-generator";

const EXAMPLE_SUBJECT = "Quantum Physics";

const SAMPLE_LESSONS = [
  { title: "The Big Picture", type: "Summary", minutes: 3 },
  { title: "Everyday Connections", type: "Analogy", minutes: 2 },
  { title: "Core Vocabulary", type: "Concept", minutes: 4 },
  { title: "Check Your Intuition", type: "Quiz", minutes: 5 },
];

export default function ExamplePage() {
  const router = useRouter();
  const { seedPath } = useLearning();
  const [starting, setStarting] = useState(false);

  function handleStart() {
    setStarting(true);
    try {
      const path = generateInitialPath(EXAMPLE_SUBJECT);
      path.expansionStatus = "paused";
      seedPath(path);
      router.push(`/learn/${path.id}`);
    } catch {
      setStarting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 pb-16 sm:py-14">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-violet-600">
        Interactive example
      </p>
      <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
        Tour Curio with <span className="curio-gradient-text">{EXAMPLE_SUBJECT}</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-center text-stone-600">
        Explore a sample learning path without API keys. This uses template lessons so you can see the
        full Duolingo-style map, lesson player, and accuracy UI. Add AI keys later for real,
        subject-specific content (see the README).
      </p>

      <div className="mt-10 rounded-3xl border border-white/80 bg-white/70 p-6 shadow-md backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Sample path</p>
            <h2 className="mt-1 text-xl font-bold text-stone-900">{EXAMPLE_SUBJECT}</h2>
            <p className="mt-1 text-sm text-stone-600">4 foundation lessons · template content</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-2xl">
            ⚛️
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {SAMPLE_LESSONS.map((lesson, index) => (
            <li
              key={lesson.title}
              className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50/80 px-4 py-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-900">{lesson.title}</p>
                <p className="text-xs text-stone-500">
                  {lesson.type} · {lesson.minutes} min
                </p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="mt-6 w-full rounded-xl curio-btn-primary py-4 text-base font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          {starting ? "Opening path…" : "Start the example path"}
        </button>
      </div>

      <div className="mt-8 space-y-3 text-center text-sm text-stone-600">
        <p>
          Want real AI lessons? Configure keys in{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">.env.local</code> — steps are
          in the project README.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="font-medium text-violet-700 underline-offset-2 hover:underline"
        >
          ← Back to home
        </button>
      </div>
    </section>
  );
}
