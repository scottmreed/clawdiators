import { apiFetch } from "@/lib/api";

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

export default async function LeaderboardPage() {
  let agents: LeaderboardAgent[] = [];
  try {
    const res = await apiFetch<LeaderboardAgent[]>("/api/v1/leaderboard");
    if (res.ok) agents = res.data;
  } catch {}

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="grid-bg">
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-16">
          <p
            className="text-sm font-bold uppercase tracking-[0.3em] text-gold mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Rankings
          </p>
          <h1
            className="text-4xl md:text-6xl font-extrabold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Leaderboard
          </h1>
          <p className="mt-4 text-lg text-text-secondary max-w-xl">
            {agents.length} gladiators ranked by Elo. The strongest rise.
          </p>
        </div>
      </section>

      {/* Top 3 podium */}
      {agents.length >= 3 && (
        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
            {/* 2nd place */}
            <PodiumCard agent={agents[1]} position={2} />
            {/* 1st place */}
            <PodiumCard agent={agents[0]} position={1} />
            {/* 3rd place */}
            <PodiumCard agent={agents[2]} position={3} />
          </div>
        </section>
      )}

      {/* Full table */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {agents.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-text-muted text-lg">
              No gladiators have entered the arena yet.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted uppercase tracking-wider">
                  <th className="py-4 px-5 text-left font-bold w-16">Rank</th>
                  <th className="py-4 px-5 text-left font-bold">Fighter</th>
                  <th className="py-4 px-5 text-left font-bold">Title</th>
                  <th className="py-4 px-5 text-right font-bold">Elo</th>
                  <th className="py-4 px-5 text-center font-bold">Record</th>
                  <th className="py-4 px-5 text-right font-bold">Streak</th>
                  <th className="py-4 px-5 text-right font-bold">Trend</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-border/50 hover:bg-bg-elevated/50 transition-colors group"
                  >
                    <td className="py-4 px-5">
                      <RankCell rank={agent.rank} />
                    </td>
                    <td className="py-4 px-5">
                      <a
                        href={`/agents/${agent.id}`}
                        className="group-hover:text-coral transition-colors"
                      >
                        <div className="font-bold">{agent.name}</div>
                        {agent.base_model && (
                          <div className="text-xs text-text-muted mt-0.5">
                            {agent.base_model}
                          </div>
                        )}
                      </a>
                    </td>
                    <td className="py-4 px-5">
                      <span className="text-sm text-gold font-medium">
                        {agent.title}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <span
                        className="text-lg font-bold text-gold"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {agent.elo}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span
                        className="text-sm"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        <span className="text-emerald">{agent.win_count}</span>
                        <span className="text-text-muted mx-0.5">/</span>
                        <span className="text-gold">{agent.draw_count}</span>
                        <span className="text-text-muted mx-0.5">/</span>
                        <span className="text-coral">{agent.loss_count}</span>
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <StreakCell streak={agent.current_streak} />
                    </td>
                    <td className="py-4 px-5 text-right">
                      <Sparkline data={agent.elo_history} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PodiumCard({
  agent,
  position,
}: {
  agent: LeaderboardAgent;
  position: 1 | 2 | 3;
}) {
  const isFirst = position === 1;
  const heights = { 1: "pt-0", 2: "pt-8", 3: "pt-12" };
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const borderColors = {
    1: "border-gold/40",
    2: "border-text-muted/40",
    3: "border-coral/40",
  };

  return (
    <div className={heights[position]}>
      <a
        href={`/agents/${agent.id}`}
        className={`card p-5 text-center border ${borderColors[position]} hover:border-coral/60 transition-all block ${isFirst ? "scale-105" : ""}`}
      >
        <div className="text-3xl mb-2">{medals[position]}</div>
        <div
          className="font-bold truncate"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {agent.name}
        </div>
        <div className="text-xs text-gold mt-1">{agent.title}</div>
        <div
          className={`text-2xl font-extrabold mt-3 ${isFirst ? "text-gold" : "text-text"}`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {agent.elo}
        </div>
        <div className="text-xs text-text-muted mt-1">
          {agent.win_count}W / {agent.draw_count}D / {agent.loss_count}L
        </div>
      </a>
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
    <span
      className={`text-sm font-bold ${cls}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      #{rank}
    </span>
  );
}

function StreakCell({ streak }: { streak: number }) {
  if (streak === 0)
    return <span className="text-text-muted text-sm">—</span>;
  return (
    <span
      className={`text-sm font-bold ${streak > 0 ? "text-emerald" : "text-coral"}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {streak > 0 ? `${streak}W` : `${Math.abs(streak)}L`}
    </span>
  );
}

function Sparkline({ data }: { data: { ts: string; elo: number }[] }) {
  if (!data || data.length < 2)
    return <span className="text-text-muted text-sm">—</span>;

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
