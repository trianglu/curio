/** Rotating unit palette — Duolingo-style color per unit. */
export const UNIT_THEMES = [
  {
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    title: "text-violet-950",
    connector: "from-violet-300 to-violet-200",
    available: "bg-violet-500 text-white ring-violet-300 shadow-violet-300/50",
    completed: "bg-emerald-500 text-white ring-emerald-400 shadow-emerald-300/40",
    locked: "bg-white text-stone-500 ring-stone-300 shadow-stone-200/60",
  },
  {
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    title: "text-sky-950",
    connector: "from-sky-300 to-sky-200",
    available: "bg-sky-500 text-white ring-sky-300 shadow-sky-300/50",
    completed: "bg-emerald-500 text-white ring-emerald-400 shadow-emerald-300/40",
    locked: "bg-white text-stone-500 ring-stone-300 shadow-stone-200/60",
  },
  {
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    title: "text-rose-950",
    connector: "from-rose-300 to-rose-200",
    available: "bg-rose-500 text-white ring-rose-300 shadow-rose-300/50",
    completed: "bg-emerald-500 text-white ring-emerald-400 shadow-emerald-300/40",
    locked: "bg-white text-stone-500 ring-stone-300 shadow-stone-200/60",
  },
  {
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    title: "text-amber-950",
    connector: "from-amber-300 to-amber-200",
    available: "bg-amber-500 text-white ring-amber-300 shadow-amber-300/50",
    completed: "bg-emerald-500 text-white ring-emerald-400 shadow-emerald-300/40",
    locked: "bg-white text-stone-500 ring-stone-300 shadow-stone-200/60",
  },
  {
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    title: "text-teal-950",
    connector: "from-teal-300 to-teal-200",
    available: "bg-teal-500 text-white ring-teal-300 shadow-teal-300/50",
    completed: "bg-emerald-500 text-white ring-emerald-400 shadow-emerald-300/40",
    locked: "bg-white text-stone-500 ring-stone-300 shadow-stone-200/60",
  },
  {
    badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    title: "text-fuchsia-950",
    connector: "from-fuchsia-300 to-fuchsia-200",
    available: "bg-fuchsia-500 text-white ring-fuchsia-300 shadow-fuchsia-300/50",
    completed: "bg-emerald-500 text-white ring-emerald-400 shadow-emerald-300/40",
    locked: "bg-white text-stone-500 ring-stone-300 shadow-stone-200/60",
  },
] as const;

export const CHECKPOINT_THEME = {
  badge: "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-900 border-amber-300",
  title: "text-amber-950",
  connector: "from-amber-400 via-orange-300 to-amber-200",
  available: "bg-gradient-to-br from-amber-500 to-orange-500 text-white ring-amber-300 shadow-amber-300/50",
  completed: "bg-emerald-500 text-white ring-emerald-400 shadow-emerald-300/40",
  locked: "bg-amber-50/80 text-stone-500 ring-amber-200 shadow-amber-100/60",
} as const;

export function getUnitTheme(unitIndex: number, kind?: string) {
  if (kind === "checkpoint") return CHECKPOINT_THEME;
  return UNIT_THEMES[unitIndex % UNIT_THEMES.length];
}

export const LESSON_TYPE_RING: Record<string, string> = {
  quiz: "ring-amber-300",
  problem: "ring-orange-300",
  review: "ring-amber-400",
  analogy: "ring-cyan-300",
  summary: "ring-blue-300",
  "deep-dive": "ring-purple-300",
  concept: "ring-indigo-300",
};

export const EXAMPLE_SUBJECT_COLORS = [
  "bg-violet-100 text-violet-800 hover:bg-violet-200 border-violet-200",
  "bg-sky-100 text-sky-800 hover:bg-sky-200 border-sky-200",
  "bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-200",
  "bg-teal-100 text-teal-800 hover:bg-teal-200 border-teal-200",
  "bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-200",
] as const;
