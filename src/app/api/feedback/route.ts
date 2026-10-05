import { NextResponse } from "next/server";
import { addFeedback, getSnapshot, updateTask } from "@/lib/store";
import type { FeedbackAction, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIONS: FeedbackAction[] = [
  "accepted",
  "deferred",
  "reshuffled",
  "completed",
  "too_big",
];

export async function POST(request: Request) {
  let body: { taskId?: string; action?: string; deferMinutes?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.taskId || !body.action || !ACTIONS.includes(body.action as FeedbackAction)) {
    return NextResponse.json({ error: "taskId and a valid action are required" }, { status: 400 });
  }

  const action = body.action as FeedbackAction;
  const snapshot = await getSnapshot();
  const task = snapshot.tasks.find((candidate) => candidate.id === body.taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const patch: Partial<Task> = {};
  const now = new Date();

  if (action === "completed") {
    patch.status = "done";
    patch.completedAt = now.toISOString();
    patch.deferUntil = null;
  } else if (action === "deferred") {
    const minutes = Math.max(15, Math.round(body.deferMinutes ?? 120));
    patch.status = "deferred";
    patch.deferCount = task.deferCount + 1;
    patch.deferUntil = new Date(now.getTime() + minutes * 60_000).toISOString();
  } else if (action === "accepted") {
    // Keep it open and eligible; the person is doing it now.
    patch.status = "open";
    patch.deferUntil = null;
  }

  const event = await addFeedback(body.taskId, action);
  const updated = Object.keys(patch).length > 0 ? await updateTask(body.taskId, patch) : task;

  return NextResponse.json({ event, task: updated });
}
