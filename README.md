# Curio

**Learn anything, at your pace — truthfully.**

Curio is a Duolingo-style web app that builds personalized learning paths for any subject. It uses AI (Groq and/or Gemini) for real curricula, highlights uncertainty instead of inventing facts, and keeps progress local (with optional cloud sync).

This repository ships a working UI, path generation APIs, spaced-repetition review, and an interactive **example path** you can explore without API keys.

---

## Features

| Feature | Description |
|---------|-------------|
| **AI learning paths** | Curriculum + lessons for any subject via free Groq/Gemini APIs |
| **Example mode** | `/example` — try the product UI with template Quantum Physics lessons (no keys) |
| **Accuracy first** | Confidence levels, caveats, disputed-claim panels — no false certainty |
| **Background expansion** | AI adds deeper units over time while you learn |
| **Content library** | Pre-generated subjects served with zero API calls — see below |
| **Audio lessons** | Browser text-to-speech for hands-free review |
| **Push notifications** | Optional web push when new passive content is ready |
| **Spaced repetition** | SM-2 reviews of quiz items over time |
| **Cloud sync** | Optional Supabase auth + cross-device profile sync |

---

## Quick start

**Requirements:** Node.js 20+ recommended, npm.

```bash
git clone https://github.com/<your-username>/curio.git
cd curio
npm install
cp .env.example .env.local
# Optional: add AI keys (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Agent/dev convention in this workspace:

```bash
npm run dev -- -p 3001
```

### Try without API keys

1. Start the app (`npm run dev`).
2. Open **[http://localhost:3000/example](http://localhost:3000/example)**.
3. Click **Start the example path** to load a sample **Quantum Physics** map and lesson player.

Template lessons teach the product structure (units, quizzes, accuracy UI). They are **not** a real AI course on that subject.

---

## Adding API keys (required for real AI content)

AI keys live **only** in a local file (`.env.local`). Never commit real keys to Git.

### 1. Create your env file

```bash
cp .env.example .env.local
```

### 2. Pick a free AI provider (one is enough)

#### Option A — Groq (recommended: free tier, fast)

1. Go to [console.groq.com](https://console.groq.com) and sign in.
2. Open **API Keys** → create a key.
3. Put it in `.env.local`:

```env
GROQ_API_KEY=gsk_your_key_here
```

#### Option B — Google Gemini

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey).
2. Create a key.
3. Put it in `.env.local`:

```env
GEMINI_API_KEY=your_key_here
```

You can set **both**. Curio tries providers in a configured order and can fall back when one rate-limits.

### 3. Restart the dev server

Env vars are read at process start. After editing `.env.local`:

```bash
# stop the server (Ctrl+C), then:
npm run dev
```

### 4. Generate a real path

1. On the home page, type a subject (or pick an example chip).
2. Click **Generate my learning path**.
3. Complete lessons; expansion may append more units in the background when AI is configured.

If keys are missing, path generation returns an error and the home page offers the **example path** instead of an API-setup wall. Template paths (if any) show a banner with **Regenerate with AI** once keys work.

### Full `.env.local` reference

Copy from `.env.example`:

```env
# Free AI providers (at least one for real curricula)
GROQ_API_KEY=
GEMINI_API_KEY=

# Optional: Supabase auth + sync
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Optional: Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

---

## Content library (reuse instead of regenerating)

Free tiers are the real constraint on this app: Groq allows 6K tokens per minute
and Gemini roughly 20 requests per day per project. Every learner who asks for
"Ancient Rome" otherwise burns fresh quota generating near-identical lessons.

`content/library/` holds pre-generated content that `/api/generate/path` and
`/api/generate/expand` check **before** calling any provider. A hit costs no
quota and works even with no API keys configured.

Seed the subjects you care about:

```bash
npm run seed:content -- "Ancient Rome" "Photosynthesis"

# also pre-generate background expansion units up to depth 3
npm run seed:content -- --depth 3 "Ancient Rome"

# regenerate an already-seeded subject
npm run seed:content -- --force "Ancient Rome"
```

