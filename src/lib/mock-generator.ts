import { createId } from "./id";
import type {
  LearningMode,
  LearningPath,
  Lesson,
  LessonContent,
  LessonType,
  QuizQuestion,
  Unit,
} from "./types";

interface UnitTemplate {
  title: string;
  description: string;
  lessons: Array<{
    title: string;
    type: LessonType;
    mode: LearningMode | "both";
    minutes: number;
    content: (subject: string) => Omit<LessonContent, "confidenceLevel" | "caveats">;
  }>;
}

const FOUNDATION_UNITS: UnitTemplate[] = [
  {
    title: "Why {subject} Matters",
    description: "Context, motivation, and the big picture.",
    lessons: [
      {
        title: "The Big Picture",
        type: "summary",
        mode: "both",
        minutes: 3,
        content: (subject) => ({
          summary: `A quick orientation to ${subject}.`,
          body: `${subject} shapes how we understand the world around us. Before diving into details, it helps to know why people study it, where it shows up in real life, and what questions it tries to answer.\n\nMost learners feel overwhelmed because they skip this step. You won't. By the end of this lesson, you'll have a mental map of the field — not every formula or date, but the landscape itself.`,
          keyPoints: [
            `${subject} connects theory to real-world problems`,
            "Experts start with questions, not memorization",
            "Foundations make advanced topics much easier later",
          ],
        }),
      },
      {
        title: "Everyday Connections",
        type: "analogy",
        mode: "passive",
        minutes: 2,
        content: (subject) => ({
          summary: `See ${subject} in things you already know.`,
          body: `The best way to start learning ${subject} is to anchor it to something familiar. Every complex field has simple entry points — patterns you've seen before without naming them.`,
          analogy: `Think of ${subject} like learning a new city. You don't memorize every street on day one. You learn landmarks, main roads, and neighborhoods. Then the city starts to feel navigable.`,
          keyPoints: [
            "Start with patterns, not jargon",
            "Analogies are scaffolding, not shortcuts",
            "Revisit this lesson when things feel abstract",
          ],
        }),
      },
      {
        title: "Core Vocabulary",
        type: "concept",
        mode: "both",
        minutes: 4,
        content: (subject) => ({
          summary: `Essential terms you'll see everywhere in ${subject}.`,
          body: `Every field has a shared language. In ${subject}, a handful of terms appear again and again. Learning these early prevents the "reading without understanding" feeling.\n\nDon't try to memorize everything at once. Focus on recognizing these words when they appear — meaning deepens with use.`,
          keyPoints: [
            "Terms are tools, not trivia",
            "Context matters more than definitions alone",
            "You'll revisit vocabulary as you progress",
          ],
        }),
      },
      {
        title: "Check Your Intuition",
        type: "quiz",
        mode: "aggressive",
        minutes: 5,
        content: (subject) => ({
          summary: `Quick check on your starting intuition for ${subject}.`,
          body: `Active recall — even when you're wrong — builds stronger memory than re-reading. Answer from gut instinct first.`,
          keyPoints: [
            "Wrong answers reveal gaps to focus on",
            "Intuition improves with practice",
            "This quiz has no grade — only feedback",
          ],
          question: buildQuiz(
            `What is the best first step when learning ${subject}?`,
            [
              "Memorize every advanced formula immediately",
              "Understand the big picture and core questions",
              "Skip foundations and jump to research papers",
            ],
            1,
            "Foundations reduce confusion later. Experts still revisit the big picture when stuck.",
          ),
        }),
      },
    ],
  },
  {
    title: "Building Blocks",
    description: "The fundamental ideas everything else rests on.",
    lessons: [
      {
        title: "First Principles",
        type: "concept",
        mode: "both",
        minutes: 4,
        content: (subject) => ({
          summary: `The foundational assumptions behind ${subject}.`,
          body: `${subject} is built on a small set of first principles — ideas that aren't derived from other ideas in the field. Understanding these gives you a stable base when topics get complex.\n\nWhen advanced material feels confusing, trace it back to these principles. Most confusion comes from a shaky foundation, not from the advanced topic itself.`,
          keyPoints: [
            "First principles are the field's starting assumptions",
            "Advanced topics combine basic ideas in new ways",
            "If stuck, ask: which building block am I missing?",
          ],
        }),
      },
      {
        title: "How Experts Think",
        type: "analogy",
        mode: "passive",
        minutes: 3,
        content: (subject) => ({
          summary: `The mental habits that make ${subject} click.`,
          body: `Experts in ${subject} don't just know more facts — they see structure. They notice when something is unusual, when an approximation is good enough, and when to dig deeper.`,
          analogy: `Learning ${subject} is like learning to cook. Beginners follow recipes line by line. Experienced cooks taste, adjust, and know which steps matter. You're building that taste.`,
          keyPoints: [
            "Pattern recognition beats raw memorization",
            "Experts ask 'what would change my mind?'",
            "Confusion is signal, not failure",
          ],
        }),
      },
      {
        title: "Worked Example",
        type: "concept",
        mode: "aggressive",
        minutes: 8,
        content: (subject) => ({
          summary: `Walk through a canonical example in ${subject}.`,
          body: `Reading about ${subject} is different from working through an example step by step. This lesson follows one representative problem from setup to conclusion.\n\nPay attention not just to the answer, but to why each step was taken and what alternatives were rejected.`,
          keyPoints: [
            "Follow the reasoning, not just the result",
            "Note where assumptions enter the solution",
            "Try to predict the next step before reading it",
          ],
        }),
      },
      {
        title: "Practice Problem",
        type: "problem",
        mode: "aggressive",
        minutes: 10,
        content: (subject) => ({
          summary: `Apply what you've learned in ${subject}.`,
          body: `This is deliberate practice — the kind that actually builds skill. Work through the problem before revealing the solution. Struggling is part of the process.`,
          keyPoints: [
            "Attempt the problem before checking answers",
            "Partial solutions still build understanding",
            "Review mistakes — they're your best teachers",
          ],
          question: buildQuiz(
            `In ${subject}, what should you do when a solution doesn't match your expectation?`,
            [
              "Assume the textbook is wrong",
              "Trace back to assumptions and intermediate steps",
              "Move on and hope it makes sense later",
            ],
            1,
            "Unexpected results usually mean a hidden assumption or calculation error — tracing back is the expert move.",
          ),
        }),
      },
    ],
  },
  {
    title: "Connecting the Dots",
    description: "See how foundational ideas link together.",
    lessons: [
      {
        title: "The Central Model",
        type: "concept",
        mode: "both",
        minutes: 5,
        content: (subject) => ({
          summary: `The core framework that organizes ${subject}.`,
          body: `Most fields have a central model or framework — a way of organizing ideas that makes the subject feel coherent instead of scattered. In ${subject}, this model helps you predict, explain, and explore.\n\nYou don't need to master every detail yet. Just understand what the model is trying to capture and why it was built this way.`,
          keyPoints: [
            "Central models simplify without oversimplifying",
            "They highlight what matters most",
            "Details attach to this framework over time",
          ],
        }),
      },
      {
        title: "Quick Recap",
        type: "summary",
        mode: "passive",
        minutes: 2,
        content: (subject) => ({
          summary: `Everything so far in ${subject}, in two minutes.`,
          body: `You've covered why ${subject} matters, its building blocks, and the central model that ties them together. That's a solid foundation — more than most people ever build.\n\nThe path ahead goes deeper. New lessons will appear as Curio researches more topics for you.`,
          keyPoints: [
            "You now have a mental map of the field",
            "Deeper content unlocks as you progress",
            "Even 2 minutes a day compounds over weeks",
          ],
        }),
      },
      {
        title: "Synthesis Quiz",
        type: "quiz",
        mode: "aggressive",
        minutes: 6,
        content: (subject) => ({
          summary: `Connect ideas across your ${subject} foundation.`,
          body: `This quiz tests connections between concepts, not isolated facts. That's how real understanding works.`,
          keyPoints: [
            "Connecting ideas beats isolated facts",
            "Explain answers out loud if you can",
            "Review lessons for any missed connections",
          ],
          question: buildQuiz(
            `What's the main benefit of understanding first principles in ${subject}?`,
            [
              "You can skip all advanced topics",
              "Advanced topics become combinations of basics you already know",
              "First principles are only for researchers",
            ],
            1,
            "When you know the building blocks, advanced topics feel like familiar pieces arranged in new ways.",
          ),
        }),
      },
    ],
  },
];

