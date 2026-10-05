import { describe, expect, it } from "vitest";
import { clampTaskPatch, normalizeTaskInput, parseTaskText } from "./parse";

describe("parseTaskText", () => {
  it("detects urgency and importance words", () => {
    const parsed = parseTaskText("Urgent: pay the critical bill today");
    expect(parsed.urgency).toBe(5);
    expect(parsed.importance).toBe(5);
  });

  it("extracts durations in minutes and hours", () => {
    expect(parseTaskText("Review the doc for 45 minutes").durationMinutes).toBe(45);
    expect(parseTaskText("Clean the garage for 2 hours").durationMinutes).toBe(120);
  });

  it("infers energy demand from the verb", () => {
    expect(parseTaskText("Call the dentist").energyRequired).toBe("low");
    expect(parseTaskText("Organize the garage").energyRequired).toBe("high");
  });

  it("flags emotionally loaded tasks", () => {
    expect(parseTaskText("Call the dentist about the scary bill").emotionalWeight).toBe(4);
  });

  it("extracts hashtags as tags and strips them from the title", () => {
    const parsed = parseTaskText("Plan the trip #travel #fun");
    expect(parsed.tags).toEqual(["travel", "fun"]);
    expect(parsed.title).toBe("Plan the trip");
  });

  it("falls back to sensible defaults", () => {
    const parsed = parseTaskText("Think about the thing");
    expect(parsed.urgency).toBe(3);
    expect(parsed.importance).toBe(3);
    expect(parsed.durationMinutes).toBe(30);
  });
});

describe("normalizeTaskInput", () => {
  it("clamps out-of-range numbers and lets explicit values win", () => {
    const normalized = normalizeTaskInput({
      title: "Something urgent",
      urgency: 9,
      importance: -2,
      durationMinutes: 0,
    });
    expect(normalized.urgency).toBe(5);
    expect(normalized.importance).toBe(1);
    expect(normalized.durationMinutes).toBe(1);
  });
});

describe("clampTaskPatch", () => {
  it("does not invent a title for partial updates", () => {
    const patch = clampTaskPatch({ urgency: 4 });
    expect(patch.title).toBeUndefined();
    expect(patch.urgency).toBe(4);
  });

  it("drops blank titles", () => {
    const patch = clampTaskPatch({ title: "   " });
    expect(patch.title).toBeUndefined();
  });
});

describe("normalizeTaskInput title handling", () => {
  it("uses the cleaned title and keeps extracted tags", () => {
    const normalized = normalizeTaskInput({
      title: "Urgent: email the insurance company today #admin",
    });
    expect(normalized.title).toBe("Urgent: email the insurance company today");
    expect(normalized.tags).toEqual(["admin"]);
    expect(normalized.urgency).toBe(5);
  });
});
