"use client";

import { useMemo, useState } from "react";
import { parseTaskText } from "@/lib/parse";
import { useVoiceInput } from "@/lib/hooks";
import type { Task, TaskEnergy } from "@/lib/types";

interface Props {
  busy?: boolean;
  onAdd: (input: Partial<Task>) => void | Promise<void>;
}

const ENERGY_OPTIONS: { value: TaskEnergy; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 5,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          className="h-6 w-6 rounded-md border border-line text-sm leading-none hover:border-accent"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="w-6 text-center tabular-nums">{value}</span>
        <button
          type="button"
          className="h-6 w-6 rounded-md border border-line text-sm leading-none hover:border-accent"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </span>
    </label>
  );
}

export function CaptureBar({ busy, onAdd }: Props) {
  const [text, setText] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [overrides, setOverrides] = useState<Partial<Task>>({});
  const { listening, supported, start, stop } = useVoiceInput((transcript) =>
    setText(transcript)
  );

  const parsed = useMemo(() => (text.trim() ? parseTaskText(text) : null), [text]);
  const merged: Partial<Task> = { ...parsed, ...overrides };
  const title = (merged.title ?? text).trim();

  const set = (patch: Partial<Task>) => setOverrides((prev) => ({ ...prev, ...patch }));

  async function submit() {
    if (!title || busy) return;
    await onAdd({ ...merged, title });
    setText("");
    setOverrides({});
    setAdvanced(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          placeholder="What's on your mind? Type it or tap the mic."
          className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm outline-none focus:border-accent"
          aria-label="Describe a task"
        />
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={!supported}
          title={
            supported
              ? listening
                ? "Stop listening"
                : "Speak a task"
              : "Voice input isn't supported in this browser"
          }
          className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
            listening
              ? "border-warm bg-warm/10 text-warm"
              : "border-line hover:border-accent"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {listening ? "Stop" : "Mic"}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!title || busy}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {text.trim() && !listening && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
            urgency {merged.urgency}/5
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
            importance {merged.importance}/5
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
            {merged.energyRequired} energy
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
            {merged.durationMinutes} min
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
            emotional {merged.emotionalWeight}/5
          </span>
          <button
            type="button"
            onClick={() => setAdvanced((value) => !value)}
            className="ml-auto underline decoration-dotted hover:text-ink"
          >
            {advanced ? "Hide details" : "Adjust"}
          </button>
        </div>
      )}

      {advanced && text.trim() && (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-canvas p-3 sm:grid-cols-4">
          <Stepper
            label="Urgency"
            value={merged.urgency ?? 3}
            onChange={(value) => set({ urgency: value })}
          />
          <Stepper
            label="Importance"
            value={merged.importance ?? 3}
            onChange={(value) => set({ importance: value })}
          />
          <Stepper
            label="Emotional"
            value={merged.emotionalWeight ?? 2}
            onChange={(value) => set({ emotionalWeight: value })}
          />
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Minutes</span>
            <input
              type="number"
              min={1}
              max={600}
              value={merged.durationMinutes ?? 30}
              onChange={(event) => set({ durationMinutes: Number(event.target.value) })}
              className="w-full rounded-md border border-line bg-surface px-2 py-1"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs sm:col-span-4">
            <span className="font-medium">Energy needed</span>
            <select
              value={merged.energyRequired ?? "medium"}
              onChange={(event) => set({ energyRequired: event.target.value as TaskEnergy })}
              className="rounded-md border border-line bg-surface px-2 py-1"
            >
              {ENERGY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