Commit the resulting JSON so every deploy and teammate benefits.

To capture what you generate while browsing in dev, set `CURIO_CACHE_PERSIST=1`
in `.env.local`; successful generations are written to `content/library/` as you
use the app. This never runs in production, where the filesystem is read-only.

Details worth knowing:

- Subjects are matched loosely, so `Ancient Rome`, `ancient rome`, and
  `  Ancient  Rome!  ` share one entry. The learner still sees their own casing.
- Path/unit/lesson ids are minted per request, so a shared entry never collides
  across learners or progress records.
- **Regenerate** on a path bypasses the library on purpose — a learner asking for
  different content should not be handed the version they just rejected.
- A cached expansion unit is skipped when it would repeat a lesson the learner
  already has, falling back to a live call.
- Entries are re-validated against `src/lib/ai/schemas.ts` on every read, so a
  stale or hand-edited file is ignored rather than served. Re-run the seed script
  after changing those schemas.

---

## Optional services

### Cloud sync (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL Editor.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
4. Enable Email auth under Authentication → Providers.
5. Restart the dev server.

### Push notifications

```bash
npx web-push generate-vapid-keys
```

Add public/private keys to `.env.local` as above, then restart.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (default port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run seed:content -- "Subject"` | Pre-generate content into `content/library/` |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Home — create path, list your paths
│   ├── example/page.tsx         # Interactive demo without API keys
│   ├── learn/[pathId]/         # Path map + continue
│   ├── lesson/[pathId]/[id]/   # Lesson player
│   ├── review/                  # Spaced-repetition session
│   └── api/
│       ├── generate/path        # Initial AI path
│       ├── generate/expand      # Background expansion
│       ├── generate/upgrade     # Template → AI upgrade helpers
│       ├── push/                # Web push
│       └── sync/                # Cloud profile sync
├── components/                  # UI (path map, player, banners, …)
├── context/learning-context.tsx # Profile state, expansion loop
├── lib/
│   ├── ai/                      # Client, prompts, schemas, transform
│   ├── content-cache.ts         # Subject-keyed reuse of generated content
│   ├── mock-generator.ts        # Template path for example mode
│   ├── path-engine.ts           # Progress / unlock helpers
│   └── expansion-runner.ts      # Expansion timing + progress bar
└── …
content/library/                 # Pre-generated lessons (zero-quota hits)
scripts/seed-content.ts          # CLI that fills the library
public/sw.js                     # Service worker (production)
supabase/schema.sql              # Optional DB schema
```

---

## Accuracy commitment

Curio is designed to reduce AI misinformation:

- System prompts forbid inventing statistics, quotes, or citations
- Lessons carry a **confidence level** (established → debated → emerging)
- **Caveats** call out simplifications and where analogies break down
- **Competing perspectives** appear for legitimately contested claims
- Quiz answers must be unambiguously correct
- You should still verify important claims against primary sources

---

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4**
- **AI:** Groq + Google Gemini
- **Data:** `localStorage` + optional Supabase
- **Push:** web-push (VAPID)
- **Audio:** Web Speech API

---

## Development notes

- App state and path progress: `src/context/learning-context.tsx`
- Expansion behavior: `src/lib/path-engine.ts`, `src/lib/expansion-runner.ts`
- Prompts and accuracy rules: `src/lib/ai/prompts.ts`
- Agent-oriented layout notes: `AGENTS.md`
- Secrets: `.env.local` is gitignored. Rotate keys if they were ever committed or pasted into chat logs.

---

## Deploying

1. Deploy to [Vercel](https://vercel.com) (or any Node host that supports Next.js).
2. In the host dashboard, set the same env vars as `.env.local` (at least one AI key for production generation).
3. Redeploy after changing secrets.

Do **not** put API keys in client-side `NEXT_PUBLIC_*` variables except the intended public ones (Supabase URL/anon key, VAPID public key).

---

## License

Private project unless otherwise stated by the repository owner.
