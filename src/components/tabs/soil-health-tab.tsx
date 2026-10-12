"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Cell,
  LabelList,
} from "recharts";
import { ChartCard } from "@/components/soil/chart-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BIOPHYSICAL_INDICATORS, type FarmRecord, type RegionSummary, getIndicatorMeta } from "@/lib/soil-types";
import { mean, quantile } from "@/lib/soil-stats";
import { REGION_PALETTE } from "@/components/soil/palette";

interface Props {
  records: FarmRecord[];
  regions: RegionSummary[];
}

export function SoilHealthTab({ records, regions }: Props) {
  const [indicator, setIndicator] = useState<string>("soc_percent");
  const [region, setRegion] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  // Filter records
  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (region !== "all" && r.region_id !== region) return false;
      if (year !== "all" && String(r.year) !== year) return false;
      return true;
    });
  }, [records, region, year]);

  // Trend over time (overall or by region)
  const trendData = useMemo(() => {
    const years = Array.from(new Set(filtered.map((r) => r.year))).sort();
    if (region === "all") {
      const series = years.map((y) => {
        const point: Record<string, number | string> = { year: y };
        for (const r of regions) {
          const vals = filtered
            .filter((rec) => rec.region_id === r.region_id && rec.year === y)
            .map((rec) => Number((rec as any)[indicator]));
          if (vals.length) point[r.region_id] = Number(mean(vals).toFixed(3));
        }
        return point;
      });
      return series;
    }
    return years.map((y) => {
      const vals = filtered
        .filter((rec) => String(rec.year) === String(y))
        .map((rec) => Number((rec as any)[indicator]));
      return { year: y, value: Number(mean(vals).toFixed(3)) };
    });
  }, [filtered, indicator, region, regions]);

  // Regional comparison (bar) - mean of indicator per region
  const regionalComparison = useMemo(() => {
    return regions
      .map((r) => {
        const vals = filtered
          .filter((rec) => rec.region_id === r.region_id)
          .map((rec) => Number((rec as any)[indicator]));
        return {
          region: r.region_name,
          region_id: r.region_id,
          value: vals.length ? Number(mean(vals).toFixed(3)) : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filtered, indicator, regions]);

  // Box-plot per region (distribution)
  const distributionData = useMemo(() => {
    return regions.map((r) => {
      const vals = filtered
        .filter((rec) => rec.region_id === r.region_id)
        .map((rec) => Number((rec as any)[indicator]))
        .sort((a, b) => a - b);
      if (!vals.length) return { region: r.region_name, min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0 };
      const q1 = Number(quantile(vals, 0.25).toFixed(3));
      const q3 = Number(quantile(vals, 0.75).toFixed(3));
      return {
        region: r.region_name,
        min: Number(vals[0].toFixed(3)),
        q1,
        median: Number(quantile(vals, 0.5).toFixed(3)),
        q3,
        max: Number(vals[vals.length - 1].toFixed(3)),
        iqr: Number((q3 - q1).toFixed(3)),
      };
    });
  }, [filtered, indicator, regions]);

  // Radar: indicator means (normalized) per region — pick latest year
  const radarData = useMemo(() => {
    const latestYear = Math.max(...filtered.map((r) => r.year));
    const latest = filtered.filter((r) => r.year === latestYear);
    return BIOPHYSICAL_INDICATORS.map((ind) => {
      const point: Record<string, number | string> = { indicator: ind.label };
      for (const r of regions.slice(0, 5)) {
        const vals = latest
          .filter((rec) => rec.region_id === r.region_id)
          .map((rec) => Number((rec as any)[ind.key]));
        if (!vals.length) {
          point[r.region_name] = 0;
          continue;
        }
        const m = mean(vals);
        const norm = ((m - ind.range[0]) / (ind.range[1] - ind.range[0])) * 100;
        point[r.region_name] = Number(clamp(norm, 0, 100).toFixed(1));
      }
      return point;
    });
  }, [filtered, regions]);

  const indMeta = getIndicatorMeta(indicator);
  const unitLabel = indMeta?.unit ? ` (${indMeta.unit})` : "";
  const csvExport = regionalComparison.map((r) => ({ region: r.region, value: r.value }));

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Indicator</Label>
            <Select value={indicator} onValueChange={setIndicator}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BIOPHYSICAL_INDICATORS.map((i) => (
                  <SelectItem key={i.key} value={i.key}>
                    {i.label} ({i.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["soc_percent", "som_percent", "microbial_activity", "ph"] as const).map((k) => {
          const vals = filtered.map((r) => Number((r as any)[k]));
          const m = mean(vals);
          const meta = getIndicatorMeta(k);
          return (
            <Card key={k} className="bg-paper">
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">{meta?.label}</div>
                <div className="text-xl font-semibold mt-0.5">
                  {m.toFixed(2)}
                  <span className="text-xs text-muted-foreground ml-1">{meta?.unit}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">n = {vals.length}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trend chart + regional bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title={`${indMeta?.label} Trend Over Time`}
          description={`Mean ${indMeta?.label.toLowerCase()} by year${region === "all" ? ", by region" : ""}${unitLabel}`}
          csvData={region === "all" ? (trendData as unknown as Record<string, unknown>[]) : trendData.map((d: any) => ({ year: d.year, value: d.value }))}
          csvName={`${indicator}_trend.csv`}
          pngName={`${indicator}_trend.png`}
        >
          <ResponsiveContainer width="100%" height={300}>
            {region === "all" ? (
              <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {regions.map((r, i) => (
                  <Line
                    key={r.region_id}
                    type="monotone"
                    dataKey={r.region_name}
                    stroke={REGION_PALETTE[i % REGION_PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            ) : (
              <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={indMeta?.label}
                  stroke="oklch(0.46 0.1 150)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`Regional Comparison — ${indMeta?.label}`}
          description={`Mean ${indMeta?.label.toLowerCase()} by region${unitLabel}`}
          csvData={csvExport}
          csvName={`${indicator}_by_region.csv`}
          pngName={`${indicator}_by_region.png`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={regionalComparison} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="region" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="value" name={indMeta?.label} fill="oklch(0.46 0.1 150)" radius={[0, 4, 4, 0]}>
                {regionalComparison.map((_, i) => (
                  <Cell key={i} fill={REGION_PALETTE[i % REGION_PALETTE.length]} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribution — implemented as custom bar with whiskers via ComposedChart */}
        <ChartCard
          title={`Distribution by Region — ${indMeta?.label}`}
          description="Min · Q1 · Median · Q3 · Max"
          csvData={distributionData}
          csvName={`${indicator}_distribution.csv`}
          pngName={`${indicator}_distribution.png`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={distributionData} margin={{ top: 12, right: 16, bottom: 32, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
              <XAxis dataKey="region" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {/* IQR (q3 - q1) shown as a bar; min/max/median overlaid */}
              <Bar dataKey="iqr" name="IQR (Q3-Q1)" fill="oklch(0.86 0.04 65)" radius={[2, 2, 0, 0]} />
              <Line dataKey="median" name="Median" stroke="oklch(0.46 0.1 150)" strokeWidth={2} dot={{ r: 3 }} />
              <Line dataKey="min" name="Min" stroke="oklch(0.6 0.13 50)" strokeWidth={1} dot={{ r: 2 }} />
              <Line dataKey="max" name="Max" stroke="oklch(0.42 0.06 40)" strokeWidth={1} dot={{ r: 2 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar */}
        <ChartCard
          title="Multi-Indicator Regional Profile"
          description="Normalized (0-100) biophysical indicators · top 5 regions · latest year"
          csvData={radarData as unknown as Record<string, unknown>[]}
          csvName="biophysical_radar.csv"
          pngName="biophysical_radar.png"
        >
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="oklch(0.85 0.02 70)" />
              <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 10 }} />
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
                  fillOpacity={0.12}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
