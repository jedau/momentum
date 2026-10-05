"use client";

import { ScoreBreakdown, ScoreRing } from "./scoring";
import type { FeedbackAction, Recommendation } from "@/lib/types";

interface Props {
  recommendation: Recommendation | null;
  loading: boolean;
  message?: string;
  llmEnabled: boolean;
  speaking: boolean;
  busy: boolean;
  completedToday: number;
  onAction: (action: FeedbackAction) => void;
  onReshuffle: () => void;
  onSpeak: () => void;
}

export function OneThingCard({
  recommendation,
  loading,
  message,
  llmEnabled,
  speaking,
  busy,
  completedToday,
  onAction,
  onReshuffle,
  onSpeak,
}: Props) {
  if (loading) {
    return (
      <section className="animate-pulse rounded-2xl border border-line bg-surface p-6">
        <div className="h-4 w-24 rounded bg-line" />
        <div className="mt-4 h-8 w-3/4 rounded bg-line" />
        <div className="mt-3 h-16 rounded bg-line" />
        <div className="mt-4 h-10 w-full rounded bg-line" />
      </section>
    );
  }

  if (!recommendation) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="text-sm font-semibold">Nothing to prioritize right now.</p>
        <p className="mt-1 text-sm text-muted">
          {message ?? "Add a task above, or take the break. You've earned it."}
        </p>
      </section>
    );
  }

  const { task, breakdown } = recommendation;

  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">
          The one thing
        </span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
          {llmEnabled ? "Local AI reasoning" : "Heuristic mode"}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <ScoreRing score={recommendation.score} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold leading-snug">{task.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
            <span className="rounded-full bg-canvas px-2 py-0.5">
              urgency {task.urgency}/5
            </span>
            <span className="rounded-full bg-canvas px-2 py-0.5">
              importance {task.importance}/5
            </span>
            <span className="rounded-full bg-canvas px-2 py-0.5">
              {task.energyRequired} energy
            </span>
            <span className="rounded-full bg-canvas px-2 py-0.5">
              ~{task.durationMinutes} min
            </span>
          </div>
          <button
            type="button"
            onClick={onSpeak}
            className="mt-2 text-xs text-accent underline decoration-dotted"
          >
            {speaking ? "Reading aloud..." : "Read this to me"}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="mt-4 text-sm leading-relaxed text-ink/90">
        {recommendation.explanation}
      </p>

      <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
          Smallest next action
        </span>
        <p className="mt-1 text-sm font-medium">{recommendation.smallestNextAction}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("accepted")}
          className="col-span-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:col-span-2"
        >
          I&apos;ll do this now
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("deferred")}
          className="rounded-xl border border-line px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-50"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReshuffle}
          className="rounded-xl border border-line px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-50"
        >
          Show another
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("completed")}
          className="rounded-xl border border-line px-3 py-2 text-sm font-medium text-accent transition hover:border-accent disabled:opacity-50"
        >
          Done
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("too_big")}
          className="rounded-xl border border-line px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-50"
        >
          Too big
        </button>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
          Why this one? ({Math.round(recommendation.score * 100)}% confidence)
        </summary>
        <div className="mt-3">
          <ScoreBreakdown components={breakdown} />
        </div>
      </details>

      {completedToday > 0 && !busy && (
        <p className="mt-4 text-center text-xs text-muted">
          {completedToday} done today. That&apos;s momentum.
        </p>
      )}
    </section>
  );
}
