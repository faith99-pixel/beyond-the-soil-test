"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
  ReferenceLine,
} from "recharts";
import { ChartCard } from "@/components/soil/chart-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Play, Loader2 } from "lucide-react";
import { soilApi } from "@/lib/soil-api";
import type { FarmRecord, PolicyInputs, SimulationResponse } from "@/lib/soil-types";
import { toast } from "sonner";

interface Props {
  records: FarmRecord[];
}

const DEFAULT_POLICY: PolicyInputs = {
  farmer_training_hours: 8,
  extension_contact_freq: 4,
  financial_incentives: 50,
  soil_testing_subsidies: 50,
  community_engagement: 50,
  horizon_years: 5,
};

const BASELINE_POLICY: PolicyInputs = {
  farmer_training_hours: 0,
  extension_contact_freq: 2,
  financial_incentives: 50,
  soil_testing_subsidies: 50,
  community_engagement: 50,
  horizon_years: 5,
};

export function PolicySimulatorTab({ records: _records }: Props) {
  const [policy, setPolicy] = useState<PolicyInputs>(DEFAULT_POLICY);
  const [baseline, setBaseline] = useState<SimulationResponse | null>(null);
  const [scenario, setScenario] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = async (inputs: PolicyInputs): Promise<SimulationResponse> => {
    return await soilApi.simulate(inputs);
  };

  // Run baseline + default scenario on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [b, s] = await Promise.all([runSimulation(BASELINE_POLICY), runSimulation(DEFAULT_POLICY)]);
        if (!active) return;
        setBaseline(b);
        setScenario(s);
      } catch (e) {
        toast.error("Policy simulation failed — is the FastAPI service running?");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRun = async () => {
    setLoading(true);
    try {
      const result = await runSimulation(policy);
      setScenario(result);
      toast.success("Scenario simulated");
    } catch {
      toast.error("Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPolicy(DEFAULT_POLICY);
  };

  // Comparison bar (final year, scenario vs baseline)
  const comparisonData = scenario && baseline
    ? [
        {
          metric: "Adoption Likelihood",
          baseline: baseline.final.adoption_likelihood,
          scenario: scenario.final.adoption_likelihood,
        },
        {
          metric: "Soil Health Score",
          baseline: baseline.final.soil_health_score,
          scenario: scenario.final.soil_health_score,
        },
        {
          metric: "Resilience Score",
          baseline: baseline.final.resilience_score,
          scenario: scenario.final.resilience_score,
        },
      ]
    : [];

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Introduction */}
      <Card className="bg-paper border-forest-600/30">
        <CardHeader>
          <CardTitle className="text-base">Policy Simulator</CardTitle>
          <CardDescription>
            Adjust the policy levers below to predict adoption likelihood, soil health trajectory and farm
            resilience outcomes under a hypothetical 5-year intervention. The model is calibrated on the synthetic
            demonstration dataset — outcomes are illustrative only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mr-1" />
              Baseline: status-quo intervention
            </Badge>
            <Badge variant="default" className="text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-paper mr-1" />
              Scenario: user-defined intervention
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sliders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Policy Levers</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleReset} className="h-8 text-xs">
                <RotateCcw className="mr-1 h-3 w-3" /> Reset
              </Button>
              <Button size="sm" onClick={handleRun} disabled={loading} className="h-8 text-xs">
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                Run scenario
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <PolicySlider
            label="Farmer Training Hours"
            description="Hours of structured training per farmer per year"
            value={policy.farmer_training_hours}
            min={0}
            max={40}
            step={1}
            unit="hrs/yr"
            onChange={(v) => setPolicy({ ...policy, farmer_training_hours: v })}
          />
          <PolicySlider
            label="Extension Contact Frequency"
            description="Number of extension officer visits per year"
            value={policy.extension_contact_freq}
            min={0}
            max={12}
            step={1}
            unit="visits/yr"
            onChange={(v) => setPolicy({ ...policy, extension_contact_freq: v })}
          />
          <PolicySlider
            label="Financial Incentives"
            description="Index of financial support (subsidies, payments)"
            value={policy.financial_incentives}
            min={0}
            max={100}
            step={5}
            unit="/100"
            onChange={(v) => setPolicy({ ...policy, financial_incentives: v })}
          />
          <PolicySlider
            label="Soil Testing Subsidies"
            description="Index of soil testing cost subsidy"
            value={policy.soil_testing_subsidies}
            min={0}
            max={100}
            step={5}
            unit="/100"
            onChange={(v) => setPolicy({ ...policy, soil_testing_subsidies: v })}
          />
          <PolicySlider
            label="Community Engagement"
            description="Index of community engagement programs"
            value={policy.community_engagement}
            min={0}
            max={100}
            step={5}
            unit="/100"
            onChange={(v) => setPolicy({ ...policy, community_engagement: v })}
          />
          <PolicySlider
            label="Time Horizon"
            description="Number of years to project forward"
            value={policy.horizon_years}
            min={1}
            max={10}
            step={1}
            unit="years"
            onChange={(v) => setPolicy({ ...policy, horizon_years: v })}
          />
        </CardContent>
      </Card>

      {/* Trajectory charts */}
      {scenario ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Adoption Likelihood Trajectory"
            description="Predicted adoption of soil-health practices over time"
            csvData={scenario.adoption_trajectory}
            csvName="adoption_trajectory.csv"
            pngName="adoption_trajectory.png"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scenario.adoption_trajectory} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip formatter={(v: any) => (typeof v === "number" ? v.toFixed(2) : v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="adoption_likelihood" name="Adoption Likelihood" stroke="oklch(0.46 0.1 150)" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="cover_crop_adoption" name="Cover Crop Adoption" stroke="oklch(0.6 0.13 50)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="conservation_tillage" name="Conservation Tillage" stroke="oklch(0.7 0.15 85)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Soil Health Trajectory"
            description="Predicted changes in SOC, SOM, microbial activity"
            csvData={scenario.soil_health_trajectory}
            csvName="soil_trajectory.csv"
            pngName="soil_trajectory.png"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scenario.soil_health_trajectory} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="soc" name="SOC (%)" stroke="oklch(0.46 0.1 150)" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line yAxisId="left" type="monotone" dataKey="som" name="SOM (%)" stroke="oklch(0.55 0.09 80)" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="soil_health_score" name="Soil Health Score" stroke="oklch(0.7 0.15 85)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Farm Resilience Trajectory"
            description="Predicted resilience and adoption readiness"
            csvData={scenario.resilience_trajectory}
            csvName="resilience_trajectory.csv"
            pngName="resilience_trajectory.png"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scenario.resilience_trajectory} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="resilience_score" name="Resilience Score" stroke="oklch(0.46 0.1 150)" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="adoption_readiness" name="Adoption Readiness" stroke="oklch(0.6 0.13 50)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Scenario comparison */}
          <ChartCard
            title="Scenario vs Baseline — Final Year"
            description="Final-year projected outcomes for adoption, soil health, and resilience"
            csvData={comparisonData}
            csvName="scenario_comparison.csv"
            pngName="scenario_comparison.png"
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.012 70)" />
                <XAxis dataKey="metric" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip formatter={(v: any) => (typeof v === "number" ? v.toFixed(2) : v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="baseline" name="Baseline" fill="oklch(0.7 0.04 65)" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="baseline" position="top" style={{ fontSize: 10 }} />
                </Bar>
                <Bar dataKey="scenario" name="Scenario" fill="oklch(0.46 0.1 150)" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="scenario" position="top" style={{ fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running initial simulation…
          </CardContent>
        </Card>
      )}

      {/* Final summary deltas */}
      {scenario ? (
        <Card className="bg-paper">
          <CardHeader>
            <CardTitle className="text-base">Predicted Δ vs Baseline (Final Year)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DeltaCard
              label="Adoption Likelihood"
              delta={scenario.final.adoption_likelihood - (baseline?.final.adoption_likelihood ?? 0)}
              unit="pp"
            />
            <DeltaCard
              label="Soil Health Score"
              delta={scenario.final.soil_health_score - (baseline?.final.soil_health_score ?? 0)}
              unit="pts"
            />
            <DeltaCard
              label="Resilience Score"
              delta={scenario.final.resilience_score - (baseline?.final.resilience_score ?? 0)}
              unit="pts"
            />
            <DeltaCard
              label="SOC Change"
              delta={scenario.final.soc_change}
              unit="%"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface PolicySliderProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

function PolicySlider({ label, description, value, min, max, step, unit, onChange }: PolicySliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-sm font-mono">
          {value}
          <span className="text-[10px] text-muted-foreground ml-1">{unit}</span>
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
      />
      <div className="text-[10px] text-muted-foreground">{description}</div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function DeltaCard({ label, delta, unit }: { label: string; delta: number; unit: string }) {
  const positive = delta >= 0;
  return (
    <div
      className={`rounded-md border p-3 ${
        positive ? "border-forest-600/30 bg-forest-600/5" : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold mt-0.5 ${
          positive ? "text-forest-700" : "text-destructive"
        }`}
      >
        {positive ? "+" : ""}
        {delta.toFixed(2)}
        <span className="text-xs ml-1 text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
