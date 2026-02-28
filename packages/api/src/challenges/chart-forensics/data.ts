import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ──────────────────────────────────────────────────────

export interface DataTable {
  id: string;
  name: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export interface ChartDescription {
  id: string;
  table_id: string;
  chart_type: "bar" | "line";
  svg: string;
  description: string;
}

export interface ChartIssue {
  chart_id: string;
  issue_type: string;
  description: string;
  affected_items: string[];
}

export interface ForensicsGroundTruth {
  issues: ChartIssue[];
  clean_charts: string[];
}

export interface ForensicsData {
  tables: DataTable[];
  charts: ChartDescription[];
  groundTruth: ForensicsGroundTruth;
  objective: string;
}

// ── Table templates ─────────────────────────────────────────────────

interface TableTemplate {
  name: string;
  columns: string[];
  categoryKey: string;
  valueKey: string;
  categories: string[];
  valueRange: [number, number];
}

const TABLE_TEMPLATES: TableTemplate[] = [
  {
    name: "Quarterly Revenue by Region",
    columns: ["region", "revenue_k"],
    categoryKey: "region",
    valueKey: "revenue_k",
    categories: ["North", "South", "East", "West", "Central", "Overseas", "Online", "Wholesale"],
    valueRange: [120, 980],
  },
  {
    name: "Species Population Count",
    columns: ["species", "count"],
    categoryKey: "species",
    valueKey: "count",
    categories: ["Clownfish", "Parrotfish", "Tang", "Angelfish", "Grouper", "Wrasse", "Damselfish", "Goby"],
    valueRange: [45, 520],
  },
  {
    name: "Monthly Energy Usage (kWh)",
    columns: ["month", "kwh"],
    categoryKey: "month",
    valueKey: "kwh",
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
    valueRange: [200, 900],
  },
  {
    name: "Student Test Scores by Subject",
    columns: ["subject", "avg_score"],
    categoryKey: "subject",
    valueKey: "avg_score",
    categories: ["Math", "Science", "English", "History", "Art", "Music", "PE", "Computing"],
    valueRange: [55, 98],
  },
  {
    name: "Warehouse Inventory (units)",
    columns: ["product", "units"],
    categoryKey: "product",
    valueKey: "units",
    categories: ["Widget-A", "Widget-B", "Gizmo-X", "Gizmo-Y", "Part-C", "Part-D", "Module-E", "Module-F"],
    valueRange: [80, 750],
  },
  {
    name: "City Rainfall (mm)",
    columns: ["city", "rainfall_mm"],
    categoryKey: "city",
    valueKey: "rainfall_mm",
    categories: ["Portland", "Seattle", "Denver", "Austin", "Miami", "Chicago", "Boston", "Phoenix"],
    valueRange: [30, 320],
  },
  {
    name: "App Downloads by Platform",
    columns: ["platform", "downloads_k"],
    categoryKey: "platform",
    valueKey: "downloads_k",
    categories: ["iOS", "Android", "Web", "Windows", "macOS", "Linux", "ChromeOS", "Other"],
    valueRange: [15, 480],
  },
  {
    name: "Crop Yield per Hectare (tonnes)",
    columns: ["crop", "yield_t"],
    categoryKey: "crop",
    valueKey: "yield_t",
    categories: ["Wheat", "Rice", "Corn", "Soybean", "Barley", "Oats", "Rye", "Millet"],
    valueRange: [2, 12],
  },
];

// ── Issue types ─────────────────────────────────────────────────────

type IssueType = "wrong_height" | "swapped_label" | "misleading_scale" | "missing_data" | "inverted_order";

const ALL_ISSUE_TYPES: IssueType[] = [
  "wrong_height",
  "swapped_label",
  "misleading_scale",
  "missing_data",
  "inverted_order",
];

// ── SVG generation ──────────────────────────────────────────────────

function generateBarSvg(
  labels: string[],
  values: number[],
  maxVal: number,
  title: string,
  yAxisStart: number = 0,
): string {
  const width = 400;
  const height = 300;
  const barWidth = 50;
  const gap = 20;
  const chartHeight = 230;
  const topPadding = 40;
  const bottomY = topPadding + chartHeight;

  let bars = "";

  // Title
  bars += `<text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">${title}</text>`;

  // Y-axis line
  bars += `<line x1="45" y1="${topPadding}" x2="45" y2="${bottomY}" stroke="#333" stroke-width="1"/>`;
  // X-axis line
  bars += `<line x1="45" y1="${bottomY}" x2="${width - 10}" y2="${bottomY}" stroke="#333" stroke-width="1"/>`;

  // Y-axis labels (5 ticks)
  const effectiveMax = maxVal - yAxisStart;
  for (let t = 0; t <= 4; t++) {
    const tickVal = yAxisStart + Math.round((effectiveMax * t) / 4);
    const tickY = bottomY - (chartHeight * t) / 4;
    bars += `<text x="40" y="${tickY + 4}" text-anchor="end" font-size="9">${tickVal}</text>`;
    bars += `<line x1="43" y1="${tickY}" x2="47" y2="${tickY}" stroke="#333" stroke-width="1"/>`;
  }

  for (let i = 0; i < labels.length; i++) {
    const barHeight = effectiveMax > 0 ? ((values[i] - yAxisStart) / effectiveMax) * chartHeight : 0;
    const clampedHeight = Math.max(0, barHeight);
    const x = 55 + i * (barWidth + gap);
    const y = bottomY - clampedHeight;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${clampedHeight}" fill="#4A90D9"/>`;
    bars += `<text x="${x + barWidth / 2}" y="${bottomY + 15}" text-anchor="middle" font-size="10">${labels[i]}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/>${bars}</svg>`;
}

function generateLineSvg(
  labels: string[],
  values: number[],
  maxVal: number,
  title: string,
  yAxisStart: number = 0,
): string {
  const width = 400;
  const height = 300;
  const gap = 50;
  const chartHeight = 230;
  const topPadding = 40;
  const bottomY = topPadding + chartHeight;
  const effectiveMax = maxVal - yAxisStart;

  let content = "";

  // Title
  content += `<text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">${title}</text>`;

  // Axes
  content += `<line x1="45" y1="${topPadding}" x2="45" y2="${bottomY}" stroke="#333" stroke-width="1"/>`;
  content += `<line x1="45" y1="${bottomY}" x2="${width - 10}" y2="${bottomY}" stroke="#333" stroke-width="1"/>`;

  // Y-axis labels
  for (let t = 0; t <= 4; t++) {
    const tickVal = yAxisStart + Math.round((effectiveMax * t) / 4);
    const tickY = bottomY - (chartHeight * t) / 4;
    content += `<text x="40" y="${tickY + 4}" text-anchor="end" font-size="9">${tickVal}</text>`;
  }

  // Points and line
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < labels.length; i++) {
    const x = 60 + i * gap;
    const ptHeight = effectiveMax > 0 ? ((values[i] - yAxisStart) / effectiveMax) * chartHeight : 0;
    const y = bottomY - Math.max(0, ptHeight);
    points.push({ x, y });
  }

  // Polyline
  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  content += `<polyline points="${polyPoints}" fill="none" stroke="#4A90D9" stroke-width="2"/>`;

  // Data points and labels
  for (let i = 0; i < labels.length; i++) {
    content += `<circle cx="${points[i].x}" cy="${points[i].y}" r="4" fill="#4A90D9"/>`;
    content += `<text x="${points[i].x}" y="${bottomY + 15}" text-anchor="middle" font-size="10">${labels[i]}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/>${content}</svg>`;
}

// ── Data generation ─────────────────────────────────────────────────

export function generateForensicsData(seed: number): ForensicsData {
  const rng = mulberry32(seed);
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  // Shuffle templates and pick 5
  const shuffledTemplates = [...TABLE_TEMPLATES];
  for (let i = shuffledTemplates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledTemplates[i], shuffledTemplates[j]] = [shuffledTemplates[j], shuffledTemplates[i]];
  }
  const selectedTemplates = shuffledTemplates.slice(0, 5);

  // Generate 5 data tables
  const tables: DataTable[] = [];
  for (let t = 0; t < 5; t++) {
    const template = selectedTemplates[t];
    const rowCount = randInt(5, 8);

    // Shuffle categories and pick rowCount
    const shuffledCats = [...template.categories];
    for (let i = shuffledCats.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledCats[i], shuffledCats[j]] = [shuffledCats[j], shuffledCats[i]];
    }
    const categories = shuffledCats.slice(0, rowCount);

    const rows: Array<Record<string, string | number>> = [];
    for (const cat of categories) {
      rows.push({
        [template.categoryKey]: cat,
        [template.valueKey]: randInt(template.valueRange[0], template.valueRange[1]),
      });
    }

    tables.push({
      id: `table-${seed}-${t + 1}`,
      name: template.name,
      columns: template.columns,
      rows,
    });
  }

