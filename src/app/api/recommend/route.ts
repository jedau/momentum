import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store";
import { buildRecommendation, rankTasks } from "@/lib/recommend";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { useLLM?: boolean; excludeTaskIds?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const snapshot = await getSnapshot();
  const recommendation = await buildRecommendation(snapshot, {
    useLLM: body.useLLM,
    excludeTaskIds: Array.isArray(body.excludeTaskIds) ? body.excludeTaskIds : [],
  });

  if (!recommendation) {
    return NextResponse.json({
      recommendation: null,
      message: "Nothing left to prioritize. Add a task or take a break.",
      ranked: [],
    });
  }

  const ranked = rankTasks(snapshot).map((entry) => ({
    id: entry.task.id,
    score: entry.score,
    title: entry.task.title,
  }));

  return NextResponse.json({ recommendation, ranked });
}
