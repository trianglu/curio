"use client";

import { useMemo } from "react";
import { ReviewSession } from "@/components/review-session";
import { useLearning } from "@/context/learning-context";
import { isDueForReview } from "@/lib/spaced-repetition";

export default function ReviewPage() {
  const { profile } = useLearning();

  const dueCards = useMemo(
    () => profile.reviewCards.filter((c) => isDueForReview(c.nextReviewDate)),
    [profile.reviewCards],
  );

  return (
    <div className="flex-1 px-4 py-8">
      <div className="mx-auto mb-8 max-w-xl text-center">
        <h1 className="text-2xl font-bold text-stone-900">Daily review</h1>
        <p className="mt-2 text-sm text-stone-600">
          Spaced repetition helps you remember what you learned — without misinformation
          creeping back in as &quot;fact.&quot;
        </p>
      </div>
      <ReviewSession cards={dueCards} />
    </div>
  );
}
