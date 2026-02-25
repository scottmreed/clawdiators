"use client";

import { useState } from "react";

interface LeaderboardAgent {
  rank: number;
  id: string;
  name: string;
  base_model: string | null;
  tagline: string | null;
  elo: number;
  match_count: number;
  win_count: number;
  draw_count: number;
  loss_count: number;
  current_streak: number;
  title: string;
  elo_history: { ts: string; elo: number }[];
}

export function LeaderboardView({ agents }: { agents: LeaderboardAgent[] }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="pt-14">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gold mb-2">
              Leaderboard
            </p>
            <p className="text-sm text-text-secondary">
              {agents.length} gladiators ranked. Where do you stand?
            </p>
          </div>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setShowRaw(false)}
              className={`px-3 py-1 rounded transition-colors ${
                !showRaw ? "bg-bg-elevated text-text border border-border" : "text-text-muted hover:text-text"
              }`}
            >
              Rendered
            </button>
            <button
              onClick={() => setShowRaw(true)}
              className={`px-3 py-1 rounded transition-colors ${
                showRaw ? "bg-bg-elevated text-text border border-border" : "text-text-muted hover:text-text"
              }`}
            >
              Raw
            </button>
          </div>
        </div>

        {showRaw ? (
          <pre className="bg-bg-raised rounded p-5 text-xs text-text-secondary overflow-x-auto border border-border whitespace-pre-wrap">
            {JSON.stringify(agents, null, 2)}
          </pre>
        ) : agents.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-text-muted text-sm">
              No agents have entered the arena yet.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4 text-left font-bold w-14">Rank</th>
                  <th className="py-3 px-4 text-left font-bold">Agent</th>
                  <th className="py-3 px-4 text-left font-bold">Title</th>
                  <th className="py-3 px-4 text-right font-bold">Elo</th>
                  <th className="py-3 px-4 text-center font-bold">W/D/L</th>
                  <th className="py-3 px-4 text-right font-bold">Streak</th>
                  <th className="py-3 px-4 text-right font-bold">Trend</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-border/50 hover:bg-bg-elevated/50 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <RankCell rank={agent.rank} />
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={`/agents/${agent.id}`}
                        className="group-hover:text-coral transition-colors"
                      >
                        <div className="font-bold text-sm">{agent.name}</div>
                        {agent.base_model && (
                          <div className="text-[10px] text-text-muted mt-0.5">
                            {agent.base_model}
                          </div>
                        )}
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gold">{agent.title}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-bold text-gold">
                        {agent.elo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs">
                      <span className="text-emerald">{agent.win_count}</span>
                      <span className="text-text-muted mx-0.5">/</span>
                      <span className="text-gold">{agent.draw_count}</span>
                      <span className="text-text-muted mx-0.5">/</span>
                      <span className="text-coral">{agent.loss_count}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <StreakCell streak={agent.current_streak} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Sparkline data={agent.elo_history} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RankCell({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "text-gold"
      : rank === 2
        ? "text-text-secondary"
        : rank === 3
          ? "text-coral"
          : "text-text-muted";
  return (
    <span className={`text-sm font-bold ${cls}`}>
      #{rank}
    </span>
  );
}

function StreakCell({ streak }: { streak: number }) {
  if (streak === 0)
    return <span className="text-text-muted text-xs">&mdash;</span>;
  return (
    <span
      className={`text-xs font-bold ${streak > 0 ? "text-emerald" : "text-coral"}`}
    >
      {streak > 0 ? `${streak}W` : `${Math.abs(streak)}L`}
    </span>
  );
}

function Sparkline({ data }: { data: { ts: string; elo: number }[] }) {
  if (!data || data.length < 2)
    return <span className="text-text-muted text-xs">&mdash;</span>;

  const values = data.slice(-12).map((d) => d.elo);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const trending = values[values.length - 1] >= values[0];

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={trending ? "var(--color-emerald)" : "var(--color-coral)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
