"use client";

import { useMemo, useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import { ChartCard } from "@/components/soil/chart-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Gauge } from "@/components/soil/gauge";
import {
  BIOPHYSICAL_INDICATORS,
  SOCIAL_INDICATORS,
  type FarmRecord,
  type RegionSummary,
} from "@/lib/soil-types";
import { mean } from "@/lib/soil-stats";
import { REGION_PALETTE } from "@/components/soil/palette";

interface Props {
  records: FarmRecord[];
  regions: RegionSummary[];
}

// Normalization helper: scale an indicator to 0-100 using its defined range
function normalize(value: number, range: [number, number]): number {
  const [lo, hi] = range;
  if (hi === lo) return 50;
  return Math.max(0, Math.min(100, ((value - lo) / (hi - lo)) * 100));
}

export function ResilienceTab({ records, regions }: Props) {
  const [region, setRegion] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (region !== "all" && r.region_id !== region) return false;
      if (year !== "all" && String(r.year) !== year) return false;
      return true;
    });
  }, [records, region, year]);

  // Compute composite scores
  const composite = useMemo(() => {
    if (!filtered.length) return null;

    // Biophysical subscore: SOC, SOM, Microbial activity — normalized & averaged
    const bioScores = BIOPHYSICAL_INDICATORS.filter((i) =>
      ["soc_percent", "som_percent", "microbial_activity"].includes(i.key),
    ).map((i) => {
      const vals = filtered.map((r) => Number((r as any)[i.key]));
      return mean(vals.map((v) => normalize(v, i.range)));
    });

    // Social subscore: Trust, Knowledge, Participation
    const socScores = SOCIAL_INDICATORS.filter((i) =>
      ["trust_extension", "farmer_knowledge", "participation_networks"].includes(i.key),
    ).map((i) => {
      const vals = filtered.map((r) => Number((r as any)[i.key]));
      return mean(vals);
    });

    // Soil Health Score = 0.5 * bio + 0.5 * (already-stored soil_health_score / 100)
    const bioComposite = mean(bioScores);
    const storedSoilHealth = mean(filtered.map((r) => r.soil_health_score));
    const soilHealthScore = 0.4 * bioComposite + 0.6 * storedSoilHealth;

    // Adoption Readiness: trust + knowledge + participation (weighted)
    const adoptionReadiness =
      0.35 * socScores[0] + 0.35 * socScores[1] + 0.30 * socScores[2];

    // Farm Resilience Score
    const storedResilience = mean(filtered.map((r) => r.farm_resilience_score));
    const farmResilienceScore =
      0.4 * soilHealthScore + 0.3 * adoptionReadiness + 0.3 * storedResilience;

    return {
      bioScores,
      socScores,
      bioComposite,
      soilHealthScore,
      adoptionReadiness,
      farmResilienceScore,
    };
  }, [filtered]);

  // Radar: composite components per dimension
  const radarData = useMemo(() => {
    if (!filtered.length) return [];
    const bioKeys = ["soc_percent", "som_percent", "microbial_activity"];
    const socKeys = ["trust_extension", "farmer_knowledge", "participation_networks"];
    const rows = [...bioKeys, ...socKeys].map((k) => {
      const meta = [...BIOPHYSICAL_INDICATORS, ...SOCIAL_INDICATORS].find((i) => i.key === k)!;
      const vals = filtered.map((r) => Number((r as any)[k]));
      const score = meta.group === "biophysical"
        ? mean(vals.map((v) => normalize(v, meta.range)))
        : mean(vals);
      return { dimension: meta.label.replace(/Soil |Farmer /, ""), score: Number(score.toFixed(1)) };
    });
    return rows;
  }, [filtered]);

  // Regional rankings (latest year only, for stability)
  const regionalRankings = useMemo(() => {
    const latestYear = Math.max(...records.map((r) => r.year));
    const latest = records.filter((r) => r.year === latestYear);
    return regions
      .map((r, i) => {
        const sub = latest.filter((rec) => rec.region_id === r.region_id);
        const shs = mean(sub.map((s) => s.soil_health_score));
        const ar = mean(sub.map((s) => s.adoption_readiness));
        const rs = mean(sub.map((s) => s.farm_resilience_score));
        return {
          rank: 0,
          region: r.region_name,
          region_id: r.region_id,
          soil_health_score: Number(shs.toFixed(1)),
          adoption_readiness: Number(ar.toFixed(1)),
          resilience_score: Number(rs.toFixed(1)),
          overall: Number(((shs + ar + rs) / 3).toFixed(1)),
          fill: REGION_PALETTE[i % REGION_PALETTE.length],
        };
      })
      .sort((a, b) => b.overall - a.overall)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [records, regions]);

  // Per-region radar comparison
  const regionalRadar = useMemo(() => {
    const latestYear = Math.max(...records.map((r) => r.year));
    const latest = records.filter((r) => r.year === latestYear);
    const dimensions = [
      { key: "soil_health_score", label: "Soil Health" },
      { key: "adoption_readiness", label: "Adoption" },
      { key: "farm_resilience_score", label: "Resilience" },
      { key: "trust_extension", label: "Trust" },
      { key: "farmer_knowledge", label: "Knowledge" },
      { key: "participation_networks", label: "Participation" },
    ];
    return dimensions.map((d) => {
      const point: Record<string, number | string> = { dimension: d.label };
      regions.slice(0, 5).forEach((r) => {
        const sub = latest.filter((rec) => rec.region_id === r.region_id);
        point[r.region_name] = Number(mean(sub.map((s) => Number((s as any)[d.key]))).toFixed(1));
      });
      return point;
    });
  }, [records, regions]);

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Compute composite indices for the selected scope</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r.region_id} value={r.region_id}>
                    {r.region_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {Array.from(new Set(records.map((r) => r.year)))
                  .sort()
                  .map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Gauges */}
      {composite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composite Index — Gauges</CardTitle>
            <CardDescription>
              Soil Health Score combines SOC + SOM + Microbial Activity. Adoption Readiness combines Trust + Knowledge + Participation.
              Farm Resilience integrates soil health, adoption readiness & social capital.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col items-center">
                <Gauge value={composite.soilHealthScore} label="Soil Health Score" sublabel="Biophysical + stored composite" />
                <div className="text-[10px] text-muted-foreground mt-2">Biophysical sub-component: {composite.bioComposite.toFixed(1)} / 100</div>
              </div>
              <div className="flex flex-col items-center">
                <Gauge value={composite.adoptionReadiness} label="Adoption Readiness Score" sublabel="Trust · Knowledge · Participation" />
                <div className="text-[10px] text-muted-foreground mt-2">
                  Trust {composite.socScores[0].toFixed(1)} · Know {composite.socScores[1].toFixed(1)} · Part {composite.socScores[2].toFixed(1)}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <Gauge value={composite.farmResilienceScore} label="Farm Resilience Score" sublabel="Soil + Adoption + Social" />
                <div className="text-[10px] text-muted-foreground mt-2">Composite of three sub-indices</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar of components */}
        <ChartCard
          title="Composite Dimensions — Radar"
          description="Normalized component scores for the selected scope"
          csvData={radarData}
          csvName="composite_radar.csv"
          pngName="composite_radar.png"
        >
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="oklch(0.85 0.02 70)" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
              <Tooltip />
              <Radar name="Composite" dataKey="score" stroke="oklch(0.46 0.1 150)" fill="oklch(0.46 0.1 150)" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Regional rankings table */}
        <ChartCard
          title="Regional Comparative Rankings"
          description="Composite scores ranked overall (latest year)"
          csvData={regionalRankings}
          csvName="regional_rankings.csv"
          pngName="regional_rankings.png"
        >
          <div className="overflow-x-auto scrollbar-soil">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">Region</th>
                  <th className="text-right p-2">Soil Health</th>
                  <th className="text-right p-2">Adoption</th>
                  <th className="text-right p-2">Resilience</th>
                  <th className="text-right p-2">Overall</th>
                </tr>
              </thead>
              <tbody>
                {regionalRankings.map((r) => (
                  <tr key={r.region_id} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="p-2 font-mono">#{r.rank}</td>
                    <td className="p-2 font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: r.fill }} />
                      {r.region}
                    </td>
                    <td className="p-2 text-right font-mono">{r.soil_health_score}</td>
                    <td className="p-2 text-right font-mono">{r.adoption_readiness}</td>
                    <td className="p-2 text-right font-mono">{r.resilience_score}</td>
                    <td className="p-2 text-right font-mono font-semibold">{r.overall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Regional radar comparison (top 5 regions) */}
      <ChartCard
        title="Regional Composite Radar (Top 5 Regions)"
        description="Multi-dimension comparison across the highest-scoring regions"
        csvData={regionalRadar as unknown as Record<string, unknown>[]}
        csvName="regional_radar.csv"
        pngName="regional_radar.png"
      >
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={regionalRadar} outerRadius="70%">
            <PolarGrid stroke="oklch(0.85 0.02 70)" />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
            <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {regions.slice(0, 5).map((r, i) => (
              <Radar
                key={r.region_id}
                name={r.region_name}
                dataKey={r.region_name}
                stroke={REGION_PALETTE[i % REGION_PALETTE.length]}
                fill={REGION_PALETTE[i % REGION_PALETTE.length]}
                fillOpacity={0.08}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
