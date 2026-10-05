import type { AppState, Recommendation, ScoredTask } from "./types";

const PHRASES: Record<string, (value: number, detail: string) => string> = {
  urgency: (value) =>
    value >= 0.8
      ? "it's time-sensitive"
      : value >= 0.5
        ? "it has a real deadline coming up"
        : "it isn't urgent, which is actually fine right now",
  importance: (value) =>
    value >= 0.8
      ? "it genuinely matters to you"
      : value >= 0.5
        ? "it's worth some of your attention"
        : "it's low stakes, so it can be quick",
  energy: (value) =>
    value >= 0.8
      ? "it lines up with the energy you have right now"
      : value >= 0.5
        ? "it's a workable energy match"
        : "it asks for more energy than you have right now",
  time: (value) =>
    value >= 0.8
      ? "it fits the time window you gave me"
      : value >= 0.5
        ? "it roughly fits the time you have"
        : "it's longer than your window, so we'll start it small",
  history: (value) =>
    value >= 0.6
      ? "you've followed through on similar things before"
      : value <= 0.4
        ? "you've tended to put similar things off, so this is a chance to break the pattern"
        : "there's no strong pattern either way yet",
};

function phrase(component: ScoredTask["breakdown"][number]): string {
  return (PHRASES[component.key] ?? (() => component.detail))(
    component.value,
    component.detail
  );
}

export function heuristicExplanation(scored: ScoredTask, state: AppState): string {
  const ranked = [...scored.breakdown].sort((a, b) => b.contribution - a.contribution);
  const [first, second] = ranked;
  const reasons = [phrase(first), phrase(second)].filter(Boolean);

  return [
    `I'm putting "${scored.task.title}" first because ${reasons[0]}, and ${reasons[1]}.`,
    `It needs about ${scored.task.durationMinutes} minutes, and you said you have ${state.availableMinutes}.`,
    `This is a suggestion, not a verdict — you can defer it or ask me for another.`,
  ].join(" ");
}

export function buildLlmPrompt(scored: ScoredTask, state: AppState): string {
  const { task } = scored;
  return [
    "You are a calm, warm, non-judgmental assistant helping someone with decision paralysis.",
    "Explain in 2 short sentences why this task is a good next step. No commands, no guilt, no lists.",
    `Task: ${task.title}`,
    `Urgency ${task.urgency}/5, importance ${task.importance}/5, emotional weight ${task.emotionalWeight}/5.`,
    `Energy required: ${task.energyRequired}. Estimated duration: ${task.durationMinutes} minutes.`,
    `Current energy: ${state.energy}. Available time: ${state.availableMinutes} minutes.`,
    `Top scoring factors: ${scored.breakdown
      .map((c) => `${c.label} ${(c.contribution * 100).toFixed(0)}%`)
      .join(", ")}.`,
    "Reply with only the explanation.",
  ].join("\n");
}

export function buildNextActionPrompt(scored: ScoredTask, state: AppState): string {
  const { task } = scored;
  return [
    "Given this task and the person's current energy level, what is the absolute smallest first step they could take in under 5 minutes?",
    "Be specific, physical, and encouraging. Reply with one sentence only.",
    `Task: ${task.title}`,
    `Energy required: ${task.energyRequired}. Emotional weight: ${task.emotionalWeight}/5.`,
    `Current energy: ${state.energy}. Available time: ${state.availableMinutes} minutes.`,
  ].join("\n");
}

export function withLlm(
  base: Recommendation,
  llmExplanation: string | null,
  llmNextAction: string | null
): Recommendation {
  return {
    ...base,
    explanation: llmExplanation?.trim() || base.explanation,
    smallestNextAction: llmNextAction?.trim() || base.smallestNextAction,
    generatedBy: llmExplanation || llmNextAction ? "llm" : "heuristic",
  };
}
