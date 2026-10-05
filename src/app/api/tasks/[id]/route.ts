import { NextResponse } from "next/server";
import { deleteTask, updateTask } from "@/lib/store";
import { clampTaskPatch } from "@/lib/parse";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: Partial<Task>;
  try {
    body = (await request.json()) as Partial<Task>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = clampTaskPatch(body);
  const task = await updateTask(id, patch);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const removed = await deleteTask(id);
  if (!removed) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
