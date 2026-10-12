"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";
import { ChartCard } from "@/components/soil/chart-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  BIOPHYSICAL_INDICATORS,
  SOCIAL_INDICATORS,
  OUTCOMES,
  type FarmRecord,
  getIndicatorMeta,
} from "@/lib/soil-types";
import { mean, correlationMatrix, pearson, linearRegression } from "@/lib/soil-stats";
import { soilApi } from "@/lib/soil-api";
import { toast } from "sonner";

interface Props {
  records: FarmRecord[];
}

const PRESET_PAIRS: { x: string; y: string; label: string }[] = [
  { x: "trust_extension", y: "som_percent", label: "Trust vs Soil Organic Matter" },
  { x: "access_advisory", y: "cover_crop_adoption", label: "Extension contact vs Cover crop adoption" },
  { x: "peer_influence", y: "soil_testing_frequency", label: "Peer influence vs Soil testing frequency" },
  { x: "farmer_knowledge", y: "soil_health_score", label: "Farmer knowledge vs Soil health score" },
];

const ALL_COLS = SOCIAL_INDICATORS.map((i) => i.key).concat(
  BIOPHYSICAL_INDICATORS.map((i) => i.key),
  OUTCOMES.map((i) => i.key),
);

// Module-level constants for the mixed correlation matrix (social × biophysical)
const MIXED_ROWS = SOCIAL_INDICATORS.map((s) => s.key);
const MIXED_COLS = BIOPHYSICAL_INDICATORS.map((b) => b.key).concat(OUTCOMES.map((o) => o.key));

