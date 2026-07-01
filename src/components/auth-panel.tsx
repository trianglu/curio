"use client";

import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useLearning } from "@/context/learning-context";

export function AuthPanel() {
  const { profile, signOut, syncToCloud } = useLearning();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (!isSupabaseConfigured()) return null;

  async function handleMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    setMessage(error ? error.message : "Check your email for a sign-in link!");
  }

  if (profile.userId && profile.email) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => syncToCloud()}
          className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-700"
          title="Sync to cloud"
        >
          ☁️ Sync
        </button>
        <span className="hidden text-xs text-stone-500 sm:inline">{profile.email}</span>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
      >
        Sign in to sync
      </button>
    );
  }

  return (
    <form onSubmit={handleMagicLink} className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="w-36 rounded-lg border border-stone-200 px-2 py-1 text-xs sm:w-44"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "…" : "Link"}
      </button>
      <button
        type="button"
        onClick={() => setShowForm(false)}
        className="text-xs text-stone-400 hover:text-stone-600"
      >
        ✕
      </button>
      {message && <span className="text-xs text-emerald-600">{message}</span>}
    </form>
  );
}