  // Decide which charts will have issues (3-5 of the 5)
  const issueCount = randInt(3, 5);
  const chartIndices = [0, 1, 2, 3, 4];
  // Shuffle to pick which charts get issues
  for (let i = chartIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [chartIndices[i], chartIndices[j]] = [chartIndices[j], chartIndices[i]];
  }
  const issueChartIndices = new Set(chartIndices.slice(0, issueCount));

  // Shuffle issue types and assign to each issue chart
  const shuffledIssues = [...ALL_ISSUE_TYPES];
  for (let i = shuffledIssues.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledIssues[i], shuffledIssues[j]] = [shuffledIssues[j], shuffledIssues[i]];
  }

  const charts: ChartDescription[] = [];
  const issues: ChartIssue[] = [];
  const cleanCharts: string[] = [];

  for (let t = 0; t < 5; t++) {
    const table = tables[t];
    const template = selectedTemplates[t];
    const chartId = `chart-${seed}-${t + 1}`;
    const chartType: "bar" | "line" = rng() < 0.6 ? "bar" : "line";

    const labels = table.rows.map((r) => String(r[template.categoryKey]));
    const values = table.rows.map((r) => Number(r[template.valueKey]));
    const maxVal = Math.max(...values);

    if (issueChartIndices.has(t)) {
      // Pick an issue type for this chart
      const issueIdx = Array.from(issueChartIndices).indexOf(t);
      const issueType = shuffledIssues[issueIdx % shuffledIssues.length];

      const result = applyIssue(
        issueType, labels, values, maxVal, table.name, chartType, chartId, rng,
      );
      charts.push({
        id: chartId,
        table_id: table.id,
        chart_type: chartType,
        svg: result.svg,
        description: result.description,
      });
      issues.push(result.issue);
    } else {
      // Clean chart — faithful representation
      const svg = chartType === "bar"
        ? generateBarSvg(labels, values, maxVal, table.name)
        : generateLineSvg(labels, values, maxVal, table.name);

      charts.push({
        id: chartId,
        table_id: table.id,
        chart_type: chartType,
        svg,
        description: `${chartType === "bar" ? "Bar" : "Line"} chart showing ${table.name.toLowerCase()}. All ${labels.length} data points are represented faithfully.`,
      });
      cleanCharts.push(chartId);
    }
  }

  const objective =
    "Analyze the data tables and their corresponding SVG charts. Charts do NOT include value annotations — you must compute data values from SVG geometry (bar heights, point positions, axis scales). Some charts contain deliberate misrepresentations: subtly wrong bar heights, swapped labels, misleading y-axis scales (not starting at 0), missing data points, or inverted data order. Identify which charts have issues, the type of each issue, and which specific items are affected. Submit your findings as { issues: [{ chart_id, issue_type, description }] }. Valid issue types: wrong_height, swapped_label, misleading_scale, missing_data, inverted_order.";

  return {
    tables,
    charts,
    groundTruth: { issues, clean_charts: cleanCharts },
    objective,
  };
}