export function LinkingTab({ records }: Props) {
  const [xVar, setXVar] = useState<string>("trust_extension");
  const [yVar, setYVar] = useState<string>("som_percent");
  const [preset, setPreset] = useState<number>(0);
  const [regResult, setRegResult] = useState<{
    slope: number;
    intercept: number;
    r2: number;
    slopeSe: number;
    ci95: [number, number];
    n: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Apply preset
  useEffect(() => {
    setXVar(PRESET_PAIRS[preset].x);
    setYVar(PRESET_PAIRS[preset].y);
  }, [preset]);

  // Run regression via FastAPI
  useEffect(() => {
    let active = true;
    setLoading(true);
    soilApi
      .regression(xVar, yVar)
      .then((r) => {
        if (!active) return;
        setRegResult({
          slope: r.slope,
          intercept: r.intercept,
          r2: r.r2,
          slopeSe: r.slope_se,
          ci95: r.slope_ci_95,
          n: r.n,
        });
      })
      .catch((e) => {
        if (!active) return;
        toast.error("FastAPI regression failed, using client-side fallback");
        // Fallback to client-side regression
        const xs = records.map((r) => Number((r as any)[xVar]));
        const ys = records.map((r) => Number((r as any)[yVar]));
        const res = linearRegression(xs, ys);
        setRegResult({
          slope: res.slope,
          intercept: res.intercept,
          r2: res.r2,
          slopeSe: res.slopeSe,
          ci95: res.ci95,
          n: res.n,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [xVar, yVar, records]);

  // Build scatter data + regression line
  const scatterData = useMemo(() => {
    // Subsample for rendering performance (~500 points)
    const step = Math.max(1, Math.floor(records.length / 500));
    const pts = records
      .filter((_, i) => i % step === 0)
      .map((r) => ({
        x: Number((r as any)[xVar]),
        y: Number((r as any)[yVar]),
        region: r.region_name,
      }));
    return pts;
  }, [records, xVar, yVar]);

  const lineData = useMemo(() => {
    if (!regResult) return [];
    const xMeta = getIndicatorMeta(xVar);
    const xMin = xMeta?.range?.[0] ?? Math.min(...scatterData.map((d) => d.x));
    const xMax = xMeta?.range?.[1] ?? Math.max(...scatterData.map((d) => d.x));
    return [
      { x: xMin, y: regResult.intercept + regResult.slope * xMin },
      { x: xMax, y: regResult.intercept + regResult.slope * xMax },
    ];
  }, [regResult, scatterData, xVar]);

  // Pearson correlation client-side (matches backend)
  const r = useMemo(() => {
    const xs = records.map((rec) => Number((rec as any)[xVar]));
    const ys = records.map((rec) => Number((rec as any)[yVar]));
    return pearson(xs, ys);
  }, [records, xVar, yVar]);

  // Mixed correlation matrix: Social × Biophysical (module-level constants)
  const mixedMatrix = useMemo(() => {
    const full = correlationMatrix(records, [...MIXED_ROWS, ...MIXED_COLS]);
    // Take only the social rows × biophysical cols
    return MIXED_ROWS.map((_, i) => MIXED_COLS.map((_, j) => full[i][MIXED_ROWS.length + j]));
  }, [records]);

  const xMeta = getIndicatorMeta(xVar);
  const yMeta = getIndicatorMeta(yVar);

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Introduction */}
      <Card className="bg-paper border-forest-600/30">
        <CardHeader>
          <CardTitle className="text-base">Linking People & Soil</CardTitle>
          <CardDescription>
            The key innovation of this dashboard — visualize how{" "}
            <strong>Social Drivers → Management Decisions → Soil Outcomes → Farm Resilience</strong>.
            Pick a preset pair or choose any X (social driver) and Y (soil outcome / resilience).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PRESET_PAIRS.map((p, i) => (
              <Badge
                key={i}
                variant={preset === i ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setPreset(i)}
              >
                {p.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Variable selectors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variables</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">X axis — Social / Behavioral Driver</Label>
            <Select value={xVar} onValueChange={setXVar}>
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
            <Label className="text-xs">Y axis — Soil Outcome / Resilience</Label>
            <Select value={yVar} onValueChange={setYVar}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...BIOPHYSICAL_INDICATORS, ...OUTCOMES].map((i) => (
                  <SelectItem key={i.key} value={i.key}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scatter plot with regression line + regression stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard
            title={`Scatterplot: ${xMeta?.label} vs ${yMeta?.label}`}
            description={`Linear regression overlay · n=${regResult?.n ?? 0} farm-year observations`}
            csvData={scatterData}
            csvName={`${xVar}_vs_${yVar}_scatter.csv`}
            pngName={`${xVar}_vs_${yVar}_scatter.png`}
          >
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xMeta?.label}
                  tick={{ fontSize: 11 }}
                  label={{ value: `${xMeta?.label} (${xMeta?.unit})`, position: "bottomInside", offset: 12, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yMeta?.label}
                  tick={{ fontSize: 11 }}
                  label={{ value: `${yMeta?.label} (${yMeta?.unit})`, angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value: any) => (typeof value === "number" ? value.toFixed(3) : value)}
                />
                <Scatter data={scatterData} fill="oklch(0.6 0.13 50)" fillOpacity={0.45} />
                {regResult ? (
                  <Line
                    data={lineData}
                    dataKey="y"
                    stroke="oklch(0.46 0.1 150)"
                    strokeWidth={2.5}
                    dot={false}
                    name={`Regression line (slope = ${regResult.slope.toFixed(3)})`}
                  />
                ) : null}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Regression stats sidebar */}
        <Card className="bg-paper">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Regression Output
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {regResult ? (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Equation</span>
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      y = {regResult.intercept.toFixed(3)} {regResult.slope >= 0 ? "+" : "−"}{" "}
                      {Math.abs(regResult.slope).toFixed(4)} x
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Slope (β)</span>
                    <span className="font-mono text-xs">{regResult.slope.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Std. Error</span>
                    <span className="font-mono text-xs">{regResult.slopeSe.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">95% CI (slope)</span>
                    <span className="font-mono text-xs">
                      [{regResult.ci95[0].toFixed(4)}, {regResult.ci95[1].toFixed(4)}]
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">R²</span>
                    <span className="font-mono text-xs">{regResult.r2.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pearson r</span>
                    <span className="font-mono text-xs">{r.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">n</span>
                    <span className="font-mono text-xs">{regResult.n}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="text-[10px] text-muted-foreground">
                    CI bounds are computed both analytically (OLS formula, see API <code>/api/regression</code>)
                    and via 200 bootstrap resamples.
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No regression result yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Correlation matrix: social × biophysical */}
      <ChartCard
        title="Cross-Domain Correlation Matrix"
        description="Social drivers (rows) × Soil outcomes & resilience (columns). Computed client-side using Pearson correlation."
        csvData={
          SOCIAL_INDICATORS.map((s, i) => {
            const row: Record<string, unknown> = { indicator: s.label };
            MIXED_COLS.forEach((c, j) => {
              row[getIndicatorMeta(c)?.label || c] = mixedMatrix[i][j];
            });
            return row;
          })
        }
        csvName="cross_domain_correlation.csv"
        pngName="cross_domain_correlation.png"
      >
        <div className="overflow-x-auto scrollbar-soil">
          <table className="text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left sticky left-0 bg-paper"></th>
                {MIXED_COLS.map((c) => (
                  <th key={c} className="p-2 text-center font-medium max-w-[90px] align-bottom">
                    <div className="whitespace-normal leading-tight">{getIndicatorMeta(c)?.label || c}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SOCIAL_INDICATORS.map((rowInd, i) => (
                <tr key={rowInd.key}>
                  <td className="p-2 text-right font-medium whitespace-nowrap sticky left-0 bg-paper border-r border-border">
                    {rowInd.label}
                  </td>
                  {MIXED_COLS.map((colKey, j) => {
                    const v = mixedMatrix[i][j];
                    const intensity = Math.abs(v);
                    const bg = v > 0
                      ? `oklch(0.85 0.07 150 / ${0.15 + intensity * 0.7})`
                      : `oklch(0.7 0.13 50 / ${0.15 + intensity * 0.7})`;
                    return (
                      <td
                        key={colKey}
                        className="p-2 text-center border border-border/30"
                        style={{ background: bg }}
                        title={`${rowInd.label} × ${getIndicatorMeta(colKey)?.label} = ${v.toFixed(3)}`}
                      >
                        <span className="font-mono">{v.toFixed(2)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
