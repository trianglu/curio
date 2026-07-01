"use client";

interface LoadingPathProps {
  subject: string;
  stage?: string;
}

export function LoadingPath({ subject, stage = "Researching your subject…" }: LoadingPathProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <div className="relative mb-8">
        <div className="h-20 w-20 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">🔬</span>
      </div>
      <h2 className="text-xl font-bold text-stone-900">Building your {subject} path</h2>
      <p className="mt-2 text-sm text-stone-500">{stage}</p>
      <div className="mt-8 max-w-sm space-y-2 text-center text-xs text-stone-400">
        <p>Gathering foundational concepts…</p>
        <p>Checking accuracy — we never invent facts</p>
        <p>Flagging debates and uncertainties upfront</p>
      </div>
    </div>
  );
}

export function GeneratingBanner() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
      AI is researching deeper content…
    </div>
  );
}
