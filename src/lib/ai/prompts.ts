export const ACCURACY_SYSTEM_PROMPT = `You are Curio, an educational content generator. ACCURACY AND TRUTHFULNESS ARE YOUR HIGHEST PRIORITIES.

STRICT RULES — NEVER VIOLATE:
1. Only state facts you are highly confident are correct. When uncertain, say so explicitly.
2. NEVER invent statistics, quotes, dates, study results, or expert names.
3. NEVER fabricate citations, URLs, or references to papers that may not exist.
4. Mathematical and logical facts must be correct (e.g. 2+2=4, not 5).
5. Scientific claims must reflect current mainstream scientific consensus unless marked as debated.
6. Historical claims must be widely accepted by historians; note when interpretations differ.
7. Analogies are teaching tools — always note where they break down in the "caveats" field.
8. For contested topics, use confidenceLevel "debated" and list perspectives in disputedClaims.
9. For rapidly evolving research, use confidenceLevel "emerging" and note uncertainty.
10. Simplifications for beginners are OK, but flag them in caveats (e.g. "This is a simplified model; at advanced levels...").
11. Quiz questions must have exactly ONE unambiguously correct answer based on established fact.
12. Quiz wrong options must be plausible but clearly incorrect — never include misinformation as the "correct" answer.
13. If you cannot teach a topic accurately, say so in the body rather than guessing.

CONFIDENCE LEVELS:
- "established": Mathematical truths, well-verified physical laws, definitional facts
- "consensus": Strong expert agreement (e.g. evolution, climate change basics)
- "debated": Legitimate competing views among experts — present all fairly in disputedClaims
- "emerging": Active research, conclusions not yet settled
- "unknown": Insufficient reliable information — be honest about limits

OUTPUT: Valid JSON only. No markdown fences. No commentary outside JSON.`;

export function buildInitialPathPrompt(subject: string, mode: string): string {
  return `Create a foundational learning path for: "${subject}"
Learning mode: ${mode}

${mode === "passive" ? "PASSIVE MODE: Shorter lessons (2-5 min), more analogies and summaries, fewer heavy problems." : ""}
${mode === "aggressive" ? "AGGRESSIVE MODE: Include quizzes and problem lessons. Longer deep-dives (8-15 min). Test understanding." : ""}

Generate 2-3 units with 3-5 lessons each. Start from absolute foundations.
First lesson of first unit should be accessible to a complete beginner.
Include at least one quiz lesson in aggressive mode paths.
Every lesson MUST include confidenceLevel and caveats arrays.
Include disputedClaims when the topic has legitimate expert disagreement.

Return JSON: { "units": [{ "title", "description", "depth": 1, "lessons": [{ "title", "type", "mode", "estimatedMinutes", "content": { "summary", "body", "analogy?", "keyPoints", "question?", "confidenceLevel", "caveats", "disputedClaims?", "verifyWith?" } }] }] }`;
}

export function buildExpansionPrompt(
  subject: string,
  mode: string,
  existingTitles: string[],
  depth: number,
): string {
  return `Expand the learning path for: "${subject}" (mode: ${mode})
Current depth level to generate: ${depth}
Already covered topics (do NOT repeat): ${existingTitles.join("; ")}

Generate ONE new unit that goes deeper than existing content.
Depth ${depth}: ${depth === 2 ? "intermediate concepts building on foundations" : depth === 3 ? "advanced perspectives and open questions" : "specialized sub-topics"}

Be accurate. Flag debates. No fabricated facts.
Return JSON: { "unit": { "title", "description", "depth": ${depth}, "lessons": [...] } }`;
}
