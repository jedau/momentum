import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AppState,
  FeedbackAction,
  FeedbackEvent,
  Snapshot,
  Task,
} from "./types";

const DATA_DIR =
  process.env.MOMENTUM_DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "momentum.json");

const DEFAULT_STATE: AppState = {
  energy: "steady",
  availableMinutes: 30,
  updatedAt: new Date(0).toISOString(),
};

function emptySnapshot(): Snapshot {
  return { tasks: [], state: { ...DEFAULT_STATE }, feedback: [] };
}

let writeQueue: Promise<unknown> = Promise.resolve();

/** Serialize writes so two requests can't clobber the same JSON file. */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readRaw(): Promise<Snapshot> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      state: { ...DEFAULT_STATE, ...(parsed.state ?? {}) },
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptySnapshot();
    throw error;
  }
}

async function writeRaw(snapshot: Snapshot): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

export async function getSnapshot(): Promise<Snapshot> {
  return readRaw();
}

export async function setState(
  patch: Partial<Pick<AppState, "energy" | "availableMinutes">>
): Promise<AppState> {
  return withLock(async () => {
    const snapshot = await readRaw();
    snapshot.state = {
      ...snapshot.state,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await writeRaw(snapshot);
    return snapshot.state;
  });
}

export async function createTask(input: Partial<Task>): Promise<Task> {
  return withLock(async () => {
    const snapshot = await readRaw();
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title?.trim() || "Untitled task",
      notes: input.notes,
      urgency: input.urgency ?? 3,
      importance: input.importance ?? 3,
      energyRequired: input.energyRequired ?? "medium",
      durationMinutes: input.durationMinutes ?? 30,
      emotionalWeight: input.emotionalWeight ?? 2,
      status: "open",
      deferCount: 0,
      deferUntil: null,
      createdAt: now,
      completedAt: null,
      tags: input.tags ?? [],
    };
    snapshot.tasks.push(task);
    await writeRaw(snapshot);
    return task;
  });
}

export async function updateTask(
  id: string,
  patch: Partial<Task>
): Promise<Task | null> {
  return withLock(async () => {
    const snapshot = await readRaw();
    const index = snapshot.tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;
    const next: Task = { ...snapshot.tasks[index], ...patch, id };
    snapshot.tasks[index] = next;
    await writeRaw(snapshot);
    return next;
  });
}

export async function deleteTask(id: string): Promise<boolean> {
  return withLock(async () => {
    const snapshot = await readRaw();
    const before = snapshot.tasks.length;
    snapshot.tasks = snapshot.tasks.filter((task) => task.id !== id);
    await writeRaw(snapshot);
    return snapshot.tasks.length < before;
  });
}

export async function addFeedback(
  taskId: string,
  action: FeedbackAction
): Promise<FeedbackEvent> {
  return withLock(async () => {
    const snapshot = await readRaw();
    const event: FeedbackEvent = {
      id: randomUUID(),
      taskId,
      action,
      at: new Date().toISOString(),
    };
    snapshot.feedback.push(event);
    await writeRaw(snapshot);
    return event;
  });
}
