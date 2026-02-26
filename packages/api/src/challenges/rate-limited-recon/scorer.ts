import { MAX_SCORE } from "@clawdiators/shared";
import type { ScoringInput, ScoreResult } from "../types.js";
import type { ReconGroundTruth } from "./data.js";

const WEIGHTS = { completeness: 0.4, speed: 0.2, efficiency: 0.25, planning: 0.15 };
const TIME_LIMIT = 180;
const POINTS_PER_TARGET = 334; // 334 * 3 = 1002, clamped to 1000

export function scoreRecon(input: ScoringInput): ScoreResult {
  const { submission, groundTruth: gt, startedAt, submittedAt, apiCallCount } = input;
  const groundTruth = gt as unknown as ReconGroundTruth;

  // === Completeness (0-1000 raw) ===
  // Per target: name=67, property_count=67, total_property_value=67, vehicle_count=66, plates_correct=67 = 334
  let completenessRaw = 0;

  const dossiers = (submission.dossiers ?? []) as Array<Record<string, unknown>>;

  for (const target of groundTruth.targets) {
    const dossier = dossiers.find(
      (d) => d.citizen_id === target.citizen_id,
    );
    if (!dossier) continue;

    // Name match
    if (
      typeof dossier.name === "string" &&
      dossier.name.toLowerCase().trim() === target.name.toLowerCase().trim()
    ) {
      completenessRaw += 67;
    }

    // Property count match
    const submittedProps = Array.isArray(dossier.properties) ? dossier.properties : [];
    if (submittedProps.length === target.properties.length) {
      completenessRaw += 67;
    }

    // Total property value match (allow 1% tolerance for rounding)
    const submittedValue = typeof dossier.total_property_value === "number"
      ? dossier.total_property_value
      : 0;
    const valueDiff = Math.abs(submittedValue - target.total_property_value);
    const tolerance = target.total_property_value * 0.01;
    if (valueDiff <= tolerance) {
      completenessRaw += 67;
    }

    // Vehicle count match
    const submittedVehicleCount = typeof dossier.vehicle_count === "number"
      ? dossier.vehicle_count
      : 0;
    if (submittedVehicleCount === target.vehicle_count) {
      completenessRaw += 66;
    }

    // Plates correct — check all target vehicle plates are present in submitted vehicles
    const submittedVehs = Array.isArray(dossier.vehicles) ? dossier.vehicles : [];
    const submittedPlates = new Set(
      submittedVehs
        .map((v: Record<string, unknown>) => typeof v.plate === "string" ? v.plate.toUpperCase().trim() : "")
        .filter(Boolean),
    );
    const truthPlates = target.vehicles.map((v) => v.plate.toUpperCase().trim());
    if (truthPlates.length === 0) {
      // No vehicles to match — full credit if they also submitted none
      if (submittedPlates.size === 0) completenessRaw += 67;
    } else {
      let plateMatches = 0;
      for (const plate of truthPlates) {
        if (submittedPlates.has(plate)) plateMatches++;
      }
      completenessRaw += Math.round(67 * (plateMatches / truthPlates.length));
    }
  }

  completenessRaw = Math.min(1000, completenessRaw);

  // === Speed (0-1000 raw) ===
  const elapsedSecs = (submittedAt.getTime() - startedAt.getTime()) / 1000;
  const speedRaw = elapsedSecs >= TIME_LIMIT ? 0 : Math.round(1000 * (1 - elapsedSecs / TIME_LIMIT));

  // === Efficiency (0-1000 raw) ===
  // Optimal: 3-6 calls (targets + one per API per target)
  // Good: up to 12 calls (the sum of rate limits)
  let efficiencyRaw: number;
  if (apiCallCount <= 6) efficiencyRaw = 1000;
  else if (apiCallCount <= 8) efficiencyRaw = 800;
  else if (apiCallCount <= 12) efficiencyRaw = 600;
  else if (apiCallCount <= 20) efficiencyRaw = 400;
  else efficiencyRaw = 200;

  // === Planning (0-1000 raw) ===
  // Based on rate limit violation count reported in submission
  // Sum of rate limits = 5 + 3 + 4 = 12
  // If agent stayed within limits (apiCallCount <= 12), perfect planning
  // Each call over the rate limit sum reduces planning score
  const rateLimitSum = groundTruth.rate_limits.citizens
    + groundTruth.rate_limits.properties
    + groundTruth.rate_limits.vehicles; // 12
  const rateLimitHits = typeof submission.rate_limit_hits === "number"
    ? submission.rate_limit_hits
    : Math.max(0, apiCallCount - rateLimitSum);
  const planningRaw = Math.max(0, 1000 - rateLimitHits * 100);

  // ── Weighted total ────────────────────────────────────────────────
  const completeness = Math.round(completenessRaw * WEIGHTS.completeness);
  const speed = Math.round(speedRaw * WEIGHTS.speed);
  const efficiency = Math.round(efficiencyRaw * WEIGHTS.efficiency);
  const planning = Math.round(planningRaw * WEIGHTS.planning);
  const total = Math.min(MAX_SCORE, completeness + speed + efficiency + planning);

  return { breakdown: { completeness, speed, efficiency, planning, total } };
}
