"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingPath } from "@/components/loading-path";
import { ModeSelector } from "@/components/mode-selector";
import { useLearning } from "@/context/learning-context";
import type { LearningMode } from "@/lib/types";

const EXAMPLE_SUBJECTS = [
  "Quantum Physics",
  "Machine Learning",
  "Ancient Rome",
  "Organic Chemistry",
  "Game Theory",
];

export default function HomePage() {
  const router = useRouter();
  const { createPath, isGenerating, profile } = useLearning();
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<LearningMode>("passive");
  const [generatingSubject, setGeneratingSubject] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = subject.trim();
    if (!trimmed) return;

    setError("");
    setGeneratingSubject(trimmed);
    try {
      const path = await createPath(trimmed, mode);
      router.push(`/learn/${path.id}`);
    } catch {
      setError("Failed to generate path. Please try again.");
    } finally {
      setGeneratingSubject(null);
    }
  }

  if (isGenerating && generatingSubject) {
    return <LoadingPath subject={generatingSubject} stage="AI is building your curriculum…" />;
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 pb-16 sm:py-14">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl font-bold text-white shadow-lg shadow-indigo-200">
            C
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Learn anything,
            <br />
            truthfully
          </h1>
          <p className="mx-auto mt-4 max-w-md text-stone-600">
            Curio builds a personalized path for any subject — and is upfront when experts
            disagree. No fabricated facts. No false certainty.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-stone-700">
              What do you want to learn?
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Quantum Physics, Rust programming, Jazz history…"
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_SUBJECTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setSubject(example)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-stone-700">How do you want to learn?</p>
            <ModeSelector value={mode} onChange={setMode} />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={!subject.trim() || isGenerating}
            className="w-full rounded-xl bg-indigo-600 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:bg-stone-300 disabled:shadow-none"
          >
            {isGenerating ? "Generating…" : "Generate my learning path"}
          </button>
        </form>

        <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-sm font-medium text-emerald-900">Our accuracy commitment</p>
          <ul className="mt-2 space-y-1 text-xs text-emerald-800">
            <li>• We never invent statistics, quotes, or citations</li>
            <li>• Debated topics show multiple expert perspectives</li>
            <li>• Simplifications are flagged — analogies note where they break down</li>
            <li>• Quiz answers must be unambiguously correct</li>
          </ul>
        </div>

        {profile.paths.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Continue learning
            </h2>
            <div className="mt-3 space-y-2">
              {profile.paths.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => router.push(`/learn/${path.id}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
                >
                  <div>
                    <p className="font-medium text-stone-900">{path.subject}</p>
                    <p className="text-xs capitalize text-stone-500">
                      {path.mode} · {path.lessonsCompleted} lessons ·{" "}
                      {path.aiGenerated ? "AI" : "Template"}
                    </p>
                  </div>
                  <span className="text-indigo-600">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
    </section>
  );
}
