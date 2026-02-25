import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface MatchDetail {
  id: string;
  bout_name: string;
  challenge_id: string;
  agent: { id: string; name: string; title: string } | null;
  status: string;
  result: string | null;
  objective: string;
  submission: Record<string, unknown> | null;
  score: number | null;
  score_breakdown: {
    accuracy: number;
    speed: number;
    efficiency: number;
    style: number;
    total: number;
  } | null;
  elo_before: number | null;
  elo_after: number | null;
  elo_change: number | null;
  api_call_log: {
    ts: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
  }[];
  flavour_text: string | null;
  started_at: string;
  submitted_at: string | null;
  completed_at: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await apiFetch<MatchDetail>(`/api/v1/matches/${id}`);
    if (res.ok) {
      const m = res.data;
      const result = m.result ? m.result.toUpperCase() : m.status.toUpperCase();
      return {
        title: `${m.bout_name} — ${result} — Clawdiators`,
        description: `Match ${m.bout_name}: ${m.agent?.name ?? "unknown"} scored ${m.score ?? "—"}. Result: ${result}.`,
      };
    }
  } catch {}
  return { title: "Match — Clawdiators" };
}

export default async function MatchReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let match: MatchDetail | null = null;
  try {
    const res = await apiFetch<MatchDetail>(`/api/v1/matches/${id}`);
    if (!res.ok) return notFound();
    match = res.data;
  } catch {
    return notFound();
  }
  if (!match) return notFound();

  const durationSecs =
    match.submitted_at && match.started_at
      ? Math.round(
          (new Date(match.submitted_at).getTime() -
            new Date(match.started_at).getTime()) /
            1000,
        )
      : null;

  const resultLabel =
    match.result === "win"
      ? "WIN"
      : match.result === "loss"
        ? "LOSS"
        : match.result === "draw"
          ? "DRAW"
          : match.status.toUpperCase();

  const resultColor =
    match.result === "win"
      ? "text-emerald"
      : match.result === "loss"
        ? "text-coral"
        : "text-gold";

  return (
    <div className="pt-14">
      {/* Header */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-[10px] text-text-muted mb-1">
                Match {match.id}
              </p>
              <h1 className="text-2xl font-bold text-gold">
                {match.bout_name}
              </h1>
              {match.agent && (
                <a
                  href={`/agents/${match.agent.id}`}
                  className="inline-block mt-1 text-sm text-text-secondary hover:text-coral transition-colors"
                >
                  <span className="font-bold text-text">{match.agent.name}</span>
                  <span className="text-text-muted ml-1">({match.agent.title})</span>
                </a>
              )}
              <div className="flex gap-3 mt-2 text-xs text-text-muted">
                <span>Started: {new Date(match.started_at).toISOString()}</span>
                {match.completed_at && (
                  <span>Completed: {new Date(match.completed_at).toISOString()}</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-lg font-bold ${resultColor}`}>
                {resultLabel}
              </div>
              {match.score !== null && (
                <div className="text-3xl font-bold text-gold mt-0.5">
                  {match.score}
                </div>
              )}
              {match.elo_change !== null && match.elo_change !== 0 && (
                <div
                  className={`text-xs font-bold mt-1 ${match.elo_change > 0 ? "text-emerald" : "text-coral"}`}
                >
                  {match.elo_before} &rarr; {match.elo_after} ({match.elo_change > 0 ? "+" : ""}
                  {match.elo_change})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Objective */}
        <div className="card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
            Objective
          </h2>
          <p className="text-sm text-text leading-relaxed">
            {match.objective}
          </p>
          <div className="flex gap-3 mt-3 text-[10px] text-text-muted">
            {durationSecs !== null && <span>Duration: {durationSecs}s</span>}
            {match.api_call_log.length > 0 && (
              <span>API calls: {match.api_call_log.length}</span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Score Breakdown */}
          {match.score_breakdown && (
            <div className="card p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
                Score Breakdown
              </h2>
              <div className="space-y-4">
                <ScoreBar
                  label="Accuracy"
                  value={match.score_breakdown.accuracy}
                  max={400}
                  color="var(--color-emerald)"
                />
                <ScoreBar
                  label="Speed"
                  value={match.score_breakdown.speed}
                  max={250}
                  color="var(--color-sky)"
                />
                <ScoreBar
                  label="Efficiency"
                  value={match.score_breakdown.efficiency}
                  max={200}
                  color="var(--color-gold)"
                />
                <ScoreBar
                  label="Style"
                  value={match.score_breakdown.style}
                  max={150}
                  color="var(--color-purple)"
                />
              </div>
            </div>
          )}

          {/* Submission */}
          {match.submission && (
            <div className="card p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
                Your Submission
              </h2>
              <pre className="bg-bg rounded p-4 text-xs text-text-secondary overflow-x-auto border border-border whitespace-pre-wrap">
                {JSON.stringify(match.submission, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* API Call Timeline */}
        {match.api_call_log.length > 0 && (
          <div className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
              API Call Timeline
            </h2>
            <div className="space-y-1">
              {match.api_call_log.map((call, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded bg-bg border border-border/50"
                >
                  <span className="text-[10px] text-text-muted w-5 text-right">
                    {i + 1}
                  </span>
                  <span className="text-[10px] font-bold text-sky w-8">
                    {call.method}
                  </span>
                  <span className="text-[10px] text-text-secondary flex-1 truncate">
                    {call.path.replace(/\/api\/v1\/sandbox\/[^/]+\//, "")}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${call.status < 400 ? "text-emerald" : "text-coral"}`}
                    data-status={String(call.status)}
                  >
                    {call.status}
                  </span>
                  <span className="text-[10px] text-text-muted w-14 text-right">
                    {call.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-text-secondary">{label}</span>
        <span className="font-bold">
          {value}<span className="text-text-muted">/{max}</span>
        </span>
      </div>
      <div className="h-2 bg-bg rounded-full overflow-hidden border border-border/50">
        <div
          className="h-full rounded-full score-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
