"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLearning } from "@/context/learning-context";
import type { LearningPath } from "@/lib/types";

interface PathListItemProps {
  path: LearningPath;
}

export function PathListItem({ path }: PathListItemProps) {
  const router = useRouter();
  const { regeneratePath, deletePath, isGenerating } = useLearning();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function handleRefresh(event: React.MouseEvent) {
    event.stopPropagation();
    setError("");
    setRefreshing(true);
    try {
      const newPath = await regeneratePath(path.id);
      router.push(`/learn/${newPath.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  function handleDelete(event: React.MouseEvent) {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${path.subject}"? This removes all progress for this path.`,
    );
    if (confirmed) deletePath(path.id);
  }

  const busy = refreshing || isGenerating;

  return (
    <div className="rounded-xl border border-stone-200 bg-white transition-colors hover:border-indigo-200">
      <button
        type="button"
        onClick={() => router.push(`/learn/${path.id}`)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="font-medium text-stone-900">{path.subject}</p>
          <p className="text-xs text-stone-500">
            {path.lessonsCompleted} lessons ·{" "}
            {path.aiGenerated ? "AI" : "Template"}
          </p>
        </div>
        <span className="text-indigo-600">→</span>
      </button>

      <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleRefresh}
          className="flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          title="Regenerate this path with AI"
        >
          <span>{refreshing ? "…" : "↻"}</span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="flex min-h-9 cursor-pointer items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Delete this path"
        >
          Delete
        </button>
      </div>

      {error && <p className="border-t border-stone-100 px-4 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
