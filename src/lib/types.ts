export type LessonType =
  | "concept"
  | "analogy"
  | "summary"
  | "quiz"
  | "problem"
  | "deep-dive"
  | "review";

export type UnitKind = "content" | "checkpoint";

export type LessonStatus = "locked" | "available" | "in_progress" | "completed";

export type ExpansionStatus = "idle" | "expanding" | "paused" | "generating" | "exhausted";

export type GenerationProvider = "groq" | "gemini";

export type ConfidenceLevel =
  | "established"
  | "consensus"
  | "debated"
  | "emerging"
  | "unknown";

export interface DisputedClaim {
  topic: string;
  perspectives: string[];
}

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  explanation: string;
}

export interface LessonContent {
  summary: string;
  body: string;
  analogy?: string;
  keyPoints: string[];
  question?: QuizQuestion;
  confidenceLevel: ConfidenceLevel;
  caveats: string[];
  disputedClaims?: DisputedClaim[];
  verifyWith?: string[];
}

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  type: LessonType;
  content: LessonContent;
  status: LessonStatus;
  order: number;
  depth: number;
  estimatedMinutes: number;
  isNew?: boolean;
  /** Populated for review-round lessons recycled from earlier problem/quiz lessons. */
  reviewSource?: {
    lessonId: string;
    lessonTitle: string;
    unitTitle: string;
    unitOrder: number;
    sourceType: "problem" | "quiz";
  };
}

export interface Unit {
  id: string;
  pathId: string;
  title: string;
  description: string;
  order: number;
  depth: number;
  lessons: Lesson[];
  kind?: UnitKind;
  /** Content unit order this checkpoint follows (checkpoint units only). */
  checkpointAfterUnit?: number;
}

export interface LearningPath {
  id: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  units: Unit[];
  expansionStatus: ExpansionStatus;
  expansionDepth: number;
  totalXp: number;
  streak: number;
  lastActiveDate: string;
  lessonsCompleted: number;
  aiGenerated: boolean;
  /** Which AI provider created the initial path. */
  generationProvider?: GenerationProvider;
  /** True once Gemini has reviewed and enriched a Groq-generated path. */
  geminiUpgraded?: boolean;
  lastAddedUnitTitle?: string;
  lastAddedUnitAt?: string;
  expansionStopReason?: string;
  /** Consecutive expansion passes that found no reliable content. */
  expansionEmptyPasses?: number;
}

export interface ReviewCard {
  id: string;
  questionId: string;
  lessonId: string;
  pathId: string;
  subject: string;
  prompt: string;
  options: QuizOption[];
  explanation: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
}

export interface NotificationSettings {
  passiveLessonReady: boolean;
  reviewReminders: boolean;
  dailyReminderHour: number;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface UserProfile {
  activePathId: string | null;
  paths: LearningPath[];
  reviewCards: ReviewCard[];
  pushSubscription: PushSubscriptionData | null;
  notificationSettings: NotificationSettings;
  userId: string | null;
  email: string | null;
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  passiveLessonReady: true,
  reviewReminders: true,
  dailyReminderHour: 9,
};

export const DEFAULT_PROFILE: UserProfile = {
  activePathId: null,
  paths: [],
  reviewCards: [],
  pushSubscription: null,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  userId: null,
  email: null,
};
