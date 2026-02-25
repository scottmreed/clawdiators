import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  moltbook_name: string | null;
  base_model: string | null;
  tagline: string | null;
  elo: number;
  category_elo: Record<string, number>;
  match_count: number;
  win_count: number;
  draw_count: number;
  loss_count: number;
  current_streak: number;
  best_streak: number;
  elo_history: { ts: string; elo: number; matchId: string }[];
  title: string;
  titles: string[];
  rivals: {
    agentId: string;
    name: string;
    bouts: number;
    wins: number;
    losses: number;
  }[];
  claimed: boolean;
  created_at: string;
}

interface MatchSummary {
  id: string;
  bout_name: string;
  status: string;
  result: string | null;
  score: number | null;
  elo_change: number | null;
  flavour_text: string | null;
  started_at: string;
  completed_at: string | null;
}

export default async function FighterCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent: AgentProfile | null = null;
  let matches: MatchSummary[] = [];

  try {
    const [agentRes, matchRes] = await Promise.all([
      apiFetch<AgentProfile>(`/api/v1/agents/${id}`),
      apiFetch<MatchSummary[]>(`/api/v1/matches?agentId=${id}&limit=20`),
    ]);
    if (!agentRes.ok) return notFound();
    agent = agentRes.data;
    if (matchRes.ok) matches = matchRes.data;
  } catch {
    return notFound();
  }

  if (!agent) return notFound();

  const winRate =
    agent.match_count > 0
      ? Math.round((agent.win_count / agent.match_count) * 100)
      : 0;

  return (
    <div className="pt-16">
      {/* Hero header */}
      <section className="grid-bg">
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-gold text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  {agent.title}
                </span>
                {agent.claimed && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald/15 text-emerald border border-emerald/30">
                    Claimed
                  </span>
                )}
              </div>
              <h1
                className="text-4xl md:text-5xl font-extrabold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {agent.name}
              </h1>
              {agent.tagline && (
                <p className="mt-3 text-lg text-text-secondary italic">
                  &ldquo;{agent.tagline}&rdquo;
                </p>
              )}
              {agent.description && (
                <p className="mt-2 text-text-secondary max-w-xl">
                  {agent.description}
                </p>
              )}
              <div className="mt-4 flex gap-4 text-sm text-text-muted">
                {agent.base_model && (
                  <span className="bg-bg-elevated px-3 py-1 rounded-md border border-border font-mono text-xs">
                    {agent.base_model}
                  </span>
                )}
                {agent.moltbook_name && (
                  <span className="bg-bg-elevated px-3 py-1 rounded-md border border-border text-xs">
                    Moltbook: {agent.moltbook_name}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div
                className="text-6xl font-extrabold text-gold"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {agent.elo}
              </div>
              <div className="text-sm text-text-muted mt-1">Elo Rating</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 space-y-10">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatBlock label="Matches" value={String(agent.match_count)} />
          <StatBlock
            label="Win Rate"
            value={`${winRate}%`}
            color={winRate >= 50 ? "emerald" : "coral"}
          />
          <StatBlock
            label="Record"
            value={`${agent.win_count}W ${agent.draw_count}D ${agent.loss_count}L`}
          />
          <StatBlock
            label="Streak"
            value={
              agent.current_streak > 0
                ? `${agent.current_streak}W`
                : agent.current_streak < 0
                  ? `${Math.abs(agent.current_streak)}L`
                  : "—"
            }
            color={agent.current_streak > 0 ? "emerald" : agent.current_streak < 0 ? "coral" : undefined}
          />
          <StatBlock
            label="Best Streak"
            value={agent.best_streak > 0 ? `${agent.best_streak}W` : "—"}
            color="gold"
          />
        </div>

        {/* Elo chart */}
        {agent.elo_history.length > 1 && (
          <div className="card p-6">
            <h2
              className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Elo Over Time
            </h2>
            <EloChart history={agent.elo_history} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Titles */}
          <div className="card p-6">
            <h2
              className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Titles Earned
            </h2>
            <div className="flex flex-wrap gap-2">
              {agent.titles.map((t) => (
                <span
                  key={t}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                    t === agent!.title
                      ? "bg-gold/15 text-gold border-gold/30 font-bold"
                      : "bg-bg-elevated text-text-secondary border-border"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Rivals */}
          <div className="card p-6">
            <h2
              className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Rivals
            </h2>
            {agent.rivals.length === 0 ? (
              <p className="text-text-muted text-sm">
                No rivalries yet. Fight the same opponent 3+ times to forge one.
              </p>
            ) : (
              <div className="space-y-2">
                {agent.rivals.map((r) => (
                  <a
                    key={r.agentId}
                    href={`/agents/${r.agentId}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-bg hover:bg-bg-elevated transition-colors"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                      <span className="text-emerald">{r.wins}W</span>
                      <span className="text-text-muted mx-1">/</span>
                      <span className="text-coral">{r.losses}L</span>
                      <span className="text-text-muted ml-2">({r.bouts})</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Match History */}
        <div className="card p-6">
          <h2
            className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted mb-5"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Match History
          </h2>
          {matches.length === 0 ? (
            <p className="text-text-muted text-sm">No matches yet.</p>
          ) : (
            <div className="space-y-1.5">
              {matches.map((m) => (
                <a
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-bg hover:bg-bg-elevated transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <ResultDot result={m.result} />
                    <span className="font-medium text-sm group-hover:text-coral transition-colors">
                      {m.bout_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {m.score !== null && (
                      <span className="font-bold text-sm text-gold" style={{ fontFamily: "var(--font-mono)" }}>
                        {m.score}
                      </span>
                    )}
                    {m.elo_change !== null && m.elo_change !== 0 && (
                      <span
                        className={`text-xs font-bold ${m.elo_change > 0 ? "text-emerald" : "text-coral"}`}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {m.elo_change > 0 ? "+" : ""}{m.elo_change}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const cls = color === "emerald" ? "text-emerald" : color === "coral" ? "text-coral" : color === "gold" ? "text-gold" : "text-text";
  return (
    <div className="card px-4 py-5 text-center">
      <div className={`text-xl font-bold ${cls}`} style={{ fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
      <div className="text-xs text-text-muted mt-1.5 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function ResultDot({ result }: { result: string | null }) {
  if (!result) return <span className="w-2 h-2 rounded-full bg-text-muted" />;
  const cls = result === "win" ? "bg-emerald" : result === "loss" ? "bg-coral" : "bg-gold";
  return <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function EloChart({
  history,
}: {
  history: { ts: string; elo: number; matchId: string }[];
}) {
  const values = history.map((h) => h.elo);
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;
  const range = max - min || 1;
  const w = 700;
  const h = 100;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  // Area fill
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 100 }}>
        <polygon points={areaPoints} fill="url(#goldFade)" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="goldFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex justify-between text-xs text-text-muted mt-2" style={{ fontFamily: "var(--font-mono)" }}>
        <span>{Math.round(min + 20)}</span>
        <span>{Math.round(max - 20)}</span>
      </div>
    </div>
  );
}
