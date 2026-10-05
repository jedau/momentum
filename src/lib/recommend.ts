import { isEligible, scoreTasks } from "./scoring";
import { heuristicNextAction } from "./nextAction";
import {
  buildLlmPrompt,
  buildNextActionPrompt,
  heuristicExplanation,
  withLlm,
} from "./explain";
import { generateText, llmAvailable } from "./llm";
import type { Recommendation, Snapshot } from "./types";

export interface RecommendOptions {
  /** Set false to force the deterministic heuristic path. */
  useLLM?: boolean;
  /** Tasks to skip, e.g. when the person asks for another suggestion. */
  excludeTaskIds?: string[];
  now?: Date;
}

export function rankTasks(snapshot: Snapshot, now: Date = new Date()) {
  return scoreTasks(snapshot.tasks, snapshot.state, snapshot.feedback, now).filter((s) =>
    isEligible(s.task, now)
  );
}

export async function buildRecommendation(
  snapshot: Snapshot,
  options: RecommendOptions = {}
): Promise<Recommendation | null> {
  const now = options.now ?? new Date();
  const exclude = new Set(options.excludeTaskIds ?? []);
  const top = rankTasks(snapshot, now).find((s) => !exclude.has(s.task.id));
  if (!top) return null;

  const base: Recommendation = {
    task: top.task,
    score: top.score,
    breakdown: top.breakdown,
    explanation: heuristicExplanation(top, snapshot.state),
    smallestNextAction: heuristicNextAction(top.task, snapshot.state),
    generatedBy: "heuristic",
  };

  const useLLM = options.useLLM ?? true;
  if (!useLLM || !(await llmAvailable())) return base;

  const [explanation, nextAction] = await Promise.all([
    generateText(buildLlmPrompt(top, snapshot.state)),
    generateText(buildNextActionPrompt(top, snapshot.state)),
  ]);
  return withLlm(base, explanation, nextAction);
}
