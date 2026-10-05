import { NextResponse } from "next/server";
import { setState } from "@/lib/store";
import type { EnergyLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const ENERGY_LEVELS: EnergyLevel[] = ["drained", "steady", "energized"];

export async function POST(request: Request) {
  let body: { energy?: string; availableMinutes?: number };
  try {
    body = (await request.json()) as { energy?: string; availableMinutes?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { energy?: EnergyLevel; availableMinutes?: number } = {};

  if (body.energy !== undefined) {
    if (!ENERGY_LEVELS.includes(body.energy as EnergyLevel)) {
      return NextResponse.json({ error: "Invalid energy level" }, { status: 400 });
    }
    patch.energy = body.energy as EnergyLevel;
  }

  if (body.availableMinutes !== undefined) {
    const minutes = Number(body.availableMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) {
      return NextResponse.json({ error: "Invalid availableMinutes" }, { status: 400 });
    }
    patch.availableMinutes = Math.min(600, Math.round(minutes));
  }

  const state = await setState(patch);
  return NextResponse.json({ state });
}