// ── Issue application ───────────────────────────────────────────────

function applyIssue(
  issueType: IssueType,
  labels: string[],
  values: number[],
  maxVal: number,
  tableName: string,
  chartType: "bar" | "line",
  chartId: string,
  rng: () => number,
): { svg: string; description: string; issue: ChartIssue } {
  const typeName = chartType === "bar" ? "Bar" : "Line";

  switch (issueType) {
    case "wrong_height": {
      // Change one bar/point's displayed height to be incorrect
      const idx = Math.floor(rng() * labels.length);
      const corruptedValues = [...values];
      // Make the value differ by 10-30% from actual (subtle)
      const factor = 0.1 + rng() * 0.2;
      const direction = rng() < 0.5 ? 1 : -1;
      const delta = Math.round(values[idx] * factor);
      corruptedValues[idx] = values[idx] + direction * delta;
      // Keep the displayed text label as the WRONG value so height matches label but not the table
      const svg = chartType === "bar"
        ? generateBarSvg(labels, corruptedValues, Math.max(maxVal, ...corruptedValues), tableName)
        : generateLineSvg(labels, corruptedValues, Math.max(maxVal, ...corruptedValues), tableName);

      return {
        svg,
        description: `${typeName} chart showing ${tableName.toLowerCase()}. All ${labels.length} categories are labeled and plotted.`,
        issue: {
          chart_id: chartId,
          issue_type: "wrong_height",
          description: `The ${chartType === "bar" ? "bar" : "data point"} for "${labels[idx]}" shows ${corruptedValues[idx]} but the table value is ${values[idx]}.`,
          affected_items: [labels[idx]],
        },
      };
    }

    case "swapped_label": {
      // Swap labels on two bars/points
      const i = Math.floor(rng() * labels.length);
      let j = Math.floor(rng() * (labels.length - 1));
      if (j >= i) j++;
      const swappedLabels = [...labels];
      [swappedLabels[i], swappedLabels[j]] = [swappedLabels[j], swappedLabels[i]];

      const svg = chartType === "bar"
        ? generateBarSvg(swappedLabels, values, maxVal, tableName)
        : generateLineSvg(swappedLabels, values, maxVal, tableName);

      return {
        svg,
        description: `${typeName} chart showing ${tableName.toLowerCase()}. Categories are labeled along the ${chartType === "bar" ? "x-axis" : "horizontal axis"}.`,
        issue: {
          chart_id: chartId,
          issue_type: "swapped_label",
          description: `Labels "${labels[i]}" and "${labels[j]}" are swapped in the chart. "${swappedLabels[i]}" appears where "${labels[i]}" should be and vice versa.`,
          affected_items: [labels[i], labels[j]],
        },
      };
    }

    case "misleading_scale": {
      // Y-axis starts at a high value instead of 0, making differences appear exaggerated
      const minVal = Math.min(...values);
      const yAxisStart = Math.round(minVal * (0.6 + rng() * 0.3)); // Start at 60-90% of minimum

      const svg = chartType === "bar"
        ? generateBarSvg(labels, values, maxVal, tableName, yAxisStart)
        : generateLineSvg(labels, values, maxVal, tableName, yAxisStart);

      return {
        svg,
        description: `${typeName} chart showing ${tableName.toLowerCase()}. Y-axis range has been selected to highlight variation.`,
        issue: {
          chart_id: chartId,
          issue_type: "misleading_scale",
          description: `Y-axis starts at ${yAxisStart} instead of 0, exaggerating the visual differences between data points.`,
          affected_items: labels.slice(), // all items are affected
        },
      };
    }

    case "missing_data": {
      // Omit one data point from the chart
      const omitIdx = Math.floor(rng() * labels.length);
      const filteredLabels = labels.filter((_, i) => i !== omitIdx);
      const filteredValues = values.filter((_, i) => i !== omitIdx);
      const filteredMax = Math.max(...filteredValues);

      const svg = chartType === "bar"
        ? generateBarSvg(filteredLabels, filteredValues, filteredMax, tableName)
        : generateLineSvg(filteredLabels, filteredValues, filteredMax, tableName);

      return {
        svg,
        description: `${typeName} chart showing ${tableName.toLowerCase()}. Data points are plotted for the categories present.`,
        issue: {
          chart_id: chartId,
          issue_type: "missing_data",
          description: `The data point for "${labels[omitIdx]}" (value: ${values[omitIdx]}) is missing from the chart. The table has ${labels.length} entries but the chart only shows ${filteredLabels.length}.`,
          affected_items: [labels[omitIdx]],
        },
      };
    }

    case "inverted_order": {
      // Values are plotted in reversed order while labels stay the same
      const reversedValues = [...values].reverse();
      const svg = chartType === "bar"
        ? generateBarSvg(labels, reversedValues, maxVal, tableName)
        : generateLineSvg(labels, reversedValues, maxVal, tableName);

      return {
        svg,
        description: `${typeName} chart showing ${tableName.toLowerCase()}. All ${labels.length} categories are represented.`,
        issue: {
          chart_id: chartId,
          issue_type: "inverted_order",
          description: `The data values are plotted in reversed order relative to the labels. "${labels[0]}" shows the value for "${labels[labels.length - 1]}" and vice versa.`,
          affected_items: labels.slice(),
        },
      };
    }
  }
}

