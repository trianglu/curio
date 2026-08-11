import { countContentUnits } from "@/lib/review-checkpoint";
import type { LearningPath } from "./types";

export const EXPANSION_INTERVAL_MS = 90_000;
export const EXPANSION_INTERVAL_CAUGHT_UP_MS = 45_000;
/** Delay first expansion so initial path generation can clear Groq's 6K TPM window. */
export const EXPANSION_INITIAL_DELAY_MS = 90_000;
export const EXPANSION_INITIAL_CAUGHT_UP_MS = 45_000;
export const EXPANSION_COOLDOWN_MS = 60_000;
export const EXPANSION_COOLDOWN_CAUGHT_UP_MS = 30_000;
export const EXPANSION_RATE_LIMIT_BACKOFF_MS = 60_000;
export const MAX_EXPANSION_BACKOFF_MS = 300_000;
export const EXPANSION_FETCH_TIMEOUT_MS = 120_000;
/** Poll more often while waiting for Gemini quota to free up. */
export const GEMINI_UPGRADE_POLL_MS = 45_000;
export const GEMINI_UPGRADE_INITIAL_DELAY_MS = 30_000;
export const GEMINI_UPGRADE_RETRY_MS = 60_000;
/** Rough time budget for one AI unit generation (drives the second half of the bar). */
export const EXPANSION_GEN_ESTIMATE_MS = 90_000;

export interface ExpansionAttemptResult {
  pathId: string;
  ok: boolean;
  rateLimited?: boolean;
  error?: string;
  lessonTitle?: string;
}

export function buildExpandPayload(path: LearningPath, existingTitles: string[]) {
  return {
    pathId: path.id,
    subject: path.subject,
    expansionDepth: path.expansionDepth,
    existingTitles,
    aiGenerated: path.aiGenerated,
    unitCount: countContentUnits(path),
  };
}

export function computeExpansionBackoff(
  currentBackoffMs: number,
  isRateLimit: boolean,
): { waitMs: number; nextBackoffMs: number } {
  if (!isRateLimit) {
    return { waitMs: EXPANSION_INTERVAL_MS, nextBackoffMs: EXPANSION_RATE_LIMIT_BACKOFF_MS };
  }
  const waitMs = Math.min(currentBackoffMs, MAX_EXPANSION_BACKOFF_MS);
  const nextBackoffMs = Math.min(currentBackoffMs * 2, MAX_EXPANSION_BACKOFF_MS);
  return { waitMs, nextBackoffMs };
}

export function formatExpansionError(
  isRateLimit: boolean,
  waitMs: number,
  error?: string,
): string {
  if (isRateLimit) {
    const retrySeconds = Math.max(30, Math.ceil(waitMs / 1000));
    if (retrySeconds < 90) {
      return `AI rate limit — resuming in ~${retrySeconds}s`;
    }
    const retryMinutes = Math.max(1, Math.ceil(waitMs / 60_000));
    return `AI rate limit — resuming in ~${retryMinutes} min`;
  }
  return error ?? "Research paused briefly — retrying soon";
}

export function formatExpansionWaiting(waitMs: number): string {
  const seconds = Math.max(0, Math.ceil(waitMs / 1000));
  if (seconds < 60) return `Next research pass in ~${seconds}s…`;
  return `Next research pass in ~${Math.ceil(seconds / 60)} min…`;
}

/** 0–100 progress toward the next unit — monotonic within each research cycle. */
export function computeExpansionProgress(options: {
  isPaused: boolean;
  isGenerating: boolean;
  hasScheduledCycle: boolean;
  waitRemainingMs: number;
  waitTotalMs: number;
  generatingStartedAt: number | null;
  now?: number;
}): number {
  const now = options.now ?? Date.now();
  if (options.isPaused) return 0;

  const waitTotal = Math.max(0, options.waitTotalMs);

  if (options.isGenerating && options.generatingStartedAt) {
    const genElapsed = now - options.generatingStartedAt;
    return Math.min(95, 45 + (genElapsed / EXPANSION_GEN_ESTIMATE_MS) * 50);
  }

  if (options.waitRemainingMs > 0 && waitTotal > 0) {
    const elapsed = waitTotal - options.waitRemainingMs;
    return Math.min(45, Math.max(0, (elapsed / waitTotal) * 45));
  }

  if (options.hasScheduledCycle) {
    // Wait finished — hold until generation kicks in (never pulse backward).
    return 45;
  }

  return 8;
}

/** 0–100% through the current cooldown wait (independent of overall cycle progress). */
export function computeWaitPhaseProgress(waitRemainingMs: number, waitTotalMs: number): number {
  if (waitTotalMs <= 0) return 0;
  if (waitRemainingMs <= 0) return 100;
  const elapsed = waitTotalMs - waitRemainingMs;
  return Math.min(100, Math.max(0, Math.round((elapsed / waitTotalMs) * 100)));
}

/** 0–100% through the AI generation phase (maps overall 45–95% to local 0–100%). */
export function computeGenerationPhaseProgress(overallProgress: number): number {
  if (overallProgress <= 45) return 0;
  return Math.min(100, Math.max(0, Math.round(((overallProgress - 45) / 50) * 100)));
}

export function expansionProgressLabel(
  progress: number,
  isGenerating: boolean,
  waitRemainingMs: number,
  waitTotalMs: number,
  hasScheduledCycle: boolean,
): string {
  if (isGenerating) {
    const genPct = computeGenerationPhaseProgress(progress);
    return progress >= 88 ? "Finalizing new unit…" : `Building new unit… ${genPct}%`;
  }
  if (progress >= 99) {
    return "Unit added — starting next cycle…";
  }
  if (waitRemainingMs > 0 && waitTotalMs > 0) {
    const waitPct = computeWaitPhaseProgress(waitRemainingMs, waitTotalMs);
    return `Waiting to research · ${waitPct}%`;
  }
  if (hasScheduledCycle) {
    return "Launching research pass…";
  }
  return "Starting next research pass…";
}

export function formatExpansionSuccess(unitTitle: string): string {
  return `Added new unit: ${unitTitle}`;
}

export function formatGeminiUpgradeSuccess(enrichedCount: number, addedUnit: boolean): string {
  const parts = [`Upgraded ${enrichedCount} lesson${enrichedCount === 1 ? "" : "s"} with Gemini`];
  if (addedUnit) parts.push("added a second foundational unit");
  return parts.join(" — ");
}

export function formatGeminiUpgradeWaiting(waitMs: number): string {
  const seconds = Math.max(30, Math.ceil(waitMs / 1000));
  if (seconds < 90) {
    return `Waiting for Gemini quota — auto-upgrade in ~${seconds}s`;
  }
  return `Waiting for Gemini quota — auto-upgrade in ~${Math.ceil(seconds / 60)} min`;
}

export function buildUpgradePayload(path: LearningPath) {
  return { path };
}

export function formatExpansionExhausted(reason?: string): string {
  return reason ?? "No more reliable topics found for this subject.";
}

/** Empty passes required before background expansion stops. */
export const EXPANSION_EMPTY_PASS_LIMIT = 3;

export function formatExpansionEmptyPassRetry(passes: number, limit: number): string {
  return `No reliable topics this pass (${passes}/${limit}) — retrying…`;
}
