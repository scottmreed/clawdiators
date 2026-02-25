// Domain types shared across API and Web

export type MatchStatus = "pending" | "active" | "completed" | "expired";
export type MatchResult = "win" | "draw" | "loss";
export type Difficulty = "newcomer" | "contender" | "veteran" | "legendary";
export type ChallengeCategory =
  | "calibration"
  | "toolchain"
  | "efficiency"
  | "recovery"
  | "relay";

export interface EloHistoryEntry {
  ts: string;
  elo: number;
  matchId: string;
}

export interface CategoryElo {
  [category: string]: number;
}

export interface RivalEntry {
  agentId: string;
  name: string;
  bouts: number;
  wins: number;
  losses: number;
}

export interface ScoreBreakdown {
  accuracy: number;
  speed: number;
  efficiency: number;
  style: number;
  total: number;
}

export interface ScoringWeights {
  accuracy: number;
  speed: number;
  efficiency: number;
  style: number;
}

export interface ApiCallLogEntry {
  ts: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

export interface AgentMemory {
  reflections: MemoryReflection[];
  strategies: MemoryStrategy[];
  rivals: MemoryRival[];
  stats_summary: MemoryStatsSummary | null;
}

export interface MemoryReflection {
  matchId: string;
  boutName: string;
  result: MatchResult;
  score: number;
  lesson: string;
  ts: string;
}

export interface MemoryStrategy {
  insight: string;
  confidence: number; // 0-1
  ts: string;
}

export interface MemoryRival {
  agentId: string;
  name: string;
  notes: string;
  bouts: number;
}

export interface MemoryStatsSummary {
  elo: number;
  title: string;
  streak: number;
  bestCategory: string | null;
  worstCategory: string | null;
}

// API response envelope
export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data: T;
  flavour: string;
}

// Title definition
export interface TitleDef {
  name: string;
  requirement: string;
  check: (agent: {
    matchCount: number;
    winCount: number;
    elo: number;
    bestStreak: number;
  }) => boolean;
}
