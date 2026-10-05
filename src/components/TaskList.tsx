"use client";

import type { Task } from "@/lib/types";

interface Props {
  tasks: Task[];
  scores: Record<string, number>;
  recommendedId?: string;
  busy: boolean;
  onComplete: (id: string) => void;
  onDefer: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatWhen(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TaskList({
  tasks,
  scores,
  recommendedId,
  busy,
  onComplete,
  onDefer,
  onDelete,
}: Props) {
  const active = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done");

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">
          Everything on your plate ({active.length})
        </h2>
        <p className="text-xs text-muted">
          Nothing is hidden — but only one thing is the recommendation.
        </p>

        <ul className="mt-3 divide-y divide-line">
          {active.length === 0 && (
            <li className="py-4 text-sm text-muted">Nothing open. Enjoy it.</li>
          )}
          {active.map((task) => {
            const deferredUntil = task.status === "deferred" ? formatWhen(task.deferUntil) : null;
            const isRecommended = task.id === recommendedId;
            return (
              <li key={task.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{task.title}</span>
                    {isRecommended && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                        NEXT
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
                    <span>
                      score {scores[task.id] !== undefined ? Math.round(scores[task.id] * 100) : "—"}
                    </span>
                    <span>· urgency {task.urgency}/5</span>
                    <span>· importance {task.importance}/5</span>
                    <span>· {task.energyRequired} energy</span>
                    <span>· {task.durationMinutes}m</span>
                    {task.deferCount > 0 && <span>· deferred {task.deferCount}x</span>}
                    {deferredUntil && <span>· back on {deferredUntil}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onComplete(task.id)}
                    title="Mark done"
                    className="rounded-lg border border-line px-2 py-1 text-xs text-accent hover:border-accent disabled:opacity-50"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDefer(task.id)}
                    title="Defer two hours"
                    className="rounded-lg border border-line px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(task.id)}
                    title="Delete"
                    className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:border-warm hover:text-warm disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {done.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/60 p-4">
          <h2 className="text-sm font-semibold text-muted">Done ({done.length})</h2>
          <ul className="mt-2 space-y-1">
            {done.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate line-through">{task.title}</span>
                <span className="shrink-0">{formatWhen(task.completedAt) ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
