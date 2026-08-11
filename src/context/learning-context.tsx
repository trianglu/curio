"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sendLocalNotification, sendPushNotification } from "@/components/notification-prompt";
import {
  appendUnit,
  completeLesson,
  ensureExpansionRunning,
  getExpansionLabel,
  getLesson,
  getUnitForLesson,
  isPathCaughtUp,
  isUnitFullyCompleted,
  needsGeminiUpgrade,
  recordExpansionEmptyPass,
  shouldContinueExpanding,
  toggleExpansion,
} from "@/lib/path-engine";
import { repairPath } from "@/lib/repair-lessons";
import { maybeInsertCheckpoint } from "@/lib/review-checkpoint";
import { getExistingLessonTitles } from "@/lib/ai/transform";
import {
  buildExpandPayload,
  buildUpgradePayload,
  computeExpansionBackoff,
  computeExpansionProgress,
  EXPANSION_COOLDOWN_CAUGHT_UP_MS,
  EXPANSION_COOLDOWN_MS,
  EXPANSION_EMPTY_PASS_LIMIT,
  EXPANSION_FETCH_TIMEOUT_MS,
  EXPANSION_INITIAL_CAUGHT_UP_MS,
  EXPANSION_INITIAL_DELAY_MS,
  GEMINI_UPGRADE_INITIAL_DELAY_MS,
  GEMINI_UPGRADE_POLL_MS,
  GEMINI_UPGRADE_RETRY_MS,
  EXPANSION_INTERVAL_CAUGHT_UP_MS,
  EXPANSION_INTERVAL_MS,
  EXPANSION_RATE_LIMIT_BACKOFF_MS,
  formatExpansionError,
  formatExpansionExhausted,
  formatExpansionEmptyPassRetry,
  formatExpansionWaiting,
  formatGeminiUpgradeSuccess,
  formatGeminiUpgradeWaiting,
} from "@/lib/expansion-runner";
import { createReviewCardFromQuestion, isDueForReview, sm2Update } from "@/lib/spaced-repetition";
import { loadProfile, saveProfile, syncPayloadToProfile } from "@/lib/storage";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  LearningPath,
  PushSubscriptionData,
  ReviewCard,
  Unit,
  UserProfile,
} from "@/lib/types";
import { DEFAULT_PROFILE } from "@/lib/types";

