/**
 * Soil Health Dashboard — Types
 *
 * Shared TypeScript types for the Socio-Ecological Soil Health Dashboard.
 * All data is synthetic demonstration data — no real-world claims.
 */

export interface MetaInfo {
  description: string;
  n_farms: number;
  n_regions: number;
  years: number[];
  regions: RegionSummary[];
  disclaimer: string;
  biophysical_indicators: string[];
  social_indicators: string[];
  outcomes: string[];
}

export interface RegionSummary {
  region_id: string;
  region_name: string;
  n_farms: number;
  mean_soc: number;
  mean_som: number;
  mean_microbial: number;
  mean_trust: number;
  mean_knowledge: number;
  mean_participation: number;
  mean_soil_health: number;
  mean_resilience: number;
  mean_adoption: number;
}

export interface FarmRecord {
  farm_id: string;
  region_id: string;
  region_name: string;
  climate: string;
  year: number;
  farmer_age: number;
  farm_size_ha: number;
  education_years: number;
  experience_years: number;

  // Biophysical
  soc_percent: number;
  som_percent: number;
  microbial_activity: number;
  soil_respiration: number;
  bulk_density: number;
  aggregate_stability: number;
  water_holding_capacity: number;
  ph: number;

  // Social drivers (0-100)
  trust_extension: number;
  farmer_knowledge: number;
  risk_perception: number;
  peer_influence: number;
  social_norms: number;
  participation_networks: number;
  access_soil_testing: number;
  access_advisory: number;

  // Management decisions
  cover_crop_adoption: boolean;
  soil_testing_frequency: number;
  organic_amendments: boolean;
  conservation_tillage: boolean;

  // Composite outcomes
  soil_health_score: number;
  adoption_readiness: number;
  farm_resilience_score: number;
}

export interface DatasetResponse {
  records: FarmRecord[];
}

export interface CorrelationResponse {
  columns: string[];
  matrix: number[][];
}

export interface RegressionResponse {
  x: string;
  y: string;
  n: number;
  slope: number;
  intercept: number;
  r2: number;
  slope_se: number;
  t_stat: number;
  p_value: number;
  slope_ci_95: [number, number];
  bootstrap_ci_95: [number, number];
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  scatter: { x: number; y: number }[];
}

export interface TrendResponse {
  indicator: string;
  group_by: "region" | "overall";
  series: Record<string, { year: number; value: number }[]>;
}

export interface SimulationResponse {
  policy: PolicyInputs;
  years: number[];
  adoption_trajectory: {
    year: number;
    adoption_likelihood: number;
    cover_crop_adoption: number;
    soil_testing_frequency: number;
    conservation_tillage: number;
  }[];
  soil_health_trajectory: {
    year: number;
    soc: number;
    som: number;
    soil_health_score: number;
    microbial_activity: number;
  }[];
  resilience_trajectory: {
    year: number;
    resilience_score: number;
    adoption_readiness: number;
  }[];
  final: {
    adoption_likelihood: number;
    soil_health_score: number;
    resilience_score: number;
    soc_change: number;
  };
}

export interface PolicyInputs {
  farmer_training_hours: number;
  extension_contact_freq: number;
  financial_incentives: number;
  soil_testing_subsidies: number;
  community_engagement: number;
  horizon_years: number;
}

// Indicator metadata for display
export const BIOPHYSICAL_INDICATORS: IndicatorMeta[] = [
  { key: "soc_percent", label: "Soil Organic Carbon", unit: "%", range: [0, 5], group: "biophysical" },
  { key: "som_percent", label: "Soil Organic Matter", unit: "%", range: [0, 9], group: "biophysical" },
  { key: "microbial_activity", label: "Microbial Activity", unit: "mg CO₂/kg/day", range: [0, 80], group: "biophysical" },
  { key: "soil_respiration", label: "Soil Respiration", unit: "mg CO₂-C/g/day", range: [0, 4.5], group: "biophysical" },
  { key: "bulk_density", label: "Bulk Density", unit: "g/cm³", range: [0.9, 1.7], group: "biophysical" },
  { key: "aggregate_stability", label: "Aggregate Stability", unit: "%", range: [0, 100], group: "biophysical" },
  { key: "water_holding_capacity", label: "Water Holding Capacity", unit: "%", range: [10, 60], group: "biophysical" },
  { key: "ph", label: "Soil pH", unit: "pH", range: [4, 9], group: "biophysical" },
];

export const SOCIAL_INDICATORS: IndicatorMeta[] = [
  { key: "trust_extension", label: "Trust in Extension", unit: "/100", range: [0, 100], group: "social" },
  { key: "farmer_knowledge", label: "Farmer Knowledge", unit: "/100", range: [0, 100], group: "social" },
  { key: "risk_perception", label: "Risk Perception", unit: "/100", range: [0, 100], group: "social" },
  { key: "peer_influence", label: "Peer Influence", unit: "/100", range: [0, 100], group: "social" },
  { key: "social_norms", label: "Social Norms", unit: "/100", range: [0, 100], group: "social" },
  { key: "participation_networks", label: "Network Participation", unit: "/100", range: [0, 100], group: "social" },
  { key: "access_soil_testing", label: "Access to Soil Testing", unit: "/100", range: [0, 100], group: "social" },
  { key: "access_advisory", label: "Access to Advisory", unit: "/100", range: [0, 100], group: "social" },
];

export const OUTCOMES: IndicatorMeta[] = [
  { key: "soil_health_score", label: "Soil Health Score", unit: "/100", range: [0, 100], group: "outcome" },
  { key: "adoption_readiness", label: "Adoption Readiness", unit: "/100", range: [0, 100], group: "outcome" },
  { key: "farm_resilience_score", label: "Farm Resilience Score", unit: "/100", range: [0, 100], group: "outcome" },
];

export interface IndicatorMeta {
  key: string;
  label: string;
  unit: string;
  range: [number, number];
  group: "biophysical" | "social" | "outcome";
}

export const ALL_INDICATORS = [...BIOPHYSICAL_INDICATORS, ...SOCIAL_INDICATORS, ...OUTCOMES];

export function getIndicatorMeta(key: string): IndicatorMeta | undefined {
  return ALL_INDICATORS.find((i) => i.key === key);
}
