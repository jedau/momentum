# Momentum

A voice-first, AI-assisted activity prioritizer for people who get stuck when
everything feels equally urgent. Instead of returning a sorted list (which is
just more overwhelm), Momentum picks **one** task, explains why, and suggests
the smallest next action.

Built for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01).

## What it does

- **Capture by voice or text** — no form required. A parser infers urgency,
  importance, energy demand, duration, and emotional weight from plain language.
- **Multi-factor scoring** — urgency, importance, energy match, time fit, and
  learned history, combined with transparent weights.
- **One Thing view** — hides everything except the current recommendation, with
  a plain-language explanation you can inspect (per-factor breakdown included).
- **Smallest next action** — turns "organize the garage" into "pick up one thing
  and decide keep / trash / donate".
- **Agency and feedback** — accept, defer, reshuffle, mark done, or flag "too
  big". Those choices feed the history factor.
- **Energy-aware** — says "running low" and high-energy tasks sink; it won't
  suggest deep work when you're drained.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

No API keys or external services are required. Task data is stored as JSON in
`./data/momentum.json`.

## Optional integrations

Everything below is opt-in. The app is fully functional without them and falls
back gracefully.

| Capability | Provider | Enable with | Fallback |
| --- | --- | --- | --- |
| Explanations + next action | Ollama (Gemma 2B and other open-weight models) | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Deterministic heuristic text |
| Recommendation voice | ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Browser `speechSynthesis` |
| Speech-to-text | Browser Web Speech API | built in | Text input |
| Persistence | Local JSON file | `MOMENTUM_DATA_DIR` | n/a |

Copy `.env.example` to `.env.local` to configure.

To use a local model:

```bash
ollama pull gemma2:2b
ollama serve
```

The model is only asked to (a) explain the recommendation warmly and (b) phrase
the smallest next action. All ranking math stays deterministic and inspectable.

## How scoring works

```
Priority Score =
  0.30 * urgency          (Eisenhower, normalized 0..1)
+ 0.25 * importance       (Eisenhower, normalized 0..1)
+ 0.20 * energy match     (task energy demand vs. current energy)
+ 0.15 * time fit         (duration vs. available window)
+ 0.10 * history          (completions and defers of similar tasks)
```

Every recommendation ships with its `breakdown`, so the score is never a black
box. Tasks deferred into the future are kept visible but ranked last until
their defer time passes.

## Architecture

```
src/
  app/
    page.tsx                 One screen, focus / all-tasks views
    api/
      snapshot/              State + ranked task scores + LLM status
      tasks/                 Create and list tasks
      tasks/[id]/            Update and delete
      state/                 Energy level and available time
      recommend/             Build the next recommendation
      feedback/              Accept / defer / reshuffle / complete / too_big
      tts/                   Optional ElevenLabs voice proxy
  components/                UI (capture, energy, one-thing, task list)
  lib/
    types.ts                 Domain types
    scoring.ts               Pure scoring engine (unit tested)
    parse.ts                 Natural-language task parsing (unit tested)
    recommend.ts             Ranking + explanation composition
    explain.ts               Heuristic and LLM prompt builders
    nextAction.ts            "Smallest next action" fallback
    store.ts                 Atomic JSON persistence
    llm.ts                   Ollama adapter with cached availability probe
    hooks.ts                 Voice input and speech output hooks
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/snapshot` | Tasks, state, feedback, ranked scores, LLM status |
| `POST` | `/api/tasks` | Create a task (plain title is enough) |
| `PATCH` / `DELETE` | `/api/tasks/:id` | Update / delete |
| `POST` | `/api/state` | Set energy and available minutes |
| `POST` | `/api/recommend` | Get the next recommendation (`excludeTaskIds` for reshuffle) |
| `POST` | `/api/feedback` | Record an action and apply its side effects |
| `POST` | `/api/tts` | ElevenLabs audio, or `204` to signal browser fallback |

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # unit tests (vitest)
```

## Deployment (Render)

Deploy as a Web Service: build `npm install && npm run build`, start
`npm run start`. Set `MOMENTUM_DATA_DIR` to a mounted persistent disk if you
want the JSON store to survive restarts, or back the `store.ts` interface with
MongoDB Atlas for multi-instance persistence.

## MVP scope and honest gaps

This MVP implements the complete prioritization loop and runs with zero
external services. Relative to the full submission, the following are
intentionally stubbed behind clean seams rather than wired to live infra:

- **MongoDB Atlas vector search** — `store.ts` is the persistence seam; history
  similarity currently uses lexical Jaccard, not embeddings.
- **Temporal durable workflows** — the flow runs inline; a workflow wrapper can
  wrap the `recommend`/`feedback` calls without touching the engine.
- **Sentry agent tracing** — prompts and timings are isolated in `llm.ts` for
  easy instrumentation.
- **Mastra orchestration** — the agent loop is expressed as explicit functions;
  it can be lifted into a Mastra agent when the extra runtime is warranted.
