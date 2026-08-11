"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { useLearning } from "@/context/learning-context";
import { getPathProgress } from "@/lib/path-engine";

export function AppHeader() {
  const { activePath } = useLearning();

  return (
    <header className="sticky top-0 z-50 border-b border-violet-100/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl curio-btn-primary text-lg font-bold text-white">
            C
          </span>
          <span className="text-xl font-bold tracking-tight curio-gradient-text">Curio</span>
        </Link>

        <nav className="flex items-center gap-3">
          <AuthPanel />
        </nav>
      </div>

      {activePath && (
        <div className="border-t border-violet-100/60 bg-gradient-to-r from-violet-50/80 via-sky-50/60 to-amber-50/50 px-4 py-2.5">
          <div className="mx-auto flex max-w-3xl items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-stone-800">{activePath.subject}</p>
              <p className="text-xs text-violet-600">Learning path</p>
            </div>
            <div className="flex items-center gap-2">
              <StatPill label="Streak" value={activePath.streak} className="bg-amber-100 text-amber-800" />
              <StatPill label="XP" value={activePath.totalXp} className="bg-violet-100 text-violet-800" />
              <StatPill
                label="Done"
                value={`${getPathProgress(activePath).percent}%`}
                className="bg-emerald-100 text-emerald-800"
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function StatPill({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className: string;
}) {
  return (
    <div className={`rounded-xl px-2.5 py-1 text-center ${className}`}>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}
