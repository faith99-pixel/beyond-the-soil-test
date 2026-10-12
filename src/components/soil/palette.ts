/**
 * Shared color palette for chart series (soil + forest + earth tones).
 * Used to color regions and indicator series consistently across tabs.
 */
export const REGION_PALETTE: string[] = [
  "oklch(0.46 0.1 150)",    // forest green
  "oklch(0.6 0.13 50)",     // clay
  "oklch(0.55 0.09 80)",    // warm tan
  "oklch(0.45 0.05 130)",  // moss
  "oklch(0.42 0.06 40)",   // umber
  "oklch(0.7 0.15 85)",    // amber earth
  "oklch(0.55 0.07 165)",  // sage
  "oklch(0.45 0.1 35)",    // chestnut
  "oklch(0.65 0.12 25)",   // sienna
  "oklch(0.5 0.08 145)",   // pine
];

export const INDICATOR_PALETTE: Record<string, string> = {
  // Biophysical
  soc_percent: "oklch(0.46 0.1 150)",
  som_percent: "oklch(0.55 0.09 80)",
  microbial_activity: "oklch(0.45 0.05 130)",
  soil_respiration: "oklch(0.55 0.07 165)",
  bulk_density: "oklch(0.6 0.13 50)",
  aggregate_stability: "oklch(0.42 0.06 40)",
  water_holding_capacity: "oklch(0.5 0.08 145)",
  ph: "oklch(0.7 0.15 85)",
  // Social
  trust_extension: "oklch(0.46 0.1 150)",
  farmer_knowledge: "oklch(0.6 0.13 50)",
  risk_perception: "oklch(0.55 0.21 28)",
  peer_influence: "oklch(0.55 0.09 80)",
  social_norms: "oklch(0.45 0.05 130)",
  participation_networks: "oklch(0.7 0.15 85)",
  access_soil_testing: "oklch(0.5 0.08 145)",
  access_advisory: "oklch(0.42 0.06 40)",
  // Outcomes
  soil_health_score: "oklch(0.46 0.1 150)",
  adoption_readiness: "oklch(0.7 0.15 85)",
  farm_resilience_score: "oklch(0.55 0.09 80)",
};

export function colorFor(key: string, fallbackIndex = 0): string {
  return INDICATOR_PALETTE[key] || REGION_PALETTE[fallbackIndex % REGION_PALETTE.length];
}
