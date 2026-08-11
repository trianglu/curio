# Curio — Agent Guide

Duolingo-style AI learning app. Open **this folder** as your Cursor workspace (`~/Projects/curio`).

## Stack

- Next.js 16, React 19, TypeScript, Tailwind v4
- AI: Groq + Gemini (`src/lib/ai/`)
- Storage: localStorage + optional Supabase sync
- Dev: `npm run dev -- -p 3001`

## Key files

- `src/context/learning-context.tsx` — profile state, background expansion
- `src/lib/path-engine.ts` — path progress, expansion helpers
- `src/lib/expansion-runner.ts` — intervals, backoff, progress bar
- `src/lib/ai/prompts.ts` — AI prompts (accuracy-first)
- `src/components/expansion-banner.tsx` — expansion status UI
- `src/app/example/page.tsx` — interactive demo without API keys
- `src/app/learn/[pathId]/page.tsx` — main learn page

## Conventions

- Small focused diffs; match existing style
- Don't commit unless asked
- Expansion stops on pause or after repeated AI empty passes (no reliable content left)