const EXPANSION_TEMPLATES: Array<{
  title: string;
  description: string;
  depth: number;
  lessons: UnitTemplate["lessons"];
}> = [
  {
    title: "Going Deeper",
    description: "Intermediate concepts that build on your foundation.",
    depth: 2,
    lessons: [
      {
        title: "Hidden Assumptions",
        type: "deep-dive",
        mode: "both",
        minutes: 6,
        content: (subject) => ({
          summary: `Assumptions you didn't know you were making in ${subject}.`,
          body: `Every model in ${subject} works within limits. This lesson surfaces the assumptions that are usually left unstated — and shows you when they break down.\n\nKnowing the boundaries of a model is as important as knowing the model itself.`,
          keyPoints: [
            "All models simplify reality",
            "Assumptions define where a model applies",
            "Breaking assumptions often leads to breakthroughs",
          ],
        }),
      },
      {
        title: "Real-World Application",
        type: "concept",
        mode: "passive",
        minutes: 4,
        content: (subject) => ({
          summary: `Where ${subject} shows up outside textbooks.`,
          body: `The gap between theory and practice is where ${subject} gets interesting. This lesson bridges that gap with concrete examples from industry, research, and everyday life.`,
          keyPoints: [
            "Theory guides practice; practice refines theory",
            "Real applications often involve approximations",
            "Look for ${subject} in news and products around you",
          ],
        }),
      },
      {
        title: "Challenge Problem",
        type: "problem",
        mode: "aggressive",
        minutes: 12,
        content: (subject) => ({
          summary: `A harder problem to stretch your ${subject} skills.`,
          body: `This problem requires combining multiple ideas from your foundation. Take your time. Use previous lessons as reference. The goal is growth, not speed.`,
          keyPoints: [
            "Hard problems reveal which ideas need review",
            "Break complex problems into smaller parts",
            "Compare your approach to the solution walkthrough",
          ],
        }),
      },
    ],
  },
  {
    title: "Advanced Perspectives",
    description: "Cutting-edge ideas and open questions.",
    depth: 3,
    lessons: [
      {
        title: "Current Frontiers",
        type: "deep-dive",
        mode: "both",
        minutes: 7,
        content: (subject) => ({
          summary: `What experts are actively researching in ${subject}.`,
          body: `${subject} isn't a finished subject — active researchers are pushing boundaries right now. This lesson introduces open questions and recent developments.\n\nYou don't need to understand every detail. The goal is to see where the field is heading.`,
          keyPoints: [
            "Science and knowledge evolve continuously",
            "Open questions are invitations to contribute",
            "Stay curious about what we still don't know",
          ],
        }),
      },
      {
        title: "Mind-Bending Implications",
        type: "analogy",
        mode: "passive",
        minutes: 3,
        content: (subject) => ({
          summary: `Surprising consequences of ${subject}.`,
          body: `Some of the most memorable moments in learning come from implications that challenge intuition. ${subject} has several — ideas that seem strange at first but follow logically from what you've learned.`,
          analogy: `These implications are like plot twists in a story you thought you understood. They don't break the story — they deepen it.`,
          keyPoints: [
            "Counterintuitive results often become the most important",
            "Sit with confusion before rushing to resolve it",
            "Share these ideas — teaching clarifies them",
          ],
        }),
      },
      {
        title: "Research Spotlight",
        type: "summary",
        mode: "passive",
        minutes: 4,
        content: (subject) => ({
          summary: `A landmark idea that changed ${subject}.`,
          body: `Every field has breakthrough moments — discoveries that reshaped how people think. This lesson tells the story of one such moment in ${subject}: what came before, what changed, and why it still matters.`,
          keyPoints: [
            "Breakthroughs often come from questioning assumptions",
            "History of a field reveals why we think the way we do",
            "You can read original sources when you're ready",
          ],
        }),
      },
      {
        title: "Expert-Level Quiz",
        type: "quiz",
        mode: "aggressive",
        minutes: 8,
        content: (subject) => ({
          summary: `Test deeper understanding of ${subject}.`,
          body: `This quiz covers intermediate and advanced material. Use it to identify what to review before moving further.`,
          keyPoints: [
            "Advanced quizzes diagnose, not judge",
            "Review related lessons for missed questions",
            "Retake after reviewing — scores should improve",
          ],
          question: buildQuiz(
            `Why is it valuable to study open questions in ${subject}?`,
            [
              "Open questions mean the field is useless",
              "They show where new knowledge can be created",
              "Only PhD students should care about them",
            ],
            1,
            "Open questions mark the frontier of knowledge — they're where learners become contributors.",
          ),
        }),
      },
    ],
  },
  {
    title: "Specialized Topics",
    description: "Focused deep dives into sub-areas.",
    depth: 4,
    lessons: [
      {
        title: "Subfield Overview",
        type: "concept",
        mode: "both",
        minutes: 5,
        content: (subject) => ({
          summary: `A major sub-area within ${subject}.`,
          body: `${subject} contains specialized branches that entire careers are built on. This lesson introduces one such area: its questions, methods, and connections to the broader field.`,
          keyPoints: [
            "Specialization builds on general foundations",
            "Subfields often cross-pollinate ideas",
            "Pick specializations based on curiosity, not prestige",
          ],
        }),
      },
      {
        title: "Technical Deep Dive",
        type: "deep-dive",
        mode: "aggressive",
        minutes: 15,
        content: (subject) => ({
          summary: `Detailed exploration of a key technique in ${subject}.`,
          body: `This is a longer, more technical lesson for when you're ready to go beyond introductions. Work through it in sections if needed.`,
          keyPoints: [
            "Technical depth rewards patience",
            "Take notes and draw diagrams",
            "Revisit after completing more foundation lessons",
          ],
        }),
      },
      {
        title: "Daily Insight",
        type: "summary",
        mode: "passive",
        minutes: 2,
        content: (subject) => ({
          summary: `One powerful idea from ${subject} to carry today.`,
          body: `Passive learning isn't passive attention — it's efficient learning. This bite-sized insight is designed to stick with you through your day, connecting ${subject} to how you already think.`,
          keyPoints: [
            "One insight per day compounds",
            "Share it with someone — teaching reinforces learning",
            "Come back tomorrow for more",
          ],
        }),
      },
    ],
  },
];

