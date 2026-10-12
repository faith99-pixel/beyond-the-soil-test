/**
 * Soil API client.
 *
 * Tries the FastAPI backend service via the Next.js catch-all route
 * handler at /api/soil/[...path]. If FastAPI is unavailable, falls back
 * to client-side computation using the pre-generated JSON dataset and
 * the statistics utilities in soil-stats.ts.
 */

import type {
  CorrelationResponse,
  DatasetResponse,
  FarmRecord,
  MetaInfo,
  PolicyInputs,
  RegionSummary,
  RegressionResponse,
  SimulationResponse,
  TrendResponse,
} from "./soil-types";
import {
  BIOPHYSICAL_INDICATORS,
  SOCIAL_INDICATORS,
  OUTCOMES,
} from "./soil-types";
import {
  correlationMatrix,
  linearRegression,
  mean,
  pearson,
  quantile,
} from "./soil-stats";

// ---------------------------------------------------------------------------
// Static dataset fallback (loaded once)
// ---------------------------------------------------------------------------
let staticDataset: FarmRecord[] | null = null;
let staticMeta: MetaInfo | null = null;
let staticRegions: RegionSummary[] | null = null;

async function loadStaticDataset(): Promise<FarmRecord[]> {
  if (staticDataset) return staticDataset;
  const res = await fetch("/data/soil_dataset.json", { cache: "force-cache" });
  const json = await res.json();
  staticDataset = json.records as FarmRecord[];
  staticMeta = {
    description: json.meta.description,
    n_farms: json.meta.n_farms,
    n_regions: json.meta.n_regions,
    years: json.meta.years,
    regions: [],
    disclaimer: json.meta.disclaimer,
    biophysical_indicators: BIOPHYSICAL_INDICATORS.map((i) => i.key),
    social_indicators: SOCIAL_INDICATORS.map((i) => i.key),
    outcomes: OUTCOMES.map((i) => i.key),
  };
  // Load region summary too
  try {
    const rsum = await fetch("/data/region_summary.json", { cache: "force-cache" });
    staticRegions = (await rsum.json()) as RegionSummary[];
    staticMeta.regions = staticRegions;
  } catch {
    staticRegions = [];
  }
  return staticDataset;
}

