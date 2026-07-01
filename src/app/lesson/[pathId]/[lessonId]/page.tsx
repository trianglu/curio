"use client";

import { useParams, useRouter } from "next/navigation";
import { LessonPlayer } from "@/components/lesson-player";
import { useLearning } from "@/context/learning-context";
import { getLesson } from "@/lib/path-engine";

export default function LessonPage() {
  const params = useParams<{ pathId: string; lessonId: string }>();
  const router = useRouter();
  const { profile } = useLearning();

  const path = profile.paths.find((p) => p.id === params.pathId);
  const lesson = path ? getLesson(path, params.lessonId) : undefined;

  if (!path || !lesson) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-stone-600">Lesson not found.</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white"
        >
          Go home
        </button>
      </div>
    );
  }

  if (lesson.status === "locked") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <span className="text-4xl">🔒</span>
        <p className="text-stone-600">Complete previous lessons to unlock this one.</p>
        <button
          type="button"
          onClick={() => router.push(`/learn/${path.id}`)}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white"
        >
          Back to path
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-8">
      <LessonPlayer lesson={lesson} pathId={path.id} pathMode={path.mode} />
    </div>
  );
}
