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
  Cell,
  LabelList,
} from "recharts";
import { ChartCard } from "@/components/soil/chart-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SOCIAL_INDICATORS, type FarmRecord, type RegionSummary, getIndicatorMeta } from "@/lib/soil-types";
import { mean, correlationMatrix, pearson } from "@/lib/soil-stats";
import { REGION_PALETTE } from "@/components/soil/palette";

interface Props {
  records: FarmRecord[];
  regions: RegionSummary[];
}

// Module-level constants — these never change across renders
const CORRELATION_COLS = SOCIAL_INDICATORS.map((i) => i.key);

export function HumanDriversTab({ records, regions }: Props) {
  const [indicator, setIndicator] = useState<string>("trust_extension");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [knowledgeMin, setKnowledgeMin] = useState<number>(0);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (regionFilter !== "all" && r.region_id !== regionFilter) return false;
      if (yearFilter !== "all" && String(r.year) !== yearFilter) return false;
      if (r.farmer_knowledge < knowledgeMin) return false;
      return true;
    });
  }, [records, regionFilter, yearFilter, knowledgeMin]);

  // Social drivers correlation matrix (computed client-side)
  const matrix = useMemo(
    () => correlationMatrix(filtered, CORRELATION_COLS),
    [filtered],
  );

  // Trend per region for the selected indicator
  const trendByRegion = useMemo(() => {
    const years = Array.from(new Set(filtered.map((r) => r.year))).sort();
    return years.map((y) => {
      const point: Record<string, number | string> = { year: y };
      for (const r of regions) {
        const vals = filtered
          .filter((rec) => rec.region_id === r.region_id && rec.year === y)
          .map((rec) => Number((rec as any)[indicator]));
        if (vals.length) point[r.region_name] = Number(mean(vals).toFixed(2));
      }
      return point;
    });
  }, [filtered, indicator, regions]);

  // Regional comparison (bar)
  const regionalComparison = useMemo(() => {
    return regions
      .map((r) => {
        const vals = filtered
          .filter((rec) => rec.region_id === r.region_id)
          .map((rec) => Number((rec as any)[indicator]));
        return {
          region: r.region_name,
          region_id: r.region_id,
          value: vals.length ? Number(mean(vals).toFixed(2)) : 0,
          n: vals.length,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filtered, indicator, regions]);

  // Heatmap data — flatten matrix into a row-format table for rendering
  const heatmapRows = useMemo(() => {
    return CORRELATION_COLS.map((rowKey, i) => {
      const row: Record<string, number | string> = { indicator: getIndicatorMeta(rowKey)?.label || rowKey };
      CORRELATION_COLS.forEach((colKey, j) => {
        row[getIndicatorMeta(colKey)?.label || colKey] = Number(matrix[i][j].toFixed(3));
      });
      return row;
    });
  }, [matrix]);

  // Regional summary table for the indicator (used by "regional comparison map")
  const regionalMapData = useMemo(() => {
    return regions.map((r, i) => {
      const vals = filtered.filter((rec) => rec.region_id === r.region_id).map((rec) => Number((rec as any)[indicator]));
      const m = vals.length ? mean(vals) : 0;
      const pct = Math.max(0, Math.min(100, m));
      return {
        ...r,
        value: Number(m.toFixed(2)),
        pct,
        fill: REGION_PALETTE[i % REGION_PALETTE.length],
      };
    });
  }, [filtered, indicator, regions]);

  const indMeta = getIndicatorMeta(indicator);
  const maxVal = Math.max(...regionalMapData.map((d) => d.value));
  const minVal = Math.min(...regionalMapData.map((d) => d.value));

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dynamic Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Indicator</Label>
            <Select value={indicator} onValueChange={setIndicator}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_INDICATORS.map((i) => (
                  <SelectItem key={i.key} value={i.key}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Region</Label>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
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
            <Select value={yearFilter} onValueChange={setYearFilter}>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Min Farmer Knowledge: {knowledgeMin}</Label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[knowledgeMin]}
              onValueChange={(v) => setKnowledgeMin(v[0] ?? 0)}
            />
            <div className="text-[10px] text-muted-foreground">Filter records below this score</div>
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SOCIAL_INDICATORS.slice(0, 4).map((k) => {
          const vals = filtered.map((r) => Number((r as any)[k.key]));
          return (
            <Card key={k.key} className="bg-paper">
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">{k.label}</div>
                <div className="text-xl font-semibold mt-0.5">{mean(vals).toFixed(1)}<span className="text-xs text-muted-foreground ml-1">/100</span></div>
                <div className="text-[10px] text-muted-foreground mt-0.5">n = {vals.length}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Correlation heatmap (full width) */}
      <ChartCard
        title="Social Drivers — Correlation Heatmap"
        description="Pearson correlation among the 8 social/behavioral indicators"
        csvData={heatmapRows as unknown as Record<string, unknown>[]}
        csvName="social_correlation.csv"
        pngName="social_correlation.png"
      >
        <div className="overflow-x-auto scrollbar-soil">
          <table className="text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="p-1.5 text-left sticky left-0 bg-paper"></th>
                {SOCIAL_INDICATORS.map((ind) => (
                  <th key={ind.key} className="p-1.5 text-center font-medium max-w-[70px] align-bottom">
                    <div className="whitespace-normal leading-tight">{ind.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SOCIAL_INDICATORS.map((rowInd, i) => (
                <tr key={rowInd.key}>
                  <td className="p-1.5 text-right font-medium whitespace-nowrap sticky left-0 bg-paper border-r border-border">
                    {rowInd.label}
                  </td>
                  {SOCIAL_INDICATORS.map((colInd, j) => {
                    const v = matrix[i][j];
                    const intensity = Math.abs(v);
                    const bg = v > 0
                      ? `oklch(0.85 0.07 150 / ${0.15 + intensity * 0.7})`
                      : `oklch(0.7 0.13 50 / ${0.15 + intensity * 0.7})`;
                    return (
                      <td
                        key={colInd.key}
                        className="p-1.5 text-center border border-border/30"
                        style={{ background: bg }}
                        title={`${rowInd.label} × ${colInd.label} = ${v.toFixed(3)}`}
                      >
                        <span className="font-mono text-[10px]">{v.toFixed(2)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 inline-block rounded-sm" style={{ background: "oklch(0.85 0.07 150)" }} />
            <span>Positive correlation</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 inline-block rounded-sm" style={{ background: "oklch(0.7 0.13 50)" }} />
            <span>Negative correlation</span>
          </div>
          <span>·</span>
          <span>|r| → intensity</span>
        </div>
      </ChartCard>

      {/* Trend + regional comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title={`${indMeta?.label} — Trend by Region`}
          description={`Mean ${indMeta?.label.toLowerCase()} per region per year`}
          csvData={trendByRegion as unknown as Record<string, unknown>[]}
          csvName={`${indicator}_social_trend.csv`}
          pngName={`${indicator}_social_trend.png`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendByRegion} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
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
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`${indMeta?.label} — Regional Comparison`}
          description={`Mean ${indMeta?.label.toLowerCase()} by region`}
          csvData={regionalComparison}
          csvName={`${indicator}_social_regional.csv`}
          pngName={`${indicator}_social_regional.png`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={regionalComparison} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="region" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="value" name={indMeta?.label} radius={[0, 4, 4, 0]}>
                {regionalComparison.map((_, i) => (
                  <Cell key={i} fill={REGION_PALETTE[i % REGION_PALETTE.length]} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Regional comparison "map" (grid heatmap of region tiles) */}
      <ChartCard
        title="Regional Comparison Map"
        description={`Relative ${indMeta?.label.toLowerCase()} across regions (filtered records)`}
        csvData={regionalMapData.map((d) => ({ region: d.region_name, value: d.value }))}
        csvName={`${indicator}_regional_map.csv`}
        pngName={`${indicator}_regional_map.png`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1">
          {regionalMapData.map((d) => {
            // Compute relative intensity (0-1) across the dataset
            const range = Math.max(0.001, maxVal - minVal);
            const intensity = (d.value - minVal) / range;
            const opacity = 0.25 + intensity * 0.7;
            return (
              <div
                key={d.region_id}
                className="border border-border/40 rounded-md p-3 text-center"
                style={{
                  background: `oklch(0.6 0.13 50 / ${opacity})`,
                  color: intensity > 0.6 ? "oklch(0.985 0 0)" : "oklch(0.22 0.02 60)",
                }}
              >
                <div className="text-[11px] font-medium truncate">{d.region_name}</div>
                <div className="text-lg font-semibold mt-1">{d.value.toFixed(1)}</div>
                <div className="text-[10px] opacity-80">/ 100</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Low: {minVal.toFixed(1)}</span>
          <div className="flex-1 mx-3 h-2 rounded-full" style={{ background: "linear-gradient(to right, oklch(0.6 0.13 50 / 0.3), oklch(0.6 0.13 50 / 0.95))" }} />
          <span>High: {maxVal.toFixed(1)}</span>
        </div>
      </ChartCard>
    </div>
  );
}
