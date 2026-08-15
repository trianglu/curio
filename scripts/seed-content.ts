/**
 * Pre-generates learning content into content/library/ so the app can serve
 * those subjects without spending API quota.
 *
 *   npm run seed:content -- "Ancient Rome" "Photosynthesis"
 *   npm run seed:content -- --depth 3 "Ancient Rome"
 *   npm run seed:content -- --force "Ancient Rome"
 *
 * Free tiers are the binding constraint: Gemini allows ~20 requests/day per
 * project, so seeding a handful of subjects with --depth 3 can exhaust a day's
 * quota. Run it incrementally and commit as you go.
 */

import { loadEnvConfig } from "@next/env";
import { generateExpansion, generateInitialPath } from "../src/lib/ai/client";
import { isExpansionStopResponse } from "../src/lib/ai/schemas";
import {
  buildExpansionEntry,
  buildPathEntry,
  loadLibraryFile,
  subjectKey,
  writeLibraryFile,
  MAX_CACHE_DEPTH,
  type LibraryFile,
} from "../src/lib/content-cache";

// The AI client reads keys at call time, so loading env before any call is enough.
loadEnvConfig(process.cwd());

interface Options {
  subjects: string[];
  depth: number;
  force: boolean;
}

function parseArgs(argv: string[]): Options {
  const subjects: string[] = [];
  let depth = 1;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--depth") {
      const value = Number(argv[i + 1]);
      if (Number.isNaN(value) || value < 1 || value > MAX_CACHE_DEPTH) {
        throw new Error(`--depth must be between 1 and ${MAX_CACHE_DEPTH}`);
      }
      depth = value;
      i += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      subjects.push(arg);
    }
  }

  return { subjects, depth, force };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Spacing between calls so a multi-subject run does not trip per-minute limits. */
const CALL_SPACING_MS = 4000;

async function seedSubject(subject: string, options: Options): Promise<void> {
  const key = subjectKey(subject);
  if (!key) {
    console.error(`  skipped — "${subject}" has no usable characters`);
    return;
  }

  const existing = (await loadLibraryFile(key)) ?? { subject, expansions: {} };
  const file: LibraryFile = { ...existing, subject };

  if (file.path && !options.force) {
    console.log(`  path: already seeded (use --force to regenerate)`);
  } else {
    const result = await generateInitialPath(subject);
    if ("error" in result) {
      console.error(`  path: FAILED — ${result.message}`);
      return;
    }
    const provider = result.provider === "groq" ? "groq" : "gemini";
    file.path = buildPathEntry(subject, result.data, provider);
    const lessons = result.data.units.reduce((sum, u) => sum + u.lessons.length, 0);
    console.log(
      `  path: ${result.data.units.length} unit(s), ${lessons} lessons via ${provider}`,
    );
    await sleep(CALL_SPACING_MS);
  }

  if (!file.path) return;

  const titles = file.path.response.units.flatMap((unit) =>
    unit.lessons.map((lesson) => lesson.title),
  );

  // The initial path occupies depth 1, so expansions start at 2.
  for (let depth = 2; depth <= options.depth; depth += 1) {
    if (file.expansions[String(depth)] && !options.force) {
      console.log(`  depth ${depth}: already seeded`);
      const cachedUnit = file.expansions[String(depth)].response.unit;
      if (cachedUnit) titles.push(...cachedUnit.lessons.map((l) => l.title));
      continue;
    }

    const sourceTitles = [...titles];
    const result = await generateExpansion(subject, sourceTitles, depth);
    if ("error" in result) {
      console.error(`  depth ${depth}: FAILED — ${result.message}`);
      break;
    }

    const provider = result.provider === "groq" ? "groq" : "gemini";
    file.expansions[String(depth)] = buildExpansionEntry(
      subject,
      depth,
      sourceTitles,
      result.data,
      provider,
    );

    if (isExpansionStopResponse(result.data)) {
      console.log(`  depth ${depth}: exhausted — ${result.data.stopReason}`);
      break;
    }

    const unit = result.data.unit;
    if (unit) {
      titles.push(...unit.lessons.map((l) => l.title));
      console.log(`  depth ${depth}: "${unit.title}" (${unit.lessons.length} lessons)`);
    }
    await sleep(CALL_SPACING_MS);
  }

  await writeLibraryFile(key, file);
  console.log(`  wrote content/library/${key}.json`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.subjects.length === 0) {
    console.error('Usage: npm run seed:content -- [--depth N] [--force] "Subject" ...');
    process.exit(1);
  }

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error(
      "No AI provider configured. Add GROQ_API_KEY or GEMINI_API_KEY to .env.local.",
    );
    process.exit(1);
  }

  for (const subject of options.subjects) {
    console.log(`\n${subject}`);
    try {
      await seedSubject(subject, options);
    } catch (error) {
      console.error(`  errored —`, error);
    }
  }

  console.log("\nDone. Commit content/library/ to share the seeds.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
