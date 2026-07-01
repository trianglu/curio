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
  getExpansionLabel,
  getLesson,
  shouldContinueExpanding,
  toggleExpansion,
} from "@/lib/path-engine";
import { createReviewCardFromQuestion, isDueForReview, sm2Update } from "@/lib/spaced-repetition";
import { loadProfile, saveProfile, syncPayloadToProfile } from "@/lib/storage";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  LearningMode,
  LearningPath,
  PushSubscriptionData,
  ReviewCard,
  UserProfile,
} from "@/lib/types";
import { DEFAULT_PROFILE } from "@/lib/types";

interface LearningContextValue {
  profile: UserProfile;
  activePath: LearningPath | null;
  expansionLabel: string;
  isHydrated: boolean;
  isGenerating: boolean;
  dueReviewCount: number;
  createPath: (subject: string, mode: LearningMode) => Promise<LearningPath>;
  setActivePath: (pathId: string) => void;
  completeLessonById: (lessonId: string) => void;
  toggleBackgroundExpansion: () => void;
  savePushSubscription: (sub: PushSubscriptionData) => Promise<void>;
  submitReview: (cardId: string, result: ReturnType<typeof sm2Update>) => void;
  syncToCloud: () => Promise<void>;
  signOut: () => Promise<void>;
}

const LearningContext = createContext<LearningContextValue | null>(null);

const EXPANSION_INTERVAL_MS = 60_000;

export function LearningProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const expansionIndexRef = useRef(0);
  const expandingRef = useRef(false);

  useEffect(() => {
    try {
      setProfile(loadProfile());
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

  const createPath = useCallback(async (subject: string, mode: LearningMode) => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), mode }),
      });

      const data = await response.json();
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
      expansionIndexRef.current = 0;
      return path;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const setActivePath = useCallback((pathId: string) => {
    setProfile((prev) => ({ ...prev, activePathId: pathId }));
  }, []);

  const completeLessonById = useCallback(
    (lessonId: string) => {
      if (!activePath) return;

      const lesson = getLesson(activePath, lessonId);
      const updatedPath = completeLesson(activePath, lessonId);

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
      if (path.mode !== "passive") return;
      if (!profile.notificationSettings.passiveLessonReady) return;

      const title = `Your ${path.mode} lesson is ready`;
      const body = `${path.subject}: ${lessonTitle} — ${path.mode === "passive" ? "2" : "5"} min`;

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

  useEffect(() => {
    if (!activePath || !shouldContinueExpanding(activePath)) return;

    const interval = setInterval(async () => {
      if (expandingRef.current) return;
      expandingRef.current = true;

      try {
        let pathSnapshot: LearningPath | undefined;

        setProfile((prev) => {
          const current = prev.paths.find((p) => p.id === prev.activePathId);
          if (!current || !shouldContinueExpanding(current)) return prev;
          pathSnapshot = current;
          return {
            ...prev,
            paths: prev.paths.map((p) =>
              p.id === current.id ? { ...p, expansionStatus: "generating" as const } : p,
            ),
          };
        });

        if (!pathSnapshot) return;

        const response = await fetch("/api/generate/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathSnapshot,
            templateIndex: expansionIndexRef.current,
          }),
        });

        if (!response.ok) {
          setProfile((prev) => ({
            ...prev,
            paths: prev.paths.map((p) =>
              p.id === pathSnapshot?.id ? { ...p, expansionStatus: "expanding" as const } : p,
            ),
          }));
          return;
        }

        const data = await response.json();
        expansionIndexRef.current += 1;

        const newLesson = data.unit?.lessons?.[0];
        if (newLesson?.isNew) {
          await notifyNewLesson(pathSnapshot, newLesson.title);
        }

        setProfile((prev) => {
          const current = prev.paths.find((p) => p.id === prev.activePathId);
          if (!current) return prev;
          const expanded = appendUnit(current, data.unit);
          return {
            ...prev,
            paths: prev.paths.map((p) => (p.id === expanded.id ? expanded : p)),
          };
        });
      } finally {
        expandingRef.current = false;
      }
    }, EXPANSION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activePath?.id, activePath?.expansionStatus, notifyNewLesson]);

  useEffect(() => {
    if (!profile.userId) return;
    const timer = setTimeout(() => syncToCloud(), 2000);
    return () => clearTimeout(timer);
  }, [profile.paths, profile.reviewCards, profile.userId, syncToCloud]);

  const value: LearningContextValue = {
    profile,
    activePath,
    expansionLabel: activePath ? getExpansionLabel(activePath) : "",
    isHydrated,
    isGenerating,
    dueReviewCount,
    createPath,
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
