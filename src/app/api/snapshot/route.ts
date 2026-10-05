import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store";
import { rankTasks } from "@/lib/recommend";
import { llmAvailable, llmConfig } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  const ranked = rankTasks(snapshot);
  return NextResponse.json({
    ...snapshot,
    ranked: ranked.map((entry) => ({ id: entry.task.id, score: entry.score })),
    llm: {
      enabled: llmConfig.disabled ? false : await llmAvailable(),
      model: llmConfig.model,
    },
  });
}