function buildQuiz(
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string,
): QuizQuestion {
  return {
    id: createId("q"),
    prompt,
    options: options.map((text, i) => ({
      id: createId("opt"),
      text,
      correct: i === correctIndex,
    })),
    explanation,
  };
}

function withDefaults(content: Omit<LessonContent, "confidenceLevel" | "caveats">): LessonContent {
  return {
    confidenceLevel: "consensus",
    caveats: [
      "This is template content — add GROQ_API_KEY or GEMINI_API_KEY for subject-specific AI lessons.",
    ],
    ...content,
  };
}

function interpolate(template: string, subject: string): string {
  return template.replaceAll("{subject}", subject);
}

function buildLessons(
  unitId: string,
  pathId: string,
  templates: UnitTemplate["lessons"],
  subject: string,
  depth: number,
  startOrder: number,
): Lesson[] {
  return templates.map((template, index) => ({
    id: createId("lesson"),
    unitId,
    title: interpolate(template.title, subject),
    type: template.type,
    mode: template.mode,
    content: withDefaults(template.content(subject)),
    status: index === 0 && startOrder === 0 ? "available" : "locked",
    order: startOrder + index,
    depth,
    estimatedMinutes: template.minutes,
  }));
}

function buildUnit(
  pathId: string,
  template: UnitTemplate,
  subject: string,
  order: number,
  depth: number,
  lessonStartOrder: number,
): Unit {
  const unitId = createId("unit");
  return {
    id: unitId,
    pathId,
    title: interpolate(template.title, subject),
    description: interpolate(template.description, subject),
    order,
    depth,
    lessons: buildLessons(unitId, pathId, template.lessons, subject, depth, lessonStartOrder),
  };
}

