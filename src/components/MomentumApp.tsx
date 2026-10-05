"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type SnapshotResponse } from "@/lib/client";
import { useSpeech } from "@/lib/hooks";
import { CaptureBar } from "./CaptureBar";
import { EnergyControls } from "./EnergyControls";
import { OneThingCard } from "./OneThingCard";
import { TaskList } from "./TaskList";
import type { AppState, FeedbackAction, Recommendation, Task } from "@/lib/types";

export function MomentumApp() {
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendMessage, setRecommendMessage] = useState<string | undefined>();
  const [excludes, setExcludes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<"focus" | "all">("focus");
  const [useLLM, setUseLLM] = useState(true);
  const useLLMRef = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { speak, speaking } = useSpeech();

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    const data = await api.snapshot();
    setSnapshot(data);
    return data;
  }, []);

  const recommend = useCallback(async (excludeIds: string[]) => {
    setRecommending(true);
    try {
      const result = await api.recommend({
        useLLM: useLLMRef.current,
        excludeTaskIds: excludeIds,
      });
      setRecommendation(result.recommendation);
      setRecommendMessage(result.message);
      setExcludes(excludeIds);
    } finally {
      setRecommending(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refresh();
        if (active) await recommend([]);
      } catch (cause) {
        if (active) setError((cause as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh, recommend]);

  const handleStateChange = useCallback(
    async (patch: Partial<Pick<AppState, "energy" | "availableMinutes">>) => {
      setBusy(true);
      setError(null);
      try {
        const { state } = await api.setState(patch);
        setSnapshot((prev) => (prev ? { ...prev, state } : prev));
        await recommend([]);
      } catch (cause) {
        setError((cause as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [recommend]
  );

  const handleAdd = useCallback(
    async (input: Partial<Task>) => {
      setBusy(true);
      setError(null);
      try {
        await api.addTask(input);
        await refresh();
        await recommend([]);
        showToast("Captured. I'll factor it in.");
      } catch (cause) {
        setError((cause as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh, recommend, showToast]
  );

  const handleAction = useCallback(
    async (action: FeedbackAction) => {
      if (!recommendation) return;
      const taskId = recommendation.task.id;
      setBusy(true);
      setError(null);
      try {
        await api.feedback(taskId, action);
        if (action === "completed") {
          await refresh();
          await recommend([]);
          showToast("That counts. Momentum builds.");
        } else if (action === "deferred") {
          await refresh();
          await recommend([]);
          showToast("Deferred, no guilt. It'll come back later.");
        } else if (action === "accepted") {
          showToast("Go — just the smallest step.");
        } else if (action === "too_big") {
          const next = Array.from(new Set([...excludes, taskId]));
          await recommend(next);
          showToast("Fair. Let's look at something else.");
        }
      } catch (cause) {
        setError((cause as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [recommendation, refresh, recommend, excludes, showToast]
  );

  const handleReshuffle = useCallback(async () => {
    if (!recommendation) return;
    const taskId = recommendation.task.id;
    setBusy(true);
    setError(null);
    try {
      await api.feedback(taskId, "reshuffled");
      const next = Array.from(new Set([...excludes, taskId]));
      await recommend(next);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }, [recommendation, excludes, recommend]);

  const handleListFeedback = useCallback(
    async (taskId: string, action: FeedbackAction, message: string) => {
      setBusy(true);
      setError(null);
      try {
        await api.feedback(taskId, action);
        await refresh();
        await recommend([]);
        showToast(message);
      } catch (cause) {
        setError((cause as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh, recommend, showToast]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      setBusy(true);
      setError(null);
      try {
        await api.deleteTask(taskId);
        await refresh();
        await recommend(excludes.filter((id) => id !== taskId));
      } catch (cause) {
        setError((cause as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh, recommend, excludes]
  );

  const handleSpeak = useCallback(async () => {
    if (!recommendation) return;
    await speak(
      `${recommendation.task.title}. ${recommendation.explanation} ${recommendation.smallestNextAction}`
    );
  }, [recommendation, speak]);

  const toggleLLM = useCallback(async () => {
    const next = !useLLM;
    setUseLLM(next);
    useLLMRef.current = next;
    await recommend(excludes);
  }, [useLLM, excludes, recommend]);

  const scores = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of snapshot?.ranked ?? []) map[entry.id] = entry.score;
    return map;
  }, [snapshot]);

  const completedToday = useMemo(() => {
    if (!snapshot) return 0;
    const today = new Date().toDateString();
    return snapshot.tasks.filter(
      (task) =>
        task.status === "done" &&
        task.completedAt &&
        new Date(task.completedAt).toDateString() === today
    ).length;
  }, [snapshot]);

  const llmEnabled = Boolean(snapshot?.llm.enabled) && useLLM;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8">
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Momentum</h1>
            <p className="text-sm text-muted">
              One thing at a time. I&apos;ll pick it and tell you why.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleLLM()}
            disabled={!snapshot?.llm.enabled}
            title={
              snapshot?.llm.enabled
                ? "Toggle local model reasoning"
                : "No local model detected — using transparent heuristics"
            }
            className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-muted transition hover:border-accent disabled:opacity-60"
          >
            {llmEnabled ? "Local AI: on" : "Heuristics"}
          </button>
        </div>
      </header>

      <div className="space-y-4">
        {snapshot && (
          <EnergyControls state={snapshot.state} disabled={busy} onChange={handleStateChange} />
        )}

        <CaptureBar busy={busy} onAdd={handleAdd} />

        {error && (
          <div className="rounded-xl border border-warm/40 bg-warm/10 px-3 py-2 text-sm text-warm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          <button
            type="button"
            onClick={() => setView("focus")}
            className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
              view === "focus" ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}
          >
            Focus
          </button>
          <button
            type="button"
            onClick={() => setView("all")}
            className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
              view === "all" ? "bg-accent text-white" : "text-muted hover:text-ink"
            }`}
          >
            All tasks{snapshot ? ` (${snapshot.tasks.filter((t) => t.status !== "done").length})` : ""}
          </button>
        </div>

        {view === "focus" ? (
          <OneThingCard
            recommendation={recommendation}
            loading={!recommendation && (loading || recommending)}
            message={recommendMessage}
            llmEnabled={llmEnabled}
            speaking={speaking}
            busy={busy || recommending}
            completedToday={completedToday}
            onAction={handleAction}
            onReshuffle={handleReshuffle}
            onSpeak={handleSpeak}
          />
        ) : (
          <TaskList
            tasks={snapshot?.tasks ?? []}
            scores={scores}
            recommendedId={recommendation?.task.id}
            busy={busy}
            onComplete={(id) =>
              void handleListFeedback(id, "completed", "That counts. Momentum builds.")
            }
            onDefer={(id) =>
              void handleListFeedback(id, "deferred", "Deferred, no guilt.")
            }
            onDelete={(id) => void handleDelete(id)}
          />
        )}
      </div>

      <footer className="mt-8 text-center text-[11px] text-muted">
        Local-first by design. Your tasks stay in your own data store.
      </footer>

      {toast && (
        <div className="animate-pop fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
