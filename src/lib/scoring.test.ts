import { describe, expect, it } from "vitest";
import {
  ENERGY_MATCH,
  SCORE_WEIGHTS,
  historicalPattern,
  isEligible,
  scoreTask,
  scoreTasks,
} from "./scoring";
import type { AppState, Task } from "./types";

const state: AppState = { energy: "steady", availableMinutes: 60, updatedAt: "" };

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: "Task",
    urgency: 3,
    importance: 3,
    energyRequired: "medium",
    durationMinutes: 30,
    emotionalWeight: 2,
    status: "open",
    deferCount: 0,
    deferUntil: null,
    createdAt: "",
    completedAt: null,
    tags: [],
    ...overrides,
  };
}

describe("score weights", () => {
  it("sum to exactly 1", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("scoreTask", () => {
  it("rewards urgency and importance", () => {
    const calm = makeTask({ urgency: 1, importance: 1 });
    const urgent = makeTask({ urgency: 5, importance: 5 });
    expect(scoreTask(urgent, state, [urgent], []).score).toBeGreaterThan(
      scoreTask(calm, state, [calm], []).score
    );
  });

  it("scores a high-energy task lower when drained", () => {
    const task = makeTask({ energyRequired: "high" });
    const drained = scoreTask(task, { ...state, energy: "drained" }, [task], []).score;
    const energized = scoreTask(task, { ...state, energy: "energized" }, [task], []).score;
    expect(drained).toBeLessThan(energized);
    expect(ENERGY_MATCH.drained.high).toBeLessThan(ENERGY_MATCH.energized.high);
  });

  it("penalizes tasks that don't fit the available window", () => {
    const task = makeTask({ durationMinutes: 120 });
    const short = scoreTask(task, { ...state, availableMinutes: 15 }, [task], []).breakdown.find(
      (c) => c.key === "time"
    );
    const long = scoreTask(task, { ...state, availableMinutes: 180 }, [task], []).breakdown.find(
      (c) => c.key === "time"
    );
    expect(short!.value).toBeLessThan(long!.value);
  });

  it("produces a breakdown whose contributions sum to the score", () => {
    const task = makeTask();
    const scored = scoreTask(task, state, [task], []);
    const sum = scored.breakdown.reduce((acc, c) => acc + c.contribution, 0);
    expect(sum).toBeCloseTo(scored.score, 6);
  });
});

describe("historicalPattern", () => {
  it("lowers the value each time a task is deferred", () => {
    const fresh = makeTask();
    const stale = makeTask({ deferCount: 3 });
    const freshValue = historicalPattern(fresh, [fresh], []).value;
    const staleValue = historicalPattern(stale, [stale], []).value;
    expect(staleValue).toBeLessThan(freshValue);
  });

  it("raises the value when similar tasks were completed", () => {
    const done = makeTask({
      title: "Email the insurance company",
      status: "done",
      completedAt: "2026-01-01",
    });
    const candidate = makeTask({ title: "Email the insurance company about the bill" });
    const withHistory = historicalPattern(candidate, [done, candidate], []).value;
    const noHistory = historicalPattern(candidate, [candidate], []).value;
    expect(withHistory).toBeGreaterThan(noHistory);
  });
});

describe("eligibility and ranking", () => {
  const now = new Date("2026-10-05T12:00:00Z");

  it("treats a task deferred into the future as ineligible", () => {
    const task = makeTask({
      status: "deferred",
      deferUntil: "2026-10-05T18:00:00Z",
    });
    expect(isEligible(task, now)).toBe(false);
  });

  it("treats a task whose defer time has passed as eligible", () => {
    const task = makeTask({
      status: "deferred",
      deferUntil: "2026-10-05T08:00:00Z",
    });
    expect(isEligible(task, now)).toBe(true);
  });

  it("sorts future-deferred tasks to the bottom", () => {
    const high = makeTask({ title: "Urgent", urgency: 5, importance: 5 });
    const deferred = makeTask({
      title: "Later",
      urgency: 5,
      importance: 5,
      status: "deferred",
      deferUntil: "2026-10-05T18:00:00Z",
    });
    const ranked = scoreTasks([deferred, high], state, [], now);
    expect(ranked[ranked.length - 1].task.id).toBe(deferred.id);
  });

  it("excludes completed tasks from ranking", () => {
    const open = makeTask();
    const done = makeTask({ status: "done" });
    const ranked = scoreTasks([open, done], state, [], now);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].task.id).toBe(open.id);
  });
});