// ---------------------------------------------------------------------------
// Backend fetch (with graceful failure → falls back to static)
// ---------------------------------------------------------------------------
async function tryBackendGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/soil/${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function tryBackendPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`/api/soil/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Client-side fallbacks
// ---------------------------------------------------------------------------
function fallbackMeta(records: FarmRecord[]): MetaInfo {
  const years = Array.from(new Set(records.map((r) => r.year))).sort();
  const regionMap = new Map<string, RegionSummary>();
  for (const r of records) {
    if (!regionMap.has(r.region_id)) {
      regionMap.set(r.region_id, {
        region_id: r.region_id,
        region_name: r.region_name,
        n_farms: 0,
        mean_soc: 0,
        mean_som: 0,
        mean_microbial: 0,
        mean_trust: 0,
        mean_knowledge: 0,
        mean_participation: 0,
        mean_soil_health: 0,
        mean_resilience: 0,
        mean_adoption: 0,
      });
    }
    const rs = regionMap.get(r.region_id)!;
    rs.n_farms = new Set(records.filter((x) => x.region_id === r.region_id).map((x) => x.farm_id)).size;
  }
  // Compute region means
  for (const rs of regionMap.values()) {
    const sub = records.filter((x) => x.region_id === rs.region_id);
    rs.mean_soc = Number(mean(sub.map((r) => r.soc_percent)).toFixed(3));
    rs.mean_som = Number(mean(sub.map((r) => r.som_percent)).toFixed(3));
    rs.mean_microbial = Number(mean(sub.map((r) => r.microbial_activity)).toFixed(2));
    rs.mean_trust = Number(mean(sub.map((r) => r.trust_extension)).toFixed(2));
    rs.mean_knowledge = Number(mean(sub.map((r) => r.farmer_knowledge)).toFixed(2));
    rs.mean_participation = Number(mean(sub.map((r) => r.participation_networks)).toFixed(2));
    rs.mean_soil_health = Number(mean(sub.map((r) => r.soil_health_score)).toFixed(2));
    rs.mean_resilience = Number(mean(sub.map((r) => r.farm_resilience_score)).toFixed(2));
    rs.mean_adoption = Number(mean(sub.map((r) => r.adoption_readiness)).toFixed(2));
  }
  return {
    description: "Demonstration Dataset Generated for Research Prototype",
    n_farms: new Set(records.map((r) => r.farm_id)).size,
    n_regions: regionMap.size,
    years,
    regions: Array.from(regionMap.values()),
    disclaimer: "Synthetic data. No real-world claims.",
    biophysical_indicators: BIOPHYSICAL_INDICATORS.map((i) => i.key),
    social_indicators: SOCIAL_INDICATORS.map((i) => i.key),
    outcomes: OUTCOMES.map((i) => i.key),
  };
}

function fallbackCorrelation(
  records: FarmRecord[],
  group: "all" | "biophysical" | "social" | "mixed",
): CorrelationResponse {
  let cols: string[];
  if (group === "biophysical") cols = BIOPHYSICAL_INDICATORS.map((i) => i.key);
  else if (group === "social") cols = SOCIAL_INDICATORS.map((i) => i.key);
  else if (group === "mixed") cols = SOCIAL_INDICATORS.map((i) => i.key).concat(BIOPHYSICAL_INDICATORS.map((i) => i.key));
  else cols = SOCIAL_INDICATORS.map((i) => i.key).concat(BIOPHYSICAL_INDICATORS.map((i) => i.key), OUTCOMES.map((i) => i.key));
  return { columns: cols, matrix: correlationMatrix(records, cols) };
}

function fallbackTrend(
  records: FarmRecord[],
  indicator: string,
  group_by: "region" | "overall",
): TrendResponse {
  const years = Array.from(new Set(records.map((r) => r.year))).sort();
  if (group_by === "overall") {
    return {
      indicator,
      group_by,
      series: {
        overall: years.map((y) => ({
          year: y,
          value: Number(mean(records.filter((r) => r.year === y).map((r) => Number((r as any)[indicator]))).toFixed(3)),
        })),
      },
    };
  }
  const series: TrendResponse["series"] = {};
  const regions = Array.from(new Set(records.map((r) => r.region_id)));
  for (const rid of regions) {
    series[rid] = years.map((y) => ({
      year: y,
      value: Number(mean(records.filter((r) => r.region_id === rid && r.year === y).map((r) => Number((r as any)[indicator]))).toFixed(3)),
    }));
  }
  return { indicator, group_by, series };
}

function fallbackRegression(
  records: FarmRecord[],
  x: string,
  y: string,
): RegressionResponse {
  const xs = records.map((r) => Number((r as any)[x]));
  const ys = records.map((r) => Number((r as any)[y]));
  const reg = linearRegression(xs, ys);
  const r = pearson(xs, ys);
  // Subsample scatter for plot
  const step = Math.max(1, Math.floor(records.length / 150));
  const scatter: { x: number; y: number }[] = [];
  for (let i = 0; i < records.length; i += step) {
    scatter.push({ x: xs[i], y: ys[i] });
  }
  return {
    x,
    y,
    n: reg.n,
    slope: reg.slope,
    intercept: reg.intercept,
    r2: reg.r2,
    slope_se: reg.slopeSe,
    t_stat: reg.slopeSe ? reg.slope / reg.slopeSe : 0,
    p_value: 0, // not computed client-side; backend computes via scipy
    slope_ci_95: reg.ci95,
    bootstrap_ci_95: reg.ci95,
    x_min: Math.min(...xs),
    x_max: Math.max(...xs),
    y_min: Math.min(...ys),
    y_max: Math.max(...ys),
    scatter,
  };
}

function fallbackSimulate(policy: PolicyInputs, records: FarmRecord[]): SimulationResponse {
  // Mirrors the FastAPI simulate endpoint logic in TypeScript
  const horizon = Math.max(1, Math.min(10, policy.horizon_years));
  const deltaKnowledge = clamp(policy.farmer_training_hours * 1.2, 0, 60);
  const deltaTrust = clamp(policy.extension_contact_freq * 3.5, 0, 40);
  const deltaAccessTest = clamp((policy.soil_testing_subsidies - 50) * 0.4, -20, 30);
  const deltaAccessAdv = clamp((policy.financial_incentives - 50) * 0.3, -20, 30);
  const deltaParticipation = clamp((policy.community_engagement - 50) * 0.4, -20, 30);
  const deltaPeer = clamp((policy.community_engagement - 50) * 0.2, -15, 20);

  const latestYear = Math.max(...records.map((r) => r.year));
  const baseline = records.filter((r) => r.year === latestYear);
  const baseTrust = mean(baseline.map((r) => r.trust_extension));
  const baseKnowledge = mean(baseline.map((r) => r.farmer_knowledge));
  const basePeer = mean(baseline.map((r) => r.peer_influence));
  const basePart = mean(baseline.map((r) => r.participation_networks));
  const baseAccessTest = mean(baseline.map((r) => r.access_soil_testing));
  const baseAccessAdv = mean(baseline.map((r) => r.access_advisory));

  const baseSOC = mean(records.map((r) => r.soc_percent));

  const years = Array.from({ length: horizon }, (_, i) => i + 1);
  const adoptionTraj = [];
  const soilTraj = [];
  const resilienceTraj = [];

  for (const y of years) {
    const t = y / horizon;
    const trust = clamp(baseTrust + deltaTrust * t, 0, 100);
    const knowledge = clamp(baseKnowledge + deltaKnowledge * t, 0, 100);
    const peer = clamp(basePeer + deltaPeer * t, 0, 100);
    const participation = clamp(basePart + deltaParticipation * t, 0, 100);
    const accessTest = clamp(baseAccessTest + deltaAccessTest * t, 0, 100);
    const accessAdv = clamp(baseAccessAdv + deltaAccessAdv * t, 0, 100);

    const z = -2.4 + 0.025 * trust + 0.022 * knowledge + 0.018 * peer + 0.020 * participation + 0.5 * t;
    const adoptionProb = 1 / (1 + Math.exp(-z));

    const soc = baseSOC + 0.7 * adoptionProb * t + 0.4 * (knowledge - 50) / 50;
    const som = soc * 1.724;
    const soilHealth = clamp(15 + 8 * soc + 4 * som + 6 * t + 5 * adoptionProb, 0, 100);
    const adoptionReadiness = clamp(0.3 * trust + 0.25 * knowledge + 0.15 * peer + 0.15 * participation + 0.1 * accessTest + 0.05 * accessAdv + 5 * t, 0, 100);
    const resilience = clamp(0.4 * soilHealth + 0.3 * adoptionReadiness + 0.15 * 50 + 0.1 * participation + 5, 0, 100);

    adoptionTraj.push({
      year: y,
      adoption_likelihood: Number((adoptionProb * 100).toFixed(2)),
      cover_crop_adoption: Number((adoptionProb * 100).toFixed(2)),
      soil_testing_frequency: Number((0.4 + 0.025 * accessTest + 0.4 * t).toFixed(2)),
      conservation_tillage: Number(clamp(adoptionProb * 90 + 5, 0, 95).toFixed(2)),
    });
    soilTraj.push({
      year: y,
      soc: Number(soc.toFixed(3)),
      som: Number(som.toFixed(3)),
      soil_health_score: Number(soilHealth.toFixed(2)),
      microbial_activity: Number((18 + 8 * som + 4 * adoptionProb).toFixed(2)),
    });
    resilienceTraj.push({
      year: y,
      resilience_score: Number(resilience.toFixed(2)),
      adoption_readiness: Number(adoptionReadiness.toFixed(2)),
    });
  }

  return {
    policy,
    years,
    adoption_trajectory: adoptionTraj,
    soil_health_trajectory: soilTraj,
    resilience_trajectory: resilienceTraj,
    final: {
      adoption_likelihood: adoptionTraj[adoptionTraj.length - 1].adoption_likelihood,
      soil_health_score: soilTraj[soilTraj.length - 1].soil_health_score,
      resilience_score: resilienceTraj[resilienceTraj.length - 1].resilience_score,
      soc_change: Number((soilTraj[soilTraj.length - 1].soc - baseSOC).toFixed(3)),
    },
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// ---------------------------------------------------------------------------
// Public API (with fallback)
// ---------------------------------------------------------------------------
export const soilApi = {
  async health(): Promise<{ status: string; rows: number } | null> {
    return tryBackendGet("health");
  },

  async meta(): Promise<MetaInfo> {
    const backend = await tryBackendGet<MetaInfo>("meta");
    if (backend) return backend;
    const records = await loadStaticDataset();
    return staticMeta ?? fallbackMeta(records);
  },

  async dataset(params?: { region?: string; year?: number; limit?: number }): Promise<DatasetResponse> {
    const qs = new URLSearchParams();
    if (params?.region) qs.set("region", params.region);
    if (params?.year) qs.set("year", String(params.year));
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    const backend = await tryBackendGet<DatasetResponse>(`dataset${q ? `?${q}` : ""}`);
    if (backend) return backend;
    // Fallback: filter static dataset locally
    let records = await loadStaticDataset();
    if (params?.region) records = records.filter((r) => r.region_id === params.region);
    if (params?.year) records = records.filter((r) => r.year === params.year);
    if (params?.limit) records = records.slice(0, params.limit);
    return { records };
  },

  async regionSummary(): Promise<RegionSummary[]> {
    const backend = await tryBackendGet<RegionSummary[]>("region-summary");
    if (backend && backend.length) return backend;
    if (staticRegions && staticRegions.length) return staticRegions;
    const records = await loadStaticDataset();
    return fallbackMeta(records).regions;
  },

  async correlation(group: "all" | "biophysical" | "social" | "mixed" = "all"): Promise<CorrelationResponse> {
    const backend = await tryBackendGet<CorrelationResponse>(`correlation?group=${group}`);
    if (backend) return backend;
    const records = await loadStaticDataset();
    return fallbackCorrelation(records, group);
  },

  async trend(indicator: string, group_by: "region" | "overall" = "overall"): Promise<TrendResponse> {
    const backend = await tryBackendGet<TrendResponse>(`trend?indicator=${indicator}&group_by=${group_by}`);
    if (backend) return backend;
    const records = await loadStaticDataset();
    return fallbackTrend(records, indicator, group_by);
  },

  async regression(x: string, y: string, control?: string): Promise<RegressionResponse> {
    const backend = await tryBackendPost<RegressionResponse>("regression", { x, y, control });
    if (backend) return backend;
    const records = await loadStaticDataset();
    return fallbackRegression(records, x, y);
  },

  async simulate(policy: PolicyInputs): Promise<SimulationResponse> {
    const backend = await tryBackendPost<SimulationResponse>("simulate", policy);
    if (backend) return backend;
    const records = await loadStaticDataset();
    return fallbackSimulate(policy, records);
  },
};
