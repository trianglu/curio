"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLearning } from "@/context/learning-context";
import { qualityFromAnswer, sm2Update } from "@/lib/spaced-repetition";
import type { ReviewCard } from "@/lib/types";

interface ReviewSessionProps {
  cards: ReviewCard[];
}

export function ReviewSession({ cards }: ReviewSessionProps) {
  const router = useRouter();
  const { submitReview } = useLearning();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [hesitated, setHesitated] = useState(false);
  const [startTime] = useState(Date.now());

  const card = cards[index];
  if (!card) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="text-5xl">🎉</span>
        <h2 className="text-xl font-bold text-stone-900">All caught up!</h2>
        <p className="text-stone-600">No reviews due right now. Check back tomorrow.</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white"
        >
          Back home
        </button>
      </div>
    );
  }

  const correctOption = card.options.find((o) => o.correct);
  const isCorrect = selected === correctOption?.id;

  function handleSelect(optionId: string) {
    if (showResult) return;
    const elapsed = Date.now() - startTime;
    setHesitated(elapsed > 8000);
    setSelected(optionId);
    setShowResult(true);
  }

  function handleNext() {
    const quality = qualityFromAnswer(isCorrect ?? false, hesitated);
    const updated = sm2Update(card, quality);
    submitReview(card.id, updated);

    if (index + 1 >= cards.length) {
      router.push("/");
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setShowResult(false);
    setHesitated(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>{card.subject}</span>
        <span>
          {index + 1} / {cards.length}
        </span>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
          Spaced repetition review
        </p>
        <p className="mt-3 text-lg font-medium text-stone-900">{card.prompt}</p>

        <div className="mt-5 space-y-2">
          {card.options.map((option) => {
            let style = "border-stone-200 hover:border-indigo-300";
            if (showResult) {
              if (option.correct) style = "border-emerald-400 bg-emerald-50";
              else if (selected === option.id) style = "border-red-300 bg-red-50";
              else style = "border-stone-200 opacity-50";
            } else if (selected === option.id) {
              style = "border-indigo-400 bg-indigo-50";
            }

            return (
              <button
                key={option.id}
                type="button"
                disabled={showResult}
                onClick={() => handleSelect(option.id)}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                {option.text}
              </button>
            );
          })}
        </div>

        {showResult && (
          <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
            {card.explanation}
          </p>
        )}
      </div>

      {showResult && (
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {index + 1 >= cards.length ? "Finish review" : "Next card"}
        </button>
      )}
    </div>
  );
}
