import {
  WEATHER_CITIES,
  WEATHER_CONDITIONS,
  STOCK_TICKERS,
  NEWS_TOPICS,
  WEATHER_CITY_COUNT,
  STOCK_TICKER_COUNT,
  STOCK_HISTORY_DAYS,
  NEWS_TOPIC_COUNT,
  NEWS_ARTICLES_PER_TOPIC,
} from "@clawdiators/shared";
import { mulberry32 } from "../../services/whimsy.js";

export interface WeatherEntry {
  city: string;
  temperature_c: number;
  condition: string;
  humidity: number;
  wind_kph: number;
}

export interface StockDay {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockEntry {
  ticker: string;
  company: string;
  history: StockDay[];
}

export interface NewsArticle {
  id: string;
  topic: string;
  headline: string;
  summary: string;
  sentiment: "positive" | "negative" | "neutral";
  published_date: string;
  mentions: string[]; // cities and tickers referenced
}

export interface QuickdrawData {
  weather: WeatherEntry[];
  stocks: StockEntry[];
  news: NewsArticle[];
  groundTruth: QuickdrawGroundTruth;
  objective: string;
}

export interface QuickdrawGroundTruth {
  target_city: string;
  target_condition: string;
  target_date: string;
  target_ticker: string;
  target_close_price: number;
  target_article_id: string;
  target_article_headline: string;
  target_sentiment: "positive" | "negative" | "neutral";
  price_change_pct: number;
}

const COMPANY_NAMES: Record<string, string> = {
  CLWX: "Clawdian Exchange Corp",
  SOLR: "Solar Reef Industries",
  DPTH: "Depth Dynamics Ltd",
  KRLL: "Krill Logistics Inc",
  REEF: "Reef Capital Holdings",
  TRNT: "Trident Technologies",
  ANCH: "Anchor Systems Group",
  BRNE: "Brine Energy Co",
  PLNK: "Plankton Analytics",
  SHEL: "Shell Corp International",
};

const OBJECTIVE_TEMPLATES = [
  "Determine which stock had the highest closing price on the day when {city} experienced {condition}. Find the news article mentioning that stock. Report the stock ticker, closing price, article headline, its sentiment, and the stock's percentage change from the previous day.",
  "On the day {city} reported {condition}, which stock closed at its highest price? Locate the news article that references this stock. Provide the ticker symbol, closing price, the article's headline, sentiment, and the stock's day-over-day percentage change.",
  "{city} experienced {condition} on a particular date. Which stock reached its peak closing price that day? Find the related news article. Report: ticker, closing price, article headline, article sentiment, and the stock's percent change from the prior trading day.",
  "Find the date when {city} had {condition}. On that date, identify the stock with the highest close. Then find the news article mentioning that stock. Return the ticker, closing price, article headline, sentiment, and the stock's daily percentage change.",
];

/**
 * Generate all Quickdraw data deterministically from a seed.
 */
export function generateQuickdrawData(seed: number): QuickdrawData {
  const rng = mulberry32(seed);

  // Helper
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) =>
    Math.floor(rng() * (max - min + 1)) + min;
  const randFloat = (min: number, max: number) =>
    Math.round((rng() * (max - min) + min) * 100) / 100;

  // === Weather ===
  // Assign base temperatures to create consistency (warm/cold cities)
  const cityBaseTemps = WEATHER_CITIES.slice(0, WEATHER_CITY_COUNT).map(
    (city, i) => ({
      city,
      baseTemp: 5 + (i * 30) / WEATHER_CITY_COUNT + randInt(-3, 3),
    }),
  );

  const weather: WeatherEntry[] = cityBaseTemps.map(({ city, baseTemp }) => ({
    city,
    temperature_c: Math.round(baseTemp + randInt(-2, 2)),
    condition: pick(WEATHER_CONDITIONS),
    humidity: randInt(30, 95),
    wind_kph: randInt(0, 60),
  }));

  // Pick a target city+condition for the objective
  const targetCityIdx = randInt(0, weather.length - 1);
  const targetCity = weather[targetCityIdx];

  // === Stocks ===
  // Generate base date (always "2026-01-15" shifted by seed for variety)
  const baseDate = new Date("2026-01-15");
  baseDate.setDate(baseDate.getDate() + (seed % 30));

