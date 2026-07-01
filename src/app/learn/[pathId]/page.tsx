"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { GeneratingBanner } from "@/components/loading-path";
import { ExpansionBanner } from "@/components/mode-selector";
import { NotificationPrompt } from "@/components/notification-prompt";
import { PathMap } from "@/components/path-map";
import { useLearning } from "@/context/learning-context";
import { getNextAvailableLesson, getPathProgress } from "@/lib/path-engine";

export default function LearnPage() {
  const params = useParams<{ pathId: string }>();
  const router = useRouter();
  const { profile, setActivePath } = useLearning();

  const pathId = params.pathId;
  const path = profile.paths.find((p) => p.id === pathId);

  useEffect(() => {
    if (pathId && profile.activePathId !== pathId) {
      setActivePath(pathId);
    }
  }, [pathId, profile.activePathId, setActivePath]);

  if (!path) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-stone-600">Learning path not found.</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white"
        >
          Start a new path
        </button>
      </div>
    );
  }

  const progress = getPathProgress(path);
  const nextLesson = getNextAvailableLesson(path);

  return (
    <div className="flex-1 pb-12">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-900">{path.subject}</h1>
          <p className="mt-1 text-sm capitalize text-stone-500">
            {path.mode} learning path · {path.aiGenerated ? "AI powered" : "Template mode"}
          </p>
          <div className="mx-auto mt-4 h-2.5 max-w-xs overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {progress.completed} of {progress.total} lessons complete
          </p>
        </div>

        <NotificationPrompt />
        <ExpansionBanner />
        {path.expansionStatus === "generating" && <GeneratingBanner />}

        {nextLesson && (
          <button
            type="button"
            onClick={() => router.push(`/lesson/${path.id}/${nextLesson.id}`)}
            className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-left text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-indigo-700"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-200">Continue</p>
            <p className="mt-1 text-lg font-semibold">{nextLesson.title}</p>
            <p className="text-sm text-indigo-200">{nextLesson.estimatedMinutes} min</p>
          </button>
        )}

        <PathMap pathId={path.id} units={path.units} mode={path.mode} />
      </div>
    </div>
  );
}
