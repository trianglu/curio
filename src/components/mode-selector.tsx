"use client";

import { useLearning } from "@/context/learning-context";
import type { LearningMode } from "@/lib/types";

const MODES: Array<{
  id: LearningMode;
  title: string;
  subtitle: string;
  icon: string;
  features: string[];
}> = [
  {
    id: "passive",
    title: "Passive",
    subtitle: "Learn while life happens",
    icon: "☁️",
    features: [
      "2–5 min bite-sized lessons",
      "Analogies & summaries",
      "Background path expansion",
      "Perfect when you're busy",
    ],
  },
  {
    id: "aggressive",
    title: "Aggressive",
    subtitle: "Structured deep learning",
    icon: "⚡",
    features: [
      "20–45 min focused sessions",
      "Problems & active recall",
      "Quizzes that test connections",
      "For when you want mastery",
    ],
  },
];

interface ModeSelectorProps {
  value: LearningMode;
  onChange: (mode: LearningMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {MODES.map((mode) => {
        const selected = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={`rounded-2xl border-2 p-4 text-left transition-all ${
              selected
                ? "border-indigo-500 bg-indigo-50 shadow-sm"
                : "border-stone-200 bg-white hover:border-stone-300"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">{mode.icon}</span>
              <div>
                <p className="font-semibold text-stone-900">{mode.title}</p>
                <p className="text-xs text-stone-500">{mode.subtitle}</p>
              </div>
            </div>
            <ul className="space-y-1">
              {mode.features.map((feature) => (
                <li key={feature} className="text-xs text-stone-600">
                  • {feature}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

export function ExpansionBanner() {
  const { activePath, expansionLabel, toggleBackgroundExpansion } = useLearning();

  if (!activePath) return null;

  const isExpanding = activePath.expansionStatus === "expanding";
  const isGenerating = activePath.expansionStatus === "generating";

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 text-lg ${isExpanding || isGenerating ? "animate-pulse" : ""}`}>
            {isGenerating ? "🤖" : isExpanding ? "🔬" : "⏸️"}
          </span>
          <div>
            <p className="text-sm font-medium text-indigo-900">
              {isGenerating
                ? "AI is generating new lessons…"
                : isExpanding
                  ? "Curio is researching in the background"
                  : "Background research paused"}
            </p>
            <p className="text-xs text-indigo-700/80">{expansionLabel}</p>
            <p className="mt-1 text-xs text-indigo-600/70">
              New lessons appear on your path as they&apos;re discovered
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleBackgroundExpansion}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-50"
        >
          {isExpanding ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}
