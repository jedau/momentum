"use client";

import type { ScoreComponent } from "@/lib/types";

export function ScoreRing({ score, size = 92 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100);
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, score)));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={7}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold">
        {pct}
        <span className="text-xs text-muted">%</span>
      </span>
    </div>
  );
}

export function ScoreBreakdown({ components }: { components: ScoreComponent[] }) {
  return (
    <ul className="space-y-2.5">
      {components.map((component) => (
        <li key={component.key}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium">{component.label}</span>
            <span className="text-muted">
              +{component.contribution.toFixed(2)} pts · {component.detail}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(component.value * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
