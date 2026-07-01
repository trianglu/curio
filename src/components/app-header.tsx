"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { useLearning } from "@/context/learning-context";
import { getPathProgress } from "@/lib/path-engine";

export function AppHeader() {
  const { activePath, dueReviewCount } = useLearning();

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
            C
          </span>
          <span className="text-xl font-semibold tracking-tight text-stone-900">Curio</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/review"
            className="relative rounded-lg px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            Review
            {dueReviewCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {dueReviewCount}
              </span>
            )}
          </Link>
          <AuthPanel />
        </nav>
      </div>

      {activePath && (
        <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center justify-between text-sm">
            <div>
              <p className="font-medium text-stone-800">{activePath.subject}</p>
              <p className="text-xs capitalize text-stone-500">{activePath.mode} mode</p>
            </div>
            <div className="flex items-center gap-4">
              <Stat label="Streak" value={activePath.streak} color="text-amber-600" />
              <Stat label="XP" value={activePath.totalXp} color="text-indigo-600" />
              <Stat
                label="Done"
                value={`${getPathProgress(activePath).percent}%`}
                color="text-emerald-600"
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="text-center">
      <p className={`font-bold ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-stone-400">{label}</p>
    </div>
  );
}