interface LearningContextValue {
  profile: UserProfile;
  activePath: LearningPath | null;
  expansionLabel: string;
  expansionNote: string | null;
  expansionWaitMs: number | null;
  expansionWaitTotalMs: number | null;
  expansionProgress: number;
  expansionHasScheduledCycle: boolean;
  isHydrated: boolean;
  isGenerating: boolean;
  dueReviewCount: number;
  createPath: (subject: string) => Promise<LearningPath>;
  regeneratePath: (pathId: string) => Promise<LearningPath>;
  seedPath: (path: LearningPath) => LearningPath;
  deletePath: (pathId: string) => void;
  setActivePath: (pathId: string) => void;
  completeLessonById: (lessonId: string) => void;
  toggleBackgroundExpansion: () => void;
  savePushSubscription: (sub: PushSubscriptionData) => Promise<void>;
  submitReview: (cardId: string, result: ReturnType<typeof sm2Update>) => void;
  syncToCloud: () => Promise<void>;
  signOut: () => Promise<void>;
}

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expansionNote, setExpansionNote] = useState<string | null>(null);
  const [expansionWaitMs, setExpansionWaitMs] = useState<number | null>(null);
  const [expansionWaitTotalMs, setExpansionWaitTotalMs] = useState<number | null>(null);
  const [expansionProgress, setExpansionProgress] = useState(0);
  const [expansionHasScheduledCycle, setExpansionHasScheduledCycle] = useState(false);
  const profileRef = useRef(profile);
  const inFlightRef = useRef(new Set<string>());
  const expansionBackoffRef = useRef(new Map<string, number>());
  const nextExpansionAtRef = useRef(new Map<string, number>());
  const expansionWaitTotalRef = useRef(new Map<string, number>());
  const expansionCycleStartRef = useRef(new Map<string, number>());
  const generatingStartedAtRef = useRef(new Map<string, number>());
  const expansionProgressFloorRef = useRef(0);
  const expansionCompleteFlashUntilRef = useRef(0);
  const expansionTimerRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const expansionLaunchRequestedRef = useRef(new Set<string>());
  const expansionErrorsRef = useRef(new Map<string, string>());
  const runExpansionRef = useRef<(pathId: string, force?: boolean) => Promise<void>>(async () => {});

  profileRef.current = profile;

  useEffect(() => {
    try {
      const loaded = loadProfile();
      setProfile({
        ...loaded,
        paths: loaded.paths.map((p) => ensureExpansionRunning(repairPath(p))),
      });
    } catch (error) {
      console.error("Curio: failed to hydrate profile", error);
      setProfile(DEFAULT_PROFILE);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const timer = setTimeout(() => saveProfile(profile), 300);
    return () => clearTimeout(timer);
  }, [profile, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !isSupabaseConfigured()) return;

    try {
      const supabase = createClient();

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;

        fetch("/api/sync")
          .then((r) => r.json())
          .then((cloud) => {
            if (cloud.data) {
              setProfile((prev) =>
                syncPayloadToProfile(
                  cloud.data,
                  session.user.id,
                  session.user.email ?? null,
                  prev,
                ),
              );
            } else {
              setProfile((prev) => ({
                ...prev,
                userId: session.user.id,
                email: session.user.email ?? null,
              }));
            }
          })
          .catch(() => {});
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setProfile((prev) => ({
            ...prev,
            userId: session.user.id,
            email: session.user.email ?? null,
          }));
        } else {
          setProfile((prev) => ({ ...prev, userId: null, email: null }));
        }
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error("Curio: Supabase init failed", error);
    }
  }, [isHydrated]);

  const activePath = useMemo(
    () => profile.paths.find((path) => path.id === profile.activePathId) ?? null,
    [profile],
  );

  const dueReviewCount = useMemo(
    () => profile.reviewCards.filter((c) => isDueForReview(c.nextReviewDate)).length,
    [profile.reviewCards],
  );

  const updatePath = useCallback((updated: LearningPath) => {
    setProfile((prev) => ({
      ...prev,
      paths: prev.paths.map((path) => (path.id === updated.id ? updated : path)),
    }));
  }, []);

  const syncToCloud = useCallback(async () => {
    if (!isSupabaseConfigured() || !profile.userId) return;

    await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
  }, [profile]);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile((prev) => ({ ...prev, userId: null, email: null }));
  }, []);

  const createPath = useCallback(async (subject: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        const wait =
          typeof data.retryAfterMs === "number" && data.retryAfterMs > 0
            ? ` (~${Math.ceil(data.retryAfterMs / 1000)}s)`
            : "";
        throw new Error(`${data.error ?? "Failed to generate learning path"}${wait}`);
      }

      const path: LearningPath = data.path;

      setProfile((prev) => ({
        ...prev,
        activePathId: path.id,
        paths: [
          path,
          ...prev.paths.filter(
            (p) => p.subject.toLowerCase() !== subject.trim().toLowerCase(),
          ),
        ],
      }));
      return path;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const regeneratePath = useCallback(async (pathId: string) => {
    const existing = profile.paths.find((p) => p.id === pathId);
    if (!existing) throw new Error("Path not found");

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: existing.subject }),
      });

      const data = await response.json();
      if (!response.ok) {
        const wait =
          typeof data.retryAfterMs === "number" && data.retryAfterMs > 0
            ? ` (~${Math.ceil(data.retryAfterMs / 1000)}s)`
            : "";
        throw new Error(`${data.error ?? "Failed to regenerate learning path"}${wait}`);
      }

      const path: LearningPath = data.path;

      setProfile((prev) => ({
        ...prev,
        activePathId: path.id,
        paths: [path, ...prev.paths.filter((p) => p.id !== pathId && p.subject.toLowerCase() !== existing.subject.toLowerCase())],
        reviewCards: prev.reviewCards.filter((c) => c.pathId !== pathId),
      }));
      return path;
    } finally {
      setIsGenerating(false);
    }
  }, [profile.paths]);

  const seedPath = useCallback((path: LearningPath) => {
    setProfile((prev) => ({
      ...prev,
      activePathId: path.id,
      paths: [path, ...prev.paths.filter((p) => p.id !== path.id)],
    }));
    return path;
  }, []);

  const deletePath = useCallback((pathId: string) => {
    setProfile((prev) => ({
      ...prev,
      activePathId: prev.activePathId === pathId ? null : prev.activePathId,
      paths: prev.paths.filter((p) => p.id !== pathId),
      reviewCards: prev.reviewCards.filter((c) => c.pathId !== pathId),
    }));
  }, []);

  const setActivePath = useCallback((pathId: string) => {
    setProfile((prev) => ({ ...prev, activePathId: pathId }));
  }, []);

  const completeLessonById = useCallback(
    (lessonId: string) => {
      if (!activePath) return;

      const lesson = getLesson(activePath, lessonId);
      let updatedPath = completeLesson(activePath, lessonId);

      const completedUnit = getUnitForLesson(updatedPath, lessonId);
      if (completedUnit && isUnitFullyCompleted(completedUnit)) {
        updatedPath = maybeInsertCheckpoint(updatedPath, completedUnit.id);
      }

      let reviewCards = profile.reviewCards;
      if (lesson?.content.question) {
        const existing = reviewCards.find((c) => c.questionId === lesson.content.question!.id);
        if (!existing) {
          reviewCards = [
            ...reviewCards,
            createReviewCardFromQuestion(lesson.content.question, {
              lessonId: lesson.id,
              pathId: activePath.id,
              subject: activePath.subject,
            }),
          ];
        }
      }

      setProfile((prev) => ({
        ...prev,
        reviewCards,
        paths: prev.paths.map((p) => (p.id === updatedPath.id ? updatedPath : p)),
      }));
    },
    [activePath, profile.reviewCards],
  );

  const submitReview = useCallback((cardId: string, result: ReturnType<typeof sm2Update>) => {
    setProfile((prev) => ({
      ...prev,
      reviewCards: prev.reviewCards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              easeFactor: result.easeFactor,
              interval: result.interval,
              repetitions: result.repetitions,
              nextReviewDate: result.nextReviewDate,
              lastReviewDate: new Date().toISOString().slice(0, 10),
            }
          : card,
      ),
    }));
  }, []);

  const toggleBackgroundExpansion = useCallback(() => {
    if (!activePath) return;
    updatePath(toggleExpansion(activePath));
  }, [activePath, updatePath]);

  const savePushSubscription = useCallback(
    async (sub: PushSubscriptionData) => {
      setProfile((prev) => ({ ...prev, pushSubscription: sub }));

      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, userId: profile.userId }),
      });
    },
    [profile.userId],
  );

  const notifyNewLesson = useCallback(
    async (path: LearningPath, lessonTitle: string) => {
      if (!profile.notificationSettings.passiveLessonReady) return;

      const title = "Your next lesson is ready";
      const body = `${path.subject}: ${lessonTitle}`;

      await sendLocalNotification(title, body, `/learn/${path.id}`);

      if (profile.pushSubscription) {
        await sendPushNotification(
          profile.pushSubscription,
          title,
          body,
          `/learn/${path.id}`,
        ).catch(() => {});
      }
    },
    [profile.notificationSettings.passiveLessonReady, profile.pushSubscription],
  );

  const syncExpansionNote = useCallback((activePathId: string | null) => {
    if (!activePathId) {
      setExpansionNote(null);
      return;
    }
    setExpansionNote(expansionErrorsRef.current.get(activePathId) ?? null);
  }, []);

  useEffect(() => {
    syncExpansionNote(profile.activePathId);
  }, [profile.activePathId, syncExpansionNote]);

  useEffect(() => {
    if (!activePath) {
      setExpansionWaitMs(null);
      setExpansionWaitTotalMs(null);
      setExpansionProgress(0);
      return;
    }

    const pathId = activePath.id;

    const updateWait = () => {
      const path = profileRef.current.paths.find((p) => p.id === pathId);
      if (!path) return;

      const isPaused = path.expansionStatus === "paused";
      const isExhausted = path.expansionStatus === "exhausted";
      const isGenerating =
        path.expansionStatus === "generating" ||
        generatingStartedAtRef.current.has(pathId);

      const nextAt = nextExpansionAtRef.current.get(pathId) ?? 0;
      const remaining = nextAt - Date.now();
      const waitTotal =
        expansionWaitTotalRef.current.get(pathId) ??
        (isPathCaughtUp(path) ? EXPANSION_COOLDOWN_CAUGHT_UP_MS : EXPANSION_COOLDOWN_MS);

      setExpansionWaitMs(remaining > 0 ? remaining : null);
      setExpansionWaitTotalMs(remaining > 0 && waitTotal > 0 ? waitTotal : null);

      const hasScheduledCycle = expansionCycleStartRef.current.has(pathId);
      setExpansionHasScheduledCycle(hasScheduledCycle);

      if (
        profileRef.current.activePathId === pathId &&
        Date.now() < expansionCompleteFlashUntilRef.current
      ) {
        setExpansionProgress(100);
        return;
      }

      let nextProgress = computeExpansionProgress({
        isPaused: isPaused || isExhausted,
        isGenerating,
        hasScheduledCycle,
        generatingStartedAt: generatingStartedAtRef.current.get(pathId) ?? null,
        waitRemainingMs: Math.max(0, remaining),
        waitTotalMs: waitTotal,
      });

      const isIdle =
        !isPaused && !isExhausted && !isGenerating && remaining <= 0 && !hasScheduledCycle;

      if (isPaused || isExhausted || isIdle) {
        expansionProgressFloorRef.current = 0;
      } else if (nextProgress < expansionProgressFloorRef.current) {
        nextProgress = expansionProgressFloorRef.current;
      } else {
        expansionProgressFloorRef.current = nextProgress;
      }

      setExpansionProgress(nextProgress);

      // Backup: if cooldown elapsed but the timer was lost (e.g. remount), launch now.
      if (
        !isPaused &&
        !isExhausted &&
        !isGenerating &&
        remaining <= 0 &&
        hasScheduledCycle &&
        !inFlightRef.current.has(pathId) &&
        !expansionLaunchRequestedRef.current.has(pathId)
      ) {
        expansionLaunchRequestedRef.current.add(pathId);
        void runExpansionRef.current(pathId, true);
      } else if (remaining > 0 || isGenerating) {
        expansionLaunchRequestedRef.current.delete(pathId);
      }
    };

    updateWait();
    const timer = setInterval(updateWait, 250);
    return () => clearInterval(timer);
  }, [activePath?.id]);

  useEffect(() => {
    if (!isHydrated) return;

    const getCooldown = (path: LearningPath) =>
      isPathCaughtUp(path) ? EXPANSION_COOLDOWN_CAUGHT_UP_MS : EXPANSION_COOLDOWN_MS;

    const getTickInterval = () => {
      const paths = profileRef.current.paths.filter(shouldContinueExpanding);
      if (paths.some(needsGeminiUpgrade)) return GEMINI_UPGRADE_POLL_MS;
      return paths.some(isPathCaughtUp) ? EXPANSION_INTERVAL_CAUGHT_UP_MS : EXPANSION_INTERVAL_MS;
    };

    const getInitialDelay = (path: LearningPath) => {
      if (needsGeminiUpgrade(path)) return GEMINI_UPGRADE_INITIAL_DELAY_MS;
      return isPathCaughtUp(path) ? EXPANSION_INITIAL_CAUGHT_UP_MS : EXPANSION_INITIAL_DELAY_MS;
    };

    const clearExpansionTimer = (pathId: string) => {
      const timer = expansionTimerRef.current.get(pathId);
      if (timer) clearTimeout(timer);
      expansionTimerRef.current.delete(pathId);
    };

    const scheduleNextExpansion = (pathId: string, waitMs: number) => {
      const now = Date.now();
      nextExpansionAtRef.current.set(pathId, now + waitMs);
      expansionWaitTotalRef.current.set(pathId, waitMs);
      expansionCycleStartRef.current.set(pathId, now);
      expansionLaunchRequestedRef.current.delete(pathId);
      if (profileRef.current.activePathId === pathId) {
        expansionProgressFloorRef.current = 0;
      }
      clearExpansionTimer(pathId);
      const timer = setTimeout(() => {
        expansionTimerRef.current.delete(pathId);
        void runExpansionRef.current(pathId, true);
      }, waitMs);
      expansionTimerRef.current.set(pathId, timer);
    };

    const runExpansionForPath = async (pathId: string, force = false) => {
      if (inFlightRef.current.has(pathId)) return;

      const nextAt = nextExpansionAtRef.current.get(pathId) ?? 0;
      if (!force && Date.now() < nextAt) return;

      const pathSnapshot = profileRef.current.paths.find((p) => p.id === pathId);
      if (!pathSnapshot || !shouldContinueExpanding(pathSnapshot)) return;

      let currentPath = pathSnapshot;

      inFlightRef.current.add(pathId);
      expansionLaunchRequestedRef.current.delete(pathId);
      const now = Date.now();
      generatingStartedAtRef.current.set(pathId, now);
      if (!expansionCycleStartRef.current.has(pathId)) {
        expansionCycleStartRef.current.set(pathId, now);
        expansionWaitTotalRef.current.set(pathId, 0);
      }

      try {
        setProfile((prev) => ({
          ...prev,
          paths: prev.paths.map((p) =>
            p.id === pathId ? { ...p, expansionStatus: "generating" as const } : p,
          ),
        }));

        if (profileRef.current.activePathId === pathId) {
          setExpansionNote(null);
          expansionProgressFloorRef.current = 0;
        }

        const existingTitles = getExistingLessonTitles(currentPath);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), EXPANSION_FETCH_TIMEOUT_MS);

        if (needsGeminiUpgrade(currentPath)) {
          if (profileRef.current.activePathId === pathId) {
            setExpansionNote("Reviewing Groq content with Gemini…");
          }

          try {
            const upgradeResponse = await fetch("/api/generate/upgrade", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildUpgradePayload(currentPath)),
              signal: controller.signal,
            });

            if (upgradeResponse.ok) {
              const upgradeData = (await upgradeResponse.json()) as {
                path: LearningPath;
                enrichedCount?: number;
                addedUnit?: boolean;
              };

              expansionBackoffRef.current.set(pathId, EXPANSION_RATE_LIMIT_BACKOFF_MS);
              scheduleNextExpansion(pathId, 30_000);
              generatingStartedAtRef.current.delete(pathId);
              expansionErrorsRef.current.delete(pathId);

              const message = formatGeminiUpgradeSuccess(
                upgradeData.enrichedCount ?? 0,
                upgradeData.addedUnit ?? false,
              );
              if (profileRef.current.activePathId === pathId) {
                setExpansionNote(message);
              }

              setProfile((prev) => ({
                ...prev,
                paths: prev.paths.map((p) =>
                  p.id === pathId ? upgradeData.path : p,
                ),
              }));
              clearTimeout(timeout);
              return;
            }

            const upgradeError = (await upgradeResponse.json().catch(() => ({}))) as {
              code?: string;
              retryAfterMs?: number;
            };
            const geminiUnavailable =
              upgradeResponse.status === 429 || upgradeError.code === "rate_limit";
            const geminiNotConfigured =
              upgradeResponse.status === 503 || upgradeError.code === "not_configured";

            if (geminiNotConfigured) {
              currentPath = { ...currentPath, geminiUpgraded: true };
              setProfile((prev) => ({
                ...prev,
                paths: prev.paths.map((p) =>
                  p.id === pathId ? { ...p, geminiUpgraded: true } : p,
                ),
              }));
            } else {
              const waitMs = geminiUnavailable
                ? Math.max(upgradeError.retryAfterMs ?? 0, GEMINI_UPGRADE_RETRY_MS)
                : 45_000;
              expansionBackoffRef.current.set(pathId, EXPANSION_RATE_LIMIT_BACKOFF_MS);
              scheduleNextExpansion(pathId, waitMs);
              generatingStartedAtRef.current.delete(pathId);
              clearTimeout(timeout);
              const message = geminiUnavailable
                ? formatGeminiUpgradeWaiting(waitMs)
                : "Gemini upgrade retrying shortly…";
              expansionErrorsRef.current.set(pathId, message);
              if (profileRef.current.activePathId === pathId) {
                setExpansionNote(message);
              }
              return;
            }
          } catch (upgradeFetchError) {
            const aborted =
              upgradeFetchError instanceof DOMException &&
              upgradeFetchError.name === "AbortError";
            const waitMs = aborted ? 30_000 : GEMINI_UPGRADE_RETRY_MS;
            expansionBackoffRef.current.set(pathId, EXPANSION_RATE_LIMIT_BACKOFF_MS);
            scheduleNextExpansion(pathId, waitMs);
            generatingStartedAtRef.current.delete(pathId);
            clearTimeout(timeout);
            const message = formatGeminiUpgradeWaiting(waitMs);
            expansionErrorsRef.current.set(pathId, message);
            if (profileRef.current.activePathId === pathId) {
              setExpansionNote(message);
            }
            if (!aborted) {
              console.warn("Curio: Gemini upgrade request failed", upgradeFetchError);
            }
            return;
          }
        }

        let response: Response;
        try {
          response = await fetch("/api/generate/expand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildExpandPayload(currentPath, existingTitles)),
            signal: controller.signal,
          });
        } catch (fetchError) {
          const aborted =
            fetchError instanceof DOMException && fetchError.name === "AbortError";
          const offline = typeof navigator !== "undefined" && !navigator.onLine;
          const message = aborted
            ? "Generation timed out — will retry shortly"
            : offline
              ? "You're offline — will retry when connected"
              : "Could not reach the server — will retry shortly";
          expansionErrorsRef.current.set(pathId, message);
          scheduleNextExpansion(pathId, getCooldown(pathSnapshot));
          generatingStartedAtRef.current.delete(pathId);
          if (profileRef.current.activePathId === pathId) {
            setExpansionNote(message);
          }
          return;
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
            retryAfterMs?: number;
          };
          const isRateLimit = response.status === 429 || data.code === "rate_limit";
          const isValidation = data.code === "validation_failed";
          const currentBackoff =
            expansionBackoffRef.current.get(pathId) ?? EXPANSION_RATE_LIMIT_BACKOFF_MS;
          const backoff = isValidation
            ? { waitMs: 45_000, nextBackoffMs: EXPANSION_RATE_LIMIT_BACKOFF_MS }
            : computeExpansionBackoff(currentBackoff, isRateLimit);
          const waitMs = isRateLimit
            ? Math.max(backoff.waitMs, data.retryAfterMs ?? 0)
            : backoff.waitMs;
          const nextBackoffMs = backoff.nextBackoffMs;

          if (isRateLimit) {
            expansionBackoffRef.current.set(pathId, nextBackoffMs);
          } else if (!isValidation) {
            expansionBackoffRef.current.set(pathId, EXPANSION_RATE_LIMIT_BACKOFF_MS);
          }
          scheduleNextExpansion(pathId, waitMs);

          const message = isValidation
            ? "Formatting check failed — retrying with a fresh pass…"
            : formatExpansionError(isRateLimit, waitMs, data.error);
          expansionErrorsRef.current.set(pathId, message);
          if (profileRef.current.activePathId === pathId) {
            setExpansionNote(message);
          }

          return;
        }

        const data = (await response.json()) as {
          exhausted?: boolean;
          reason?: string;
          unit?: { title?: string; lessons?: Array<{ title: string; isNew?: boolean }> };
        };

        const handleEmptyPass = (reason: string) => {
          const currentPath =
            profileRef.current.paths.find((p) => p.id === pathId) ?? pathSnapshot;
          const { path: updatedPath, exhausted } = recordExpansionEmptyPass(currentPath, reason);

          if (exhausted) {
            expansionBackoffRef.current.set(pathId, EXPANSION_RATE_LIMIT_BACKOFF_MS);
            clearExpansionTimer(pathId);
            nextExpansionAtRef.current.delete(pathId);
            expansionWaitTotalRef.current.delete(pathId);
            expansionCycleStartRef.current.delete(pathId);
            generatingStartedAtRef.current.delete(pathId);
            expansionErrorsRef.current.delete(pathId);

            if (profileRef.current.activePathId === pathId) {
              expansionProgressFloorRef.current = 0;
              setExpansionProgress(0);
              setExpansionWaitMs(null);
            }

            setProfile((prev) => ({
              ...prev,
              paths: prev.paths.map((p) => (p.id === pathId ? updatedPath : p)),
            }));
            return;
          }

          const passes = updatedPath.expansionEmptyPasses ?? 1;
          const message = formatExpansionEmptyPassRetry(passes, EXPANSION_EMPTY_PASS_LIMIT);
          expansionBackoffRef.current.set(pathId, EXPANSION_RATE_LIMIT_BACKOFF_MS);
          const cooldownMs = getCooldown(pathSnapshot);
          scheduleNextExpansion(pathId, cooldownMs);
          generatingStartedAtRef.current.delete(pathId);
          expansionErrorsRef.current.set(pathId, message);
          if (profileRef.current.activePathId === pathId) {
            setExpansionNote(message);
          }

          setProfile((prev) => ({
            ...prev,
            paths: prev.paths.map((p) => (p.id === pathId ? updatedPath : p)),
          }));
        };

        if (data.exhausted) {
          handleEmptyPass(formatExpansionExhausted(data.reason));
          return;
        }

        if (!data.unit?.lessons?.length) {
          handleEmptyPass("AI returned an empty unit");
          return;
        }

        expansionBackoffRef.current.set(pathId, EXPANSION_RATE_LIMIT_BACKOFF_MS);
        const cooldownMs = getCooldown(pathSnapshot);
        scheduleNextExpansion(pathId, cooldownMs);
        generatingStartedAtRef.current.delete(pathId);
        expansionErrorsRef.current.delete(pathId);

        if (profileRef.current.activePathId === pathId) {
          setExpansionNote(null);
          expansionProgressFloorRef.current = 0;
          expansionCompleteFlashUntilRef.current = Date.now() + 1_200;
          setExpansionProgress(100);
        }

        setProfile((prev) => {
          const current = prev.paths.find((p) => p.id === pathId);
          if (!current) return prev;
          const beforeCount = getExistingLessonTitles(current).length;
          const expanded = appendUnit(current, data.unit as Unit);
          const afterCount = getExistingLessonTitles(expanded).length;
          if (afterCount <= beforeCount) {
            console.warn("Curio: expansion did not add lessons to path");
          }
          return {
            ...prev,
            paths: prev.paths.map((p) => (p.id === expanded.id ? expanded : p)),
          };
        });

        const newLesson = data.unit.lessons[0];
        if (newLesson?.isNew) {
          void notifyNewLesson(pathSnapshot, newLesson.title).catch(() => {});
        }
      } catch (error) {
        console.warn("Curio: expansion failed", error);
        const aborted = error instanceof DOMException && error.name === "AbortError";
        const message = aborted
          ? "Generation timed out — will retry shortly"
          : error instanceof TypeError && error.message === "Failed to fetch"
            ? "Could not reach the server — will retry shortly"
            : error instanceof Error
              ? error.message
              : "Expansion failed — will retry shortly";
        expansionErrorsRef.current.set(pathId, message);
        scheduleNextExpansion(pathId, getCooldown(pathSnapshot));
        generatingStartedAtRef.current.delete(pathId);
        if (profileRef.current.activePathId === pathId) {
          setExpansionNote(message);
        }
      } finally {
        inFlightRef.current.delete(pathId);
        generatingStartedAtRef.current.delete(pathId);
        setProfile((prev) => ({
          ...prev,
          paths: prev.paths.map((p) =>
            p.id === pathId && p.expansionStatus === "generating"
              ? { ...p, expansionStatus: "expanding" as const }
              : p,
          ),
        }));
      }
    };

    runExpansionRef.current = runExpansionForPath;

    // Schedule every eligible path — don't rely only on the 90s poll interval.
    for (const path of profileRef.current.paths.filter(shouldContinueExpanding)) {
      const nextAt = nextExpansionAtRef.current.get(path.id);
      if (nextAt === undefined) {
        scheduleNextExpansion(path.id, getInitialDelay(path));
      } else {
        const remaining = nextAt - Date.now();
        if (remaining > 0) {
          clearExpansionTimer(path.id);
          const timer = setTimeout(() => {
            expansionTimerRef.current.delete(path.id);
            void runExpansionRef.current(path.id, true);
          }, remaining);
          expansionTimerRef.current.set(path.id, timer);
        }
      }
    }

    const tick = (force = false) => {
      const eligible = profileRef.current.paths.filter(shouldContinueExpanding);
      for (const path of eligible) {
        void runExpansionForPath(path.id, force).catch(() => {});
      }
    };

    const hasCaughtUp = profileRef.current.paths.some(
      (p) => shouldContinueExpanding(p) && isPathCaughtUp(p),
    );
    const needsUpgrade = profileRef.current.paths.some(
      (p) => shouldContinueExpanding(p) && needsGeminiUpgrade(p),
    );
    const initialDelay = needsUpgrade
      ? GEMINI_UPGRADE_INITIAL_DELAY_MS
      : hasCaughtUp
        ? EXPANSION_INITIAL_CAUGHT_UP_MS
        : EXPANSION_INITIAL_DELAY_MS;

    const initialTimer = setTimeout(() => tick(true), initialDelay);
    let interval = setInterval(() => tick(), getTickInterval());

    const resyncInterval = setInterval(() => {
      const nextMs = getTickInterval();
      clearInterval(interval);
      interval = setInterval(() => tick(), nextMs);
    }, 30_000);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      window.setTimeout(() => tick(), 500);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      clearInterval(resyncInterval);
      document.removeEventListener("visibilitychange", onVisible);
      for (const pathId of expansionTimerRef.current.keys()) {
        clearExpansionTimer(pathId);
      }
    };
  }, [isHydrated, notifyNewLesson]);

  useEffect(() => {
    if (!profile.userId) return;
    const timer = setTimeout(() => syncToCloud(), 2000);
    return () => clearTimeout(timer);
  }, [profile.paths, profile.reviewCards, profile.userId, syncToCloud]);

  const value: LearningContextValue = {
    profile,
    activePath,
    expansionLabel: activePath ? getExpansionLabel(activePath) : "",
    expansionNote,
    expansionWaitMs,
    expansionWaitTotalMs,
    expansionProgress,
    expansionHasScheduledCycle,
    isHydrated,
    isGenerating,
    dueReviewCount,
    createPath,
    regeneratePath,
    seedPath,
    deletePath,
    setActivePath,
    completeLessonById,
    toggleBackgroundExpansion,
    savePushSubscription,
    submitReview,
    syncToCloud,
    signOut,
  };

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) {
    throw new Error("useLearning must be used within LearningProvider");
  }
  return context;
}
