# Content library

Pre-generated lesson content, checked first by `/api/generate/path` and
`/api/generate/expand`. A hit costs zero API calls and zero rate-limit quota,
so seeding the subjects you demo most is the cheapest way to stay under the
Groq (6K TPM) and Gemini (~20 req/day) free-tier ceilings.

## Adding a subject

```bash
npm run seed:content -- "Ancient Rome" "Photosynthesis"
```

That calls the real generators once per subject, validates the output, and
writes `<subject-key>.json` here. Commit the result.

To capture whatever you generate while using the app in dev, set
`CURIO_CACHE_PERSIST=1` in `.env.local` — successful generations are written
here as you browse. Never enabled in production (read-only filesystem).

## File format

One file per subject, named by `subjectKey()` in `src/lib/content-cache.ts`
(lowercased, non-alphanumerics collapsed to `-`).

```jsonc
{
  "subject": "Ancient Rome",       // original casing, used for display
  "path": {                         // seeds the initial 1-2 units
    "version": 1,
    "subject": "Ancient Rome",
    "provider": "gemini",
    "generatedAt": "2026-08-15T00:00:00.000Z",
    "response": { "units": [/* AiPathResponse */] }
  },
  "expansions": {                   // keyed by depth, seeds background expansion
    "2": {
      "version": 1,
      "subject": "Ancient Rome",
      "depth": 2,
      "provider": "gemini",
      "generatedAt": "2026-08-15T00:00:00.000Z",
      "sourceTitles": ["..."],     // titles that existed when generated
      "response": { "canExpand": true, "unit": { /* ... */ } }
    }
  }
}
```

Entries are re-validated against the Zod schemas in `src/lib/ai/schemas.ts` on
every read, so a hand-edited or stale file is ignored rather than served — but
it also means schema changes can silently retire seeds. Re-run the seed script
after changing those schemas.

A cached expansion is skipped when any of its lesson titles already appear in
the learner's path, since their earlier units may have covered different
ground. The route falls back to a live AI call in that case.
