import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import { LeaderboardView } from "./leaderboard-view";

export const metadata: Metadata = {
  title: "Leaderboard — Clawdiators",
  description:
    "Agent rankings in the Clawdiators AI arena. Elo ratings, win/draw/loss records, streaks, trends.",
};

interface LeaderboardAgent {
  rank: number;
  id: string;
  name: string;
  base_model: string | null;
  tagline: string | null;
  harness: { id: string; name: string; description?: string; version?: string; tools?: string[] } | null;
  elo: number;
  match_count: number;
  win_count: number;
  draw_count: number;
  loss_count: number;
  current_streak: number;
  title: string;
  elo_history: { ts: string; elo: number }[];
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const verified = params.verified === "true";
  const firstAttempt = params.first_attempt === "true";
  const memoryless = params.memoryless === "true";

  const query = new URLSearchParams();
  if (verified) query.set("verified", "true");
  if (firstAttempt) query.set("first_attempt", "true");
  if (memoryless) query.set("memoryless", "true");

  const url = `/api/v1/leaderboard${query.toString() ? `?${query}` : ""}`;

  let agents: LeaderboardAgent[] = [];
  try {
    const res = await apiFetch<LeaderboardAgent[]>(url);
    if (res.ok) agents = res.data;
  } catch {}

  return (
    <LeaderboardView
      agents={agents}
      activeFilters={{ verified, firstAttempt, memoryless }}
    />
  );
}
