import { NextResponse } from "next/server";
import { getSnapshot, createTask } from "@/lib/store";
import { normalizeTaskInput } from "@/lib/parse";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json({ tasks: snapshot.tasks });
}

export async function POST(request: Request) {
  let body: Partial<Task>;
  try {
    body = (await request.json()) as Partial<Task>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeTaskInput(body);
  if (!normalized.title || normalized.title.trim().length === 0) {
    return NextResponse.json({ error: "A title is required" }, { status: 400 });
  }

  const task = await createTask(normalized);
  return NextResponse.json({ task }, { status: 201 });
}
