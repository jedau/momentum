import type { AppState, Task } from "./types";

function shortTitle(title: string): string {
  const trimmed = title.trim().replace(/[.?!]+$/, "");
  return trimmed.length > 70 ? `${trimmed.slice(0, 67)}...` : trimmed;
}

/**
 * Deterministic fallback for the "smallest next action" suggestion. Kept
 * deliberately concrete: the whole point is to turn a project into a physical
 * move that takes under five minutes.
 */
export function heuristicNextAction(task: Task, state: AppState): string {
  const title = shortTitle(task.title);

  if (task.durationMinutes <= 5) {
    return `This one is tiny: set a 5-minute timer and just do "${title}" now.`;
  }

  if (state.availableMinutes < task.durationMinutes) {
    return `You only have ${state.availableMinutes} minutes, so don't try to finish. Spend 5 minutes starting "${title}" and let that be enough for now.`;
  }

  if (task.emotionalWeight >= 4) {
    return `Don't do the whole thing. Open whatever you need for "${title}", write or do one sentence's worth, then stop. Starting is the win.`;
  }

  if (task.energyRequired === "high" && state.energy === "drained") {
    return `You're running low, so shrink it: spend 2 minutes gathering what you need for "${title}", then decide whether to keep going.`;
  }

  if (task.energyRequired === "high") {
    return `Set a 10-minute timer and make the first visible move on "${title}" — clear one surface, send one message, do one rep. Stop at the bell.`;
  }

  return `Set a 5-minute timer and do the very first step of "${title}". When the timer ends, you're allowed to stop.`;
}
