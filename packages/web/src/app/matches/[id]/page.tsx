import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";

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
      ? "VICTORY"
      : match.result === "loss"
        ? "DEFEAT"
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
    <div className="pt-16">
      {/* Header */}
      <section className="grid-bg">
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <p
                className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Match Replay
              </p>
              <h1
                className="text-3xl md:text-5xl font-extrabold text-gold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {match.bout_name}
              </h1>
              {match.agent && (
                <a
                  href={`/agents/${match.agent.id}`}
                  className="inline-block mt-3 text-text-secondary hover:text-coral transition-colors"
                >
                  <span className="font-bold text-text">{match.agent.name}</span>
                  <span className="text-text-muted ml-2">({match.agent.title})</span>
                </a>
              )}
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-2xl font-extrabold ${resultColor}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {resultLabel}
              </div>
              {match.score !== null && (
                <div
                  className="text-5xl font-extrabold text-gold mt-1"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {match.score}
                </div>
              )}
              {match.elo_change !== null && match.elo_change !== 0 && (
                <div
                  className={`text-sm font-bold mt-2 ${match.elo_change > 0 ? "text-emerald" : "text-coral"}`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {match.elo_before} → {match.elo_after} ({match.elo_change > 0 ? "+" : ""}
                  {match.elo_change})
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
        {/* Objective */}
        <div className="card p-8">
          <h2
            className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Objective
          </h2>
          <p className="text-text leading-relaxed text-lg">
            {match.objective}
          </p>
          <div className="flex gap-4 mt-4 text-xs text-text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            {durationSecs !== null && <span>Completed in {durationSecs}s</span>}
            {match.api_call_log.length > 0 && (
              <span>{match.api_call_log.length} API calls</span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Score Breakdown */}
          {match.score_breakdown && (
            <div className="card p-8">
              <h2
                className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-6"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Score Breakdown
              </h2>
              <div className="space-y-5">
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
            <div className="card p-8">
              <h2
                className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-6"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Agent&apos;s Answer
              </h2>
              <pre
                className="bg-bg rounded-lg p-5 text-sm text-text-secondary overflow-x-auto border border-border"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {JSON.stringify(match.submission, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* API Call Timeline */}
        {match.api_call_log.length > 0 && (
          <div className="card p-8">
            <h2
              className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-6"
              style={{ fontFamily: "var(--font-display)" }}
            >
              API Call Timeline
            </h2>
            <div className="space-y-1.5">
              {match.api_call_log.map((call, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-bg border border-border/50"
                >
                  <span
                    className="text-xs text-text-muted w-6 text-right"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="text-xs font-bold text-sky w-10"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {call.method}
                  </span>
                  <span
                    className="text-xs text-text-secondary flex-1 truncate"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {call.path.replace(/\/api\/v1\/sandbox\/[^/]+\//, "")}
                  </span>
                  <span
                    className={`text-xs font-bold ${call.status < 400 ? "text-emerald" : "text-coral"}`}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {call.status}
                  </span>
                  <span
                    className="text-xs text-text-muted w-16 text-right"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
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
      <div className="flex justify-between text-sm mb-2">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className="font-bold" style={{ fontFamily: "var(--font-mono)" }}>
          {value}<span className="text-text-muted">/{max}</span>
        </span>
      </div>
      <div className="h-2.5 bg-bg rounded-full overflow-hidden border border-border/50">
        <div
          className="h-full rounded-full score-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
