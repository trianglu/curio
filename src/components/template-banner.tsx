"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLearning } from "@/context/learning-context";

export function TemplateBanner({ subject, pathId }: { subject: string; pathId: string }) {
  const router = useRouter();
  const { regeneratePath, isGenerating } = useLearning();
  const [error, setError] = useState("");

  async function handleRegenerate() {
    setError("");
    try {
      const path = await regeneratePath(pathId);
      router.push(`/learn/${path.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Template / example content</p>
      <p className="mt-1 text-xs text-amber-800">
        This path uses placeholder lessons (study structure and sample quiz UI), not AI-researched{" "}
        {subject} content. To generate real subject-specific lessons, add free API keys — see the
        project README — then regenerate below.
      </p>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <button
        type="button"
        disabled={isGenerating}
        onClick={handleRegenerate}
        className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {isGenerating ? "Generating…" : `Regenerate ${subject} with AI`}
      </button>
    </div>
  );
}

/** Shown when AI is not configured — points people at the interactive example instead of a setup wall. */
export function ExamplePromptBanner() {
  return (
    <div className="mt-8 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 shadow-sm">
      <p className="text-sm font-semibold text-violet-950">Try Curio without API keys</p>
      <p className="mt-1 text-xs text-violet-900/80">
        Open the interactive example path to walk through the map, lessons, and accuracy UI. When you
        are ready for AI-generated curricula, add keys as described in the README.
      </p>
      <Link
        href="/example"
        className="mt-3 inline-flex min-h-11 items-center rounded-xl curio-btn-primary px-4 py-2 text-sm font-semibold text-white"
      >
        Open example path
      </Link>
    </div>
  );
}