  const stocks: StockEntry[] = STOCK_TICKERS.slice(0, STOCK_TICKER_COUNT).map(
    (ticker) => {
      const basePrice = randFloat(10, 500);
      const history: StockDay[] = [];

      let prevClose = basePrice;
      for (let d = 0; d < STOCK_HISTORY_DAYS; d++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - (STOCK_HISTORY_DAYS - 1 - d));
        const dateStr = date.toISOString().split("T")[0];

        const change = randFloat(-0.05, 0.05);
        const open = Math.round(prevClose * (1 + change / 2) * 100) / 100;
        const close =
          Math.round(prevClose * (1 + change) * 100) / 100;
        const high =
          Math.round(Math.max(open, close) * (1 + rng() * 0.02) * 100) / 100;
        const low =
          Math.round(Math.min(open, close) * (1 - rng() * 0.02) * 100) / 100;
        const volume = randInt(100000, 10000000);

        history.push({ date: dateStr, open, high, low, close, volume });
        prevClose = close;
      }

      return {
        ticker,
        company: COMPANY_NAMES[ticker] || ticker,
        history,
      };
    },
  );

  // Determine the "target date" — mapped from the target weather
  // Use a date from the middle of the stock history
  const targetDateIdx = randInt(5, STOCK_HISTORY_DAYS - 2);
  const targetDate = stocks[0].history[targetDateIdx].date;

  // Find which stock had the highest close on that date
  let highestClose = -1;
  let highestTicker = stocks[0];
  for (const stock of stocks) {
    const day = stock.history[targetDateIdx];
    if (day.close > highestClose) {
      highestClose = day.close;
      highestTicker = stock;
    }
  }

  // Calculate % change from previous day
  const prevDay = highestTicker.history[targetDateIdx - 1];
  const targetDay = highestTicker.history[targetDateIdx];
  const priceChangePct =
    Math.round(
      ((targetDay.close - prevDay.close) / prevDay.close) * 10000,
    ) / 100;

  // === News ===
  const sentiments: Array<"positive" | "negative" | "neutral"> = [
    "positive",
    "negative",
    "neutral",
  ];

  // Pre-generate article that mentions the target stock
  const targetArticleId = `art-${seed}-target`;
  const targetSentiment = pick(sentiments);

  const HEADLINES_ABOUT_STOCK = [
    `${highestTicker.company} shares surge amid market optimism`,
    `Analysts weigh in on ${highestTicker.ticker}'s recent performance`,
    `${highestTicker.company} reports quarterly results, ${highestTicker.ticker} reacts`,
    `Market watch: ${highestTicker.ticker} leads sector in trading volume`,
    `Investors eye ${highestTicker.company} after ${targetCity.city} developments`,
  ];

  const SUMMARIES_ABOUT_STOCK = [
    `${highestTicker.company} (${highestTicker.ticker}) saw significant trading activity following developments in ${targetCity.city}. Analysts noted the stock's performance relative to sector peers.`,
    `Trading in ${highestTicker.ticker} intensified as market participants reacted to economic indicators from the ${targetCity.city} region. The stock's movement was closely watched.`,
    `${highestTicker.company}'s ${highestTicker.ticker} shares were among the most active, with connections drawn to events in ${targetCity.city} impacting sector sentiment.`,
  ];

  const news: NewsArticle[] = [];

  // Generate regular articles for each topic
  const topics = NEWS_TOPICS.slice(0, NEWS_TOPIC_COUNT);
  for (const topic of topics) {
    const articleCount = NEWS_ARTICLES_PER_TOPIC;
    for (let a = 0; a < articleCount; a++) {
      const artId = `art-${seed}-${topic.replace(/\s/g, "")}-${a}`;
      const mentionedCity = pick(weather).city;
      const mentionedTicker = pick(stocks).ticker;

      news.push({
        id: artId,
        topic,
        headline: `${topic}: ${mentionedCity} developments impact ${mentionedTicker}`,
        summary: `Recent events in ${mentionedCity} have implications for ${mentionedTicker} and the broader ${topic.toLowerCase()} sector. Experts suggest monitoring the situation closely.`,
        sentiment: pick(sentiments),
        published_date: targetDate,
        mentions: [mentionedCity, mentionedTicker],
      });
    }
  }

  // Insert the target article (the one agents need to find)
  const targetArticle: NewsArticle = {
    id: targetArticleId,
    topic: pick(topics),
    headline: pick(HEADLINES_ABOUT_STOCK),
    summary: pick(SUMMARIES_ABOUT_STOCK),
    sentiment: targetSentiment,
    published_date: targetDate,
    mentions: [targetCity.city, highestTicker.ticker],
  };
  // Insert at a random position
  const insertIdx = randInt(0, news.length);
  news.splice(insertIdx, 0, targetArticle);

  // Build objective
  const template = OBJECTIVE_TEMPLATES[seed % OBJECTIVE_TEMPLATES.length];
  const objective = template
    .replace("{city}", targetCity.city)
    .replace("{condition}", targetCity.condition);

  return {
    weather,
    stocks,
    news,
    groundTruth: {
      target_city: targetCity.city,
      target_condition: targetCity.condition,
      target_date: targetDate,
      target_ticker: highestTicker.ticker,
      target_close_price: highestClose,
      target_article_id: targetArticleId,
      target_article_headline: targetArticle.headline,
      target_sentiment: targetSentiment,
      price_change_pct: priceChangePct,
    },
    objective,
  };
}
