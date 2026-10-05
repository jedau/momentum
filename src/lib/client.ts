import type {
  AppState,
  FeedbackAction,
  FeedbackEvent,
  Recommendation,
  Snapshot,
  Task,
} from "./types";

export interface RankedEntry {
  id: string;
  score: number;
  title?: string;
}

export interface SnapshotResponse extends Snapshot {
  ranked: RankedEntry[];
  llm: { enabled: boolean; model: string };
}

export interface RecommendResponse {
  recommendation: Recommendation | null;
  message?: string;
  ranked: RankedEntry[];
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const api = {
  snapshot: () => fetch("/api/snapshot", { cache: "no-store" }).then(parse<SnapshotResponse>),

  addTask: (input: Partial<Task>) =>
    fetch("/api/tasks", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }).then(parse<{ task: Task }>),

  updateTask: (id: string, patch: Partial<Task>) =>
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    }).then(parse<{ task: Task }>),

  deleteTask: (id: string) =>
    fetch(`/api/tasks/${id}`, { method: "DELETE" }).then(parse<{ ok: boolean }>),

  setState: (patch: Partial<Pick<AppState, "energy" | "availableMinutes">>) =>
    fetch("/api/state", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    }).then(parse<{ state: AppState }>),

  recommend: (body: { useLLM?: boolean; excludeTaskIds?: string[] } = {}) =>
    fetch("/api/recommend", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }).then(parse<RecommendResponse>),

  feedback: (taskId: string, action: FeedbackAction, deferMinutes?: number) =>
    fetch("/api/feedback", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ taskId, action, deferMinutes }),
    }).then(parse<{ event: FeedbackEvent; task: Task }>),
};
