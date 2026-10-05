import type { Task, TaskEnergy } from "./types";
import { clamp } from "./scoring";

export interface ParsedTaskInput {
  title: string;
  urgency: number;
  importance: number;
  energyRequired: TaskEnergy;
  durationMinutes: number;
  emotionalWeight: number;
  tags: string[];
}

const URGENT = [/\burgent\b/, /\basap\b/, /\btoday\b/, /\btonight\b/, /\bnow\b/, /\boverdue\b/, /\bdeadline\b/];
const SOON = [/\btomorrow\b/, /\bthis week\b/, /\bby friday\b/, /\bthis weekend\b/];
const LATER = [/\bsomeday\b/, /\beventually\b/, /\bnext month\b/, /\bwhen i can\b/];

const HIGH_IMPORTANCE = [/\bimportant\b/, /\bcritical\b/, /\bmust\b/, /\bessential\b/, /\bneed to\b/];
const LOW_IMPORTANCE = [/\bmaybe\b/, /\bmight\b/, /\bnice to\b/, /\boptional\b/, /\bwant to\b/];

const HIGH_ENERGY = [/\bclean\b/, /\borganize\b/, /\bgarage\b/, /\bexercise\b/, /\bgym\b/, /\bworkout\b/, /\bmove\b/, /\blift\b/, /\berrands?\b/, /\byard\b/, /\bpack\b/, /\bpaint\b/];
const LOW_ENERGY = [/\bcall\b/, /\bemail\b/, /\bread\b/, /\breview\b/, /\bpay\b/, /\bschedule\b/, /\bbook\b/, /\bthink\b/, /\bplan\b/, /\breply\b/, /\btext\b/];

const EMOTIONAL = [/\bdread\b/, /\bscary\b/, /\bawkward\b/, /\bconfront\b/, /\bdifficult\b/, /\bhard conversation\b/, /\btaxes\b/, /\bdentist\b/, /\bdoctor\b/, /\bmedical\b/, /\binsurance\b/, /\bbills?\b/];

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function parseDurationMinutes(text: string): number | null {
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hours) return Math.round(parseFloat(hours[1]) * 60);
  const minutes = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (minutes) return parseInt(minutes[1], 10);
  if (/\bhalf an hour\b/.test(text)) return 30;
  if (/\ban hour\b/.test(text)) return 60;
  return null;
}

/**
 * Cheap natural-language pass so voice/text capture doesn't require a form.
 * The LLM parser (when Ollama is available) refines this, but the app is fully
 * usable without any model.
 */
export function parseTaskText(raw: string): ParsedTaskInput {
  const text = raw.trim();
  const lower = text.toLowerCase();

  const tags = Array.from(text.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((m) =>
    m[1].toLowerCase()
  );
  const title = text
    .replace(/#[\p{L}\p{N}_-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  let urgency = 3;
  if (matches(lower, URGENT)) urgency = 5;
  else if (matches(lower, SOON)) urgency = 4;
  else if (matches(lower, LATER)) urgency = 1;

  let importance = 3;
  if (matches(lower, HIGH_IMPORTANCE)) importance = 5;
  else if (matches(lower, LOW_IMPORTANCE)) importance = 2;

  const emotionalWeight = matches(lower, EMOTIONAL) ? 4 : 2;

  let energyRequired: TaskEnergy = "medium";
  if (matches(lower, HIGH_ENERGY)) energyRequired = "high";
  else if (matches(lower, LOW_ENERGY)) energyRequired = "low";

  const durationMinutes = parseDurationMinutes(lower) ?? 30;

  return {
    title: title || "Untitled task",
    urgency,
    importance,
    energyRequired,
    durationMinutes,
    emotionalWeight,
    tags,
  };
}

export function normalizeTaskInput(input: Partial<Task>): Partial<Task> {
  const parsed = input.title ? parseTaskText(input.title) : null;
  const result: Partial<Task> = { ...parsed, ...stripUndefined(input) };
  // Prefer the cleaned title from the parser (it strips #tags and whitespace).
  if (parsed) result.title = parsed.title;
  if (!result.title) result.title = "Untitled task";
  if (result.urgency !== undefined) result.urgency = clamp(Math.round(result.urgency), 1, 5);
  if (result.importance !== undefined)
    result.importance = clamp(Math.round(result.importance), 1, 5);
  if (result.emotionalWeight !== undefined)
    result.emotionalWeight = clamp(Math.round(result.emotionalWeight), 1, 5);
  if (result.durationMinutes !== undefined)
    result.durationMinutes = Math.max(1, Math.round(result.durationMinutes));
  if (!result.tags) result.tags = parsed?.tags ?? [];
  return result;
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as T;
}

/** Validate an update without re-parsing or overwriting fields not provided. */
export function clampTaskPatch(input: Partial<Task>): Partial<Task> {
  const result: Partial<Task> = stripUndefined(input);
  if (typeof result.title === "string") {
    const title = result.title.trim();
    if (title) result.title = title;
    else delete result.title;
  }
  if (result.urgency !== undefined)
    result.urgency = clamp(Math.round(result.urgency), 1, 5);
  if (result.importance !== undefined)
    result.importance = clamp(Math.round(result.importance), 1, 5);
  if (result.emotionalWeight !== undefined)
    result.emotionalWeight = clamp(Math.round(result.emotionalWeight), 1, 5);
  if (result.durationMinutes !== undefined)
    result.durationMinutes = Math.max(1, Math.round(result.durationMinutes));
  if (result.deferCount !== undefined)
    result.deferCount = Math.max(0, Math.round(result.deferCount));
  return result;
}
