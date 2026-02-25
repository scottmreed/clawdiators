// Elo system
export const ELO_DEFAULT = 1000;
export const ELO_K_NEW = 32; // K-factor for <30 matches
export const ELO_K_ESTABLISHED = 16; // K-factor for 30+ matches
export const ELO_K_THRESHOLD = 30; // matches before K drops
export const ELO_FLOOR = 100;

// Scoring
export const MAX_SCORE = 1000;
export const QUICKDRAW_TIME_LIMIT_SECS = 60;

// Scoring weights for Quickdraw
export const QUICKDRAW_WEIGHTS = {
  accuracy: 0.4,
  speed: 0.25,
  efficiency: 0.2,
  style: 0.15,
} as const;

// Scoring weights for Tool-Chain Gauntlet
export const TOOLCHAIN_WEIGHTS = {
  accuracy: 0.35,
  speed: 0.15,
  efficiency: 0.25,
  style: 0.25,
} as const;

// Scoring weights for Efficiency Race
export const EFFICIENCY_WEIGHTS = {
  accuracy: 0.3,
  speed: 0.1,
  efficiency: 0.45,
  style: 0.15,
} as const;

// Scoring weights for Cascading Failure (style = graceful failure handling)
export const CASCADING_WEIGHTS = {
  accuracy: 0.3,
  speed: 0.1,
  efficiency: 0.15,
  style: 0.45,
} as const;

// Scoring weights for Context Relay (style = handoff quality)
export const RELAY_WEIGHTS = {
  accuracy: 0.4,
  speed: 0.1,
  efficiency: 0.15,
  style: 0.35,
} as const;

// Solo calibration thresholds
export const SOLO_WIN_THRESHOLD = 700;
export const SOLO_DRAW_THRESHOLD = 400;

// API key
export const API_KEY_PREFIX = "clw_";
export const API_KEY_BYTES = 32;

// Agent name constraints
export const AGENT_NAME_MIN = 3;
export const AGENT_NAME_MAX = 40;
export const AGENT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

// Memory limits
export const MEMORY_MAX_REFLECTIONS = 20;
export const MEMORY_MAX_STRATEGIES = 10;
export const MEMORY_MAX_RIVALS = 10;

// Rivalry threshold
export const RIVALRY_BOUT_THRESHOLD = 3;

// Quickdraw sandbox API sizes
export const WEATHER_CITY_COUNT = 20;
export const STOCK_TICKER_COUNT = 10;
export const STOCK_HISTORY_DAYS = 30;
export const NEWS_TOPIC_COUNT = 5;
export const NEWS_ARTICLES_PER_TOPIC = 4;
