"use client";

import type { ConfidenceLevel, DisputedClaim, LessonContent } from "@/lib/types";

const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  { label: string; color: string; description: string }
> = {
  established: {
    label: "Established fact",
    color: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    description: "Widely verified — mathematical truths, definitions, physical laws",
  },
  consensus: {
    label: "Expert consensus",
    color: "bg-blue-100 text-blue-800 ring-blue-200",
    description: "Strong agreement among experts in this field",
  },
  debated: {
    label: "Actively debated",
    color: "bg-amber-100 text-amber-800 ring-amber-200",
    description: "Legitimate competing views exist among experts",
  },
  emerging: {
    label: "Emerging research",
    color: "bg-purple-100 text-purple-800 ring-purple-200",
    description: "Active research — conclusions may change as evidence grows",
  },
  unknown: {
    label: "Limited certainty",
    color: "bg-stone-100 text-stone-700 ring-stone-200",
    description: "Insufficient reliable information — treat with caution",
  },
};

interface AccuracyPanelProps {
  content: LessonContent;
}

export function AccuracyBadge({ level }: { level: ConfidenceLevel }) {
  const config = CONFIDENCE_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${config.color}`}
      title={config.description}
    >
      {config.label}
    </span>
  );
}

export function AccuracyPanel({ content }: AccuracyPanelProps) {
  const level = content.confidenceLevel ?? "unknown";
  const config = CONFIDENCE_CONFIG[level] ?? CONFIDENCE_CONFIG.unknown;

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Accuracy & honesty
          </p>
          <p className="mt-1 text-sm text-stone-600">{config.description}</p>
        </div>
        <AccuracyBadge level={level} />
      </div>

      {content.caveats && content.caveats.length > 0 && (
        <div>
          <p className="text-xs font-medium text-stone-500">Caveats & simplifications</p>
          <ul className="mt-1.5 space-y-1">
            {content.caveats.map((caveat) => (
              <li key={caveat} className="flex items-start gap-2 text-sm text-stone-600">
                <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
                {caveat}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.disputedClaims && content.disputedClaims.length > 0 && (
        <div>
          <p className="text-xs font-medium text-stone-500">Competing perspectives</p>
          <div className="mt-2 space-y-3">
            {content.disputedClaims.map((claim: DisputedClaim) => (
              <div key={claim.topic} className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                <p className="text-sm font-medium text-stone-800">{claim.topic}</p>
                <ul className="mt-2 space-y-1.5">
                  {claim.perspectives.map((perspective) => (
                    <li key={perspective} className="text-sm text-stone-600">
                      • {perspective}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.verifyWith && content.verifyWith.length > 0 && (
        <div>
          <p className="text-xs font-medium text-stone-500">Verify with</p>
          <ul className="mt-1 space-y-1">
            {content.verifyWith.map((source) => (
              <li key={source} className="text-sm text-stone-600">
                📚 {source}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-stone-400">
        Curio prioritizes accuracy. When experts disagree, we show you the debate — not a false
        certainty. Always verify critical claims with primary sources.
      </p>
    </div>
  );
}