export function generateInitialPath(subject: string, mode: LearningMode): LearningPath {
  const pathId = createId("path");
  const today = new Date().toISOString().slice(0, 10);

  let lessonOrder = 0;
  const units = FOUNDATION_UNITS.map((template, index) => {
    const unit = buildUnit(pathId, template, subject, index, 1, lessonOrder);
    lessonOrder += unit.lessons.length;
    return unit;
  });

  return {
    id: pathId,
    subject,
    mode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    units,
    expansionStatus: "expanding",
    expansionDepth: 1,
    totalXp: 0,
    streak: 1,
    lastActiveDate: today,
    lessonsCompleted: 0,
    aiGenerated: false,
  };
}

export function generateExpansionUnit(
  path: LearningPath,
  templateIndex: number,
): Unit | null {
  const template = EXPANSION_TEMPLATES[templateIndex % EXPANSION_TEMPLATES.length];
  const existingCount = path.units.length;
  const lessonOrder = path.units.reduce((sum, u) => sum + u.lessons.length, 0);

  const unit = buildUnit(
    path.id,
    {
      title: template.title,
      description: template.description,
      lessons: template.lessons,
    },
    path.subject,
    existingCount,
    template.depth,
    lessonOrder,
  );

  unit.depth = template.depth;
  return unit;
}

export function getExpansionTemplateCount(): number {
  return EXPANSION_TEMPLATES.length;
}
