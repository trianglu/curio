# Curio

Learn anything, at your pace — truthfully. A Duolingo-style web app with AI-generated learning paths, spaced repetition, audio lessons, and push notifications.

## Features

| Feature | Description |
|---------|-------------|
| **AI learning paths** | Free via Groq or Gemini API — instant curriculum for any subject |
| **Passive / Aggressive modes** | Bite-sized vs deep sessions — different content types and pace |
| **Accuracy first** | Confidence badges, caveats, disputed-claim panels — no false certainty |
| **Background expansion** | AI researches deeper content every ~60s and adds to your path |
| **Audio lessons** | Free browser TTS for commuting (passive mode) |
| **Push notifications** | "Your 2-min lesson is ready" for passive learners |
| **Spaced repetition** | SM-2 algorithm reviews quiz questions over time |
| **Cloud sync** | Supabase auth + cross-device sync |

## Quick start

```bash
npm install
cp .env.example .env.local
# Add at least one AI key (Groq or Gemini)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment setup

### AI (free — pick one or both)

1. **Groq** (recommended): [console.groq.com](https://console.groq.com) → API Keys → add to `GROQ_API_KEY`
2. **Gemini**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → add to `GEMINI_API_KEY`

Without keys, the app falls back to template content with a visible warning.

### Cloud sync (optional)

1. Create a free [Supabase](https://supabase.com) project
2. Run `supabase/schema.sql` in the SQL Editor
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
4. Enable Email auth in Supabase → Authentication → Providers

### Push notifications (optional)

```bash
npx web-push generate-vapid-keys
```

Add the keys to `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

## Accuracy commitment

Curio is designed to minimize AI misinformation:

- System prompts forbid inventing stats, quotes, or citations
- Every lesson has a **confidence level** (established → debated → emerging)
- **Caveats** flag simplifications and where analogies break down
- **Competing perspectives** shown for legitimately debated topics
- Quiz answers must have one unambiguously correct option
- Users are encouraged to verify critical claims with primary sources

## Architecture

```
src/
├── app/api/generate/   # AI path + expansion endpoints
├── app/api/push/       # Web push subscribe + send
├── app/api/sync/       # Supabase cloud sync
├── lib/ai/             # Prompts, client, schemas, transform
├── lib/spaced-repetition.ts  # SM-2 algorithm
├── context/            # Global state + background expansion
└── components/         # UI including accuracy panel, audio, review
```

## Tech stack

Next.js 16 · TypeScript · Tailwind v4 · Supabase · Groq/Gemini · Web Push · Web Speech API
