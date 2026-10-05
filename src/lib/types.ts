export type EnergyLevel = "drained" | "steady" | "energized";

export type TaskEnergy = "low" | "medium" | "high";

export type TaskStatus = "open" | "done" | "deferred";

export type FeedbackAction =
  | "accepted"
  | "deferred"
  | "reshuffled"
  | "completed"
  | "too_big";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** Eisenhower urgency, 1 (someday) - 5 (on fire). */
  urgency: number;
  /** Eisenhower importance, 1 (trivial) - 5 (life-changing). */
  importance: number;
  energyRequired: TaskEnergy;
  /** Estimated focus time in minutes. */
  durationMinutes: number;
  /** Emotional load, 1 (neutral) - 5 (dread-inducing). */
  emotionalWeight: number;
  status: TaskStatus;
  deferCount: number;
  deferUntil?: string | null;
  createdAt: string;
  completedAt?: string | null;
  tags: string[];
}

export interface AppState {
  energy: EnergyLevel;
  /** Minutes available in the current focus window. */
  availableMinutes: number;
  updatedAt: string;
}

export interface FeedbackEvent {
  id: string;
  taskId: string;
  action: FeedbackAction;
  at: string;
}

export interface ScoreComponent {
  key: "urgency" | "importance" | "energy" | "time" | "history";
  label: string;
  /** Weight applied to this factor (sums with the others to 1). */
  weight: number;
  /** Normalized factor value, 0..1. */
  value: number;
  /** weight * value, the points this factor added to the total. */
  contribution: number;
  detail: string;
}

export interface ScoredTask {
  task: Task;
  score: number;
  breakdown: ScoreComponent[];
}

export interface Recommendation {
  task: Task;
  score: number;
  breakdown: ScoreComponent[];
  explanation: string;
  smallestNextAction: string;
  generatedBy: "llm" | "heuristic";
}

export interface Snapshot {
  tasks: Task[];
  state: AppState;
  feedback: FeedbackEvent[];
}
