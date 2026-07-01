"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LessonContent } from "@/lib/types";

interface AudioPlayerProps {
  content: LessonContent;
  title: string;
  autoPlay?: boolean;
}

function buildNarrationScript(content: LessonContent, title: string): string {
  const parts = [
    title,
    content.summary,
    content.body,
    content.analogy ? `Analogy: ${content.analogy}` : "",
    content.keyPoints.length > 0
      ? `Key points: ${content.keyPoints.join(". ")}`
      : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

export function AudioPlayer({ content, title, autoPlay = false }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [supported, setSupported] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!supported) return;
    stop();

    const script = buildNarrationScript(content, title);
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = rate;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith("en") && v.name.includes("Natural")) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }, [content, title, rate, supported, stop]);

  useEffect(() => {
    if (autoPlay && supported) {
      const timer = setTimeout(play, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, supported, play]);

  useEffect(() => () => stop(), [stop]);

  if (!supported) {
    return (
      <p className="text-sm text-stone-500">
        Audio narration is not supported in this browser.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
      <span className="text-lg">🎧</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-indigo-900">Listen while commuting</p>
        <p className="text-xs text-indigo-700/70">Free browser narration — no account needed</p>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={rate}
          onChange={(e) => {
            setRate(Number(e.target.value));
            if (playing) {
              stop();
              setTimeout(play, 100);
            }
          }}
          className="rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs text-indigo-800"
        >
          <option value={0.8}>0.8×</option>
          <option value={1}>1×</option>
          <option value={1.2}>1.2×</option>
          <option value={1.5}>1.5×</option>
        </select>
        <button
          type="button"
          onClick={playing ? stop : play}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {playing ? "Stop" : "Play audio"}
        </button>
      </div>
    </div>
  );
}
