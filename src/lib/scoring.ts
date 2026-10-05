import type {
  AppState,
  EnergyLevel,
  FeedbackEvent,
  ScoreComponent,
  ScoredTask,
  Task,
  TaskEnergy,
} from "./types";

/**
 * Priority Score =
 *   0.30 * Eisenhower_Urgency
 * + 0.25 * Eisenhower_Importance
 * + 0.20 * Energy_Match
 * + 0.15 * Time_Fit
 * + 0.10 * Historical_Pattern
 */
export const SCORE_WEIGHTS = {
  urgency: 0.3,
  importance: 0.25,
  energy: 0.2,
  time: 0.15,
  history: 0.1,
} as const;

/** How well a task's energy demand matches the person's current energy. */
export const ENERGY_MATCH: Record<EnergyLevel, Record<TaskEnergy, number>> = {
  drained: { low: 1, medium: 0.4, high: 0.05 },
  steady: { low: 0.8, medium: 1, high: 0.5 },
  energized: { low: 0.6, medium: 0.85, high: 1 },
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "at", "with",
  "my", "me", "i", "it", "this", "that", "then", "than", "about", "into",
  "up", "out", "is", "are", "be", "do", "get", "go", "need", "have", "has",
]);

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function tokenize(...parts: Array<string | undefined>): string[] {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function taskTokens(task: Task): string[] {
  return tokenize(task.title, task.notes, task.tags.join(" "));
}

function maxSimilarity(task: Task, others: Task[]): number {
  const tokens = taskTokens(task);
  if (tokens.length === 0) return 0;
  let best = 0;
  for (const other of others) {
    best = Math.max(best, jaccard(tokens, taskTokens(other)));
  }
  return best;
}

export function isDeferredNow(task: Task, now: Date = new Date()): boolean {
  if (task.status !== "deferred" || !task.deferUntil) return false;
  return new Date(task.deferUntil).getTime() > now.getTime();
}

export function isEligible(task: Task, now: Date = new Date()): boolean {
  if (task.status === "done") return false;
  return !isDeferredNow(task, now);
}

/**
 * Learned pattern: what actually happened with comparable tasks, plus this
 * task's own defer history. 0..1, centered on 0.5 (no signal).
 */
export function historicalPattern(
  task: Task,
  tasks: Task[],
  feedback: FeedbackEvent[]
): { value: number; detail: string } {
  const completed = tasks.filter((t) => t.status === "done");
  const deferredIds = new Set(
    feedback.filter((f) => f.action === "deferred").map((f) => f.taskId)
  );
  const deferred = tasks.filter((t) => deferredIds.has(t.id) && t.id !== task.id);

  const similarDone = maxSimilarity(task, completed);
  const similarDeferred = maxSimilarity(task, deferred);
  const ownAccepts = feedback.filter(
    (f) => f.taskId === task.id && f.action === "accepted"
  ).length;

  let value = 0.5;
  value += 0.35 * similarDone;
  value -= 0.2 * similarDeferred;
  value -= Math.min(0.4, 0.12 * task.deferCount);
  value += Math.min(0.15, 0.05 * ownAccepts);
  value = clamp(value);

  const notes: string[] = [];
  if (similarDone > 0.2) notes.push("you finished similar tasks before");
  if (similarDeferred > 0.2) notes.push("similar tasks have been put off");
  if (task.deferCount > 0) notes.push(`deferred ${task.deferCount}x`);
  if (ownAccepts > 0) notes.push("you acted on this before");
  const detail =
    notes.length > 0 ? `Pattern: ${notes.join(", ")}.` : "No strong pattern yet.";

  return { value, detail };
}

export function scoreTask(
  task: Task,
  state: AppState,
  tasks: Task[],
  feedback: FeedbackEvent[]
): ScoredTask {
  const urgency = clamp(task.urgency / 5);
  const importance = clamp(task.importance / 5);
  const energy = ENERGY_MATCH[state.energy][task.energyRequired] ?? 0.5;
  const time =
    task.durationMinutes <= 0
      ? 0.5
      : state.availableMinutes <= 0
        ? 0
        : clamp(state.availableMinutes / Math.max(task.durationMinutes, 1));
  const history = historicalPattern(task, tasks, feedback);

  const breakdown: ScoreComponent[] = [
    {
      key: "urgency",
      label: "Urgency",
      weight: SCORE_WEIGHTS.urgency,
      value: urgency,
      contribution: SCORE_WEIGHTS.urgency * urgency,
      detail: `Urgency ${task.urgency}/5.`,
    },
    {
      key: "importance",
      label: "Importance",
      weight: SCORE_WEIGHTS.importance,
      value: importance,
      contribution: SCORE_WEIGHTS.importance * importance,
      detail: `Importance ${task.importance}/5.`,
    },
    {
      key: "energy",
      label: "Energy match",
      weight: SCORE_WEIGHTS.energy,
      value: energy,
      contribution: SCORE_WEIGHTS.energy * energy,
      detail: `Needs ${task.energyRequired} energy; you report feeling ${state.energy}.`,
    },
    {
      key: "time",
      label: "Time fit",
      weight: SCORE_WEIGHTS.time,
      value: time,
      contribution: SCORE_WEIGHTS.time * time,
      detail: `${task.durationMinutes}m task in a ${state.availableMinutes}m window.`,
    },
    {
      key: "history",
      label: "History",
      weight: SCORE_WEIGHTS.history,
      value: history.value,
      contribution: SCORE_WEIGHTS.history * history.value,
      detail: history.detail,
    },
  ];

  const score = round(
    breakdown.reduce((sum, component) => sum + component.contribution, 0),
    4
  );

  return { task, score, breakdown };
}

/**
 * Score and rank every unfinished task. Tasks deferred into the future sink to
 * the bottom, but stay visible so nothing feels hidden.
 */
export function scoreTasks(
  tasks: Task[],
  state: AppState,
  feedback: FeedbackEvent[],
  now: Date = new Date()
): ScoredTask[] {
  const open = tasks.filter((t) => t.status !== "done");
  return open
    .map((task) => scoreTask(task, state, tasks, feedback))
    .sort((a, b) => {
      const aDeferred = isDeferredNow(a.task, now) ? 1 : 0;
      const bDeferred = isDeferredNow(b.task, now) ? 1 : 0;
      if (aDeferred !== bDeferred) return aDeferred - bDeferred;
      return b.score - a.score;
    });
}
