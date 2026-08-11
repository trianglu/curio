"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ExpansionBanner } from "@/components/expansion-banner";
import { NotificationPrompt } from "@/components/notification-prompt";
import { TemplateBanner } from "@/components/template-banner";
import { PathMap } from "@/components/path-map";
import { useLearning } from "@/context/learning-context";
import { getNextAvailableLesson, getPathProgress } from "@/lib/path-engine";
import { countContentUnits, getCheckpointUnits } from "@/lib/review-checkpoint";

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
  const contentUnits = countContentUnits(path);
  const recallRounds = getCheckpointUnits(path).length;

  return (
    <div className="flex-1 pb-12">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold curio-gradient-text">{path.subject}</h1>
          <p className="mt-1 text-sm text-violet-600">
            {path.aiGenerated ? "✨ AI powered learning path" : "Template mode"}
          </p>
          <div className="mx-auto mt-4 h-3 max-w-xs overflow-hidden rounded-full bg-violet-100 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-stone-600">
            {progress.completed} of {progress.total} lessons complete · {contentUnits}{" "}
            {contentUnits === 1 ? "unit" : "units"}
            {recallRounds > 0 &&
              ` · ${recallRounds} recall round${recallRounds === 1 ? "" : "s"}`}
          </p>
        </div>

        {!path.aiGenerated && <TemplateBanner subject={path.subject} pathId={path.id} />}

        <NotificationPrompt />
        <ExpansionBanner />

        {nextLesson && (
          <button
            type="button"
            onClick={() => router.push(`/lesson/${path.id}/${nextLesson.id}`)}
            className="w-full rounded-2xl curio-btn-primary px-6 py-4 text-left text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Continue</p>
            <p className="mt-1 text-lg font-bold">{nextLesson.title}</p>
            <p className="text-sm text-white/80">{nextLesson.estimatedMinutes} min</p>
          </button>
        )}

        <PathMap pathId={path.id} units={path.units} />
      </div>
    </div>
  );
}
