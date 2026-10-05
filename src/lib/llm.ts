/**
 * Optional local-inference adapter (Ollama / Gemma). The app is fully
 * functional without it — every call falls back to deterministic heuristics
 * when the model is unavailable, which keeps the MVP runnable with zero infra.
 */

const BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "gemma2:2b";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 6000);
const DISABLED = process.env.MOMENTUM_DISABLE_LLM === "1";

let availability: { ok: boolean; checkedAt: number } | null = null;
const AVAILABILITY_TTL_MS = 30_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Cheap, cached probe so a missing Ollama doesn't add latency per request. */
export async function llmAvailable(): Promise<boolean> {
  if (DISABLED) return false;
  if (availability && Date.now() - availability.checkedAt < AVAILABILITY_TTL_MS) {
    return availability.ok;
  }
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/tags`, { method: "GET" });
    availability = { ok: response.ok, checkedAt: Date.now() };
  } catch {
    availability = { ok: false, checkedAt: Date.now() };
  }
  return availability.ok;
}

export async function generateText(prompt: string): Promise<string | null> {
  if (!(await llmAvailable())) return null;
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.4, num_predict: 160 },
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { response?: string };
    const text = data.response?.trim();
    return text ? text : null;
  } catch {
    return null;
  }
}

export const llmConfig = { baseUrl: BASE_URL, model: MODEL, disabled: DISABLED };
