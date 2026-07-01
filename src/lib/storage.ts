import { DEFAULT_PROFILE, type LearningPath, type LessonContent, type QuizQuestion, type UserProfile } from "./types";

const STORAGE_KEY = "curio_profile_v2";

function normalizeContent(content: Partial<LessonContent> | undefined): LessonContent {
  if (!content) {
    return {
      summary: "",
      body: "",
      keyPoints: [],
      confidenceLevel: "unknown",
      caveats: ["Content unavailable — please regenerate this learning path."],
    };
  }

  return {
    summary: content.summary ?? "",
    body: content.body ?? "",
    analogy: content.analogy,
    keyPoints: content.keyPoints ?? [],
    question: content.question ? normalizeQuestion(content.question) : undefined,
    confidenceLevel: content.confidenceLevel ?? "consensus",
    caveats: content.caveats ?? ["Legacy lesson — accuracy metadata was added automatically."],
    disputedClaims: content.disputedClaims,
    verifyWith: content.verifyWith,
  };
}

function normalizeQuestion(question: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: question.id ?? `q_legacy_${question.prompt?.slice(0, 20) ?? "unknown"}`,
    prompt: question.prompt ?? "",
    explanation: question.explanation ?? "",
    options: (question.options ?? []).map((opt, i) => ({
      id: opt.id ?? `opt_legacy_${i}`,
      text: opt.text ?? "",
      correct: opt.correct ?? false,
    })),
  };
}

function normalizePath(path: Partial<LearningPath> | null | undefined): LearningPath {
  if (!path || typeof path !== "object") {
    return {
      id: "invalid_path",
      subject: "Unknown",
      mode: "passive",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      units: [],
      expansionStatus: "idle",
      expansionDepth: 0,
      totalXp: 0,
      streak: 0,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      lessonsCompleted: 0,
      aiGenerated: false,
    };
  }

  return {
    id: path.id ?? "unknown_path",
    subject: path.subject ?? "Unknown subject",
    mode: path.mode ?? "passive",
    createdAt: path.createdAt ?? new Date().toISOString(),
    updatedAt: path.updatedAt ?? new Date().toISOString(),
    units: (path.units ?? []).map((unit) => ({
      id: unit?.id ?? "unknown_unit",
      pathId: unit?.pathId ?? path.id ?? "unknown_path",
      title: unit?.title ?? "Unit",
      description: unit?.description ?? "",
      order: unit?.order ?? 0,
      depth: unit?.depth ?? 1,
      lessons: (unit?.lessons ?? []).map((lesson) => ({
        id: lesson?.id ?? "unknown_lesson",
        unitId: lesson?.unitId ?? unit?.id ?? "unknown_unit",
        title: lesson?.title ?? "Lesson",
        type: lesson?.type ?? "summary",
        mode: lesson?.mode ?? "both",
        content: normalizeContent(lesson?.content),
        status: lesson?.status ?? "locked",
        order: lesson?.order ?? 0,
        depth: lesson?.depth ?? 1,
        estimatedMinutes: lesson?.estimatedMinutes ?? 3,
        isNew: lesson?.isNew,
      })),
    })),
    expansionStatus: path.expansionStatus ?? "idle",
    expansionDepth: path.expansionDepth ?? 0,
    totalXp: path.totalXp ?? 0,
    streak: path.streak ?? 0,
    lastActiveDate: path.lastActiveDate ?? new Date().toISOString().slice(0, 10),
    lessonsCompleted: path.lessonsCompleted ?? 0,
    aiGenerated: path.aiGenerated ?? false,
  };
}

export function normalizeProfile(profile: UserProfile): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    paths: (profile.paths ?? []).map(normalizePath),
    reviewCards: profile.reviewCards ?? [],
    notificationSettings: profile.notificationSettings ?? DEFAULT_PROFILE.notificationSettings,
    pushSubscription: profile.pushSubscription ?? null,
  };
}

function migrateLegacy(): UserProfile | null {
  try {
    const legacy = localStorage.getItem("curio_profile_v1");
    if (!legacy) return null;
    const old = JSON.parse(legacy) as {
      activePathId: string | null;
      paths: LearningPath[];
    };
    return normalizeProfile({
      ...DEFAULT_PROFILE,
      activePathId: old.activePathId,
      paths: old.paths,
    });
  } catch {
    return null;
  }
}

export function loadProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return migrateLegacy() ?? DEFAULT_PROFILE;
    }
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return normalizeProfile(parsed as UserProfile);
  } catch (error) {
    console.error("Curio: corrupted saved data, resetting", error);
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProfile(profile)));
}

export function profileToSyncPayload(profile: UserProfile) {
  return {
    active_path_id: profile.activePathId,
    paths: profile.paths,
    review_cards: profile.reviewCards,
    notification_settings: profile.notificationSettings,
    updated_at: new Date().toISOString(),
  };
}

export function syncPayloadToProfile(
  payload: {
    active_path_id: string | null;
    paths: UserProfile["paths"];
    review_cards: UserProfile["reviewCards"];
    notification_settings: UserProfile["notificationSettings"];
  },
  userId: string,
  email: string | null,
  existing: UserProfile,
): UserProfile {
  return normalizeProfile({
    activePathId: payload.active_path_id ?? existing.activePathId,
    paths: payload.paths ?? existing.paths,
    reviewCards: payload.review_cards ?? existing.reviewCards,
    notificationSettings: payload.notification_settings ?? existing.notificationSettings,
    pushSubscription: existing.pushSubscription,
    userId,
    email,
  });
}
