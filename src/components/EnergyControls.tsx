"use client";

import { useState } from "react";
import type { AppState, EnergyLevel } from "@/lib/types";

const LEVELS: { value: EnergyLevel; label: string; hint: string }[] = [
  { value: "drained", label: "Running low", hint: "Keep it small" },
  { value: "steady", label: "Steady", hint: "Normal focus" },
  { value: "energized", label: "Energized", hint: "Ready for hard things" },
];

interface Props {
  state: AppState;
  disabled?: boolean;
  onChange: (patch: Partial<Pick<AppState, "energy" | "availableMinutes">>) => void;
}

export function EnergyControls({ state, disabled, onChange }: Props) {
  const [minutes, setMinutes] = useState(state.availableMinutes);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">How are you right now?</h2>
        <span className="text-xs text-muted">Shapes every recommendation</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {LEVELS.map((level) => {
          const active = state.energy === level.value;
          return (
            <button
              key={level.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ energy: level.value })}
              className={`rounded-xl border px-2 py-2 text-left transition ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-canvas hover:border-accent/50"
              } disabled:opacity-50`}
            >
              <span className="block text-sm font-medium">{level.label}</span>
              <span className="block text-[11px] text-muted">{level.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <label htmlFor="available-minutes" className="text-sm font-semibold">
            Time you have
          </label>
          <span className="text-sm text-muted">{minutes} min</span>
        </div>
        <input
          id="available-minutes"
          type="range"
          min={5}
          max={240}
          step={5}
          value={minutes}
          disabled={disabled}
          onChange={(event) => setMinutes(Number(event.target.value))}
          onPointerUp={() => onChange({ availableMinutes: minutes })}
          onKeyUp={() => onChange({ availableMinutes: minutes })}
          className="mt-2 w-full accent-[var(--color-accent)]"
        />
      </div>
    </section>
  );
}
