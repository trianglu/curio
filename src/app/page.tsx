"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingPath } from "@/components/loading-path";
import { PathListItem } from "@/components/path-list-item";
import { ExamplePromptBanner } from "@/components/template-banner";
import { useLearning } from "@/context/learning-context";
import { EXAMPLE_SUBJECT_COLORS } from "@/lib/theme";

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
  const [generatingSubject, setGeneratingSubject] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [hasAi, setHasAi] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/generate/path")
      .then((r) => r.json())
      .then((data) => setHasAi(data.hasAi ?? false))
      .catch(() => setHasAi(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = subject.trim();
    if (!trimmed) return;

    setError("");
    setGeneratingSubject(trimmed);
    try {
      const path = await createPath(trimmed);
      router.push(`/learn/${path.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate path. Please try again.");
    } finally {
      setGeneratingSubject(null);
    }
  }

  function selectSubject(example: string) {
    setSubject(example);
    setError("");
  }

  if (isGenerating && generatingSubject) {
    return <LoadingPath subject={generatingSubject} stage="AI is building your curriculum…" />;
  }

  const canGenerate = subject.trim().length > 0 && !isGenerating;

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 pb-16 sm:py-14">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl curio-btn-primary text-3xl font-bold text-white">
          C
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="curio-gradient-text">Learn anything,</span>
          <br />
          <span className="text-stone-900">truthfully</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-stone-600">
          Curio builds a personalized path for any subject — and is upfront when experts
          disagree. No fabricated facts. No false certainty.
        </p>
      </div>

      {mounted && hasAi === false && <ExamplePromptBanner />}

      {mounted && hasAi === true && (
        <p className="mt-6 text-center text-sm text-stone-500">
          New here?{" "}
          <a href="/example" className="font-medium text-violet-700 underline-offset-2 hover:underline">
            Try the example path
          </a>{" "}
          first.
        </p>
      )}

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
            className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <p className="mt-2 text-xs text-stone-500">Tap an example or type your own topic:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLE_SUBJECTS.map((example, index) => {
              const selected = subject === example;
              const colorClass = EXAMPLE_SUBJECT_COLORS[index % EXAMPLE_SUBJECT_COLORS.length];
              return (
                <button
                  key={example}
                  type="button"
                  onClick={() => selectSubject(example)}
                  className={`min-h-11 cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
                    selected
                      ? "curio-btn-primary border-transparent text-white shadow-md"
                      : colorClass
                  }`}
                >
                  {example}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {!canGenerate && (
          <p className="text-center text-xs text-stone-500">
            Select a topic above to enable generation
          </p>
        )}

        <button
          type="submit"
          disabled={!canGenerate}
          className={`w-full rounded-xl py-4 text-base font-bold transition-all active:scale-[0.99] ${
            canGenerate
              ? "cursor-pointer curio-btn-primary text-white hover:scale-[1.01]"
              : "cursor-not-allowed bg-stone-200 text-stone-400"
          }`}
        >
          {isGenerating ? "Generating…" : "Generate my learning path"}
        </button>
      </form>

      <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
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
              <PathListItem key={path.id} path={path} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
