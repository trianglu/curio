"use client";

import { useLearning } from "@/context/learning-context";
import { formatExpansionSuccess, formatExpansionWaiting, expansionProgressLabel } from "@/lib/expansion-runner";
import { isExpansionActive, isPathCaughtUp } from "@/lib/path-engine";

export function ExpansionBanner() {
  const {
    activePath,
    expansionLabel,
    expansionNote,
    expansionWaitMs,
    expansionWaitTotalMs,
    expansionProgress,
    expansionHasScheduledCycle,
    toggleBackgroundExpansion,
  } = useLearning();

  if (!activePath) return null;

  const isActive = isExpansionActive(activePath);
  const isGenerating = activePath.expansionStatus === "generating";
  const isPaused = activePath.expansionStatus === "paused";
  const isExhausted = activePath.expansionStatus === "exhausted";
  const caughtUp = isPathCaughtUp(activePath);
  const expansionSuccess =
    !expansionNote && !expansionWaitMs && activePath.lastAddedUnitTitle && !isExhausted
      ? formatExpansionSuccess(activePath.lastAddedUnitTitle)
      : null;
  const showProgress = (isActive || isGenerating) && !isPaused && !isExhausted;
  const progressLabel = expansionProgressLabel(
    expansionProgress,
    isGenerating,
    expansionWaitMs ?? 0,
    expansionWaitTotalMs ?? 0,
    expansionHasScheduledCycle,
  );

  return (
    <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-violet-50 to-fuchsia-50 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow-sm ${
              isGenerating || (isActive && !expansionWaitMs) ? "animate-pulse" : ""
            }`}
          >
            {isPaused ? "⏸️" : isExhausted ? "✓" : isGenerating ? "🤖" : isActive ? "🔬" : "⏸️"}
          </span>
          <div>
            <p className="text-sm font-semibold text-violet-900">
              {isPaused
                ? "Background research paused"
                : isExhausted
                  ? "Path complete — no more reliable topics"
                  : isGenerating
                    ? "AI is generating new lessons…"
                    : isActive
                      ? caughtUp
                        ? "You finished this unit — discovering what's next"
                        : "Curio is researching in the background"
                      : "Background research idle"}
            </p>
            <p className="text-xs text-violet-700/90">
              {isExhausted
                ? activePath.expansionStopReason ?? "Curio couldn't find more accurate content to add."
                : expansionLabel}
            </p>
            {expansionNote ? (
              <p className="mt-1 text-xs font-semibold text-amber-700">{expansionNote}</p>
            ) : expansionWaitMs && isActive && !isGenerating ? (
              <p className="mt-1 text-xs font-medium text-sky-700">
                {formatExpansionWaiting(expansionWaitMs)}
              </p>
            ) : expansionSuccess ? (
              <p className="mt-1 text-xs font-semibold text-emerald-700">{expansionSuccess}</p>
            ) : isActive && !isPaused && !isExhausted ? (
              <p className="mt-1 text-xs text-violet-600/80">
                Research runs automatically — new units appear as they're discovered
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleBackgroundExpansion}
          className="shrink-0 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50"
        >
          {isExhausted ? "Retry research" : isPaused ? "Resume" : "Pause"}
        </button>
      </div>

      {showProgress && (
        <div className="mt-3 border-t border-violet-100/80 pt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-violet-800">{progressLabel}</p>
            <p className="text-[10px] font-bold tabular-nums text-violet-600" title="Overall research cycle">
              {Math.round(expansionProgress)}%
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-violet-100">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                isGenerating
                  ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400"
                  : "bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500"
              }`}
              style={{ width: `${Math.max(4, expansionProgress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
