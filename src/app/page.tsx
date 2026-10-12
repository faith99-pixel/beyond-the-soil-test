"use client";

import { useEffect, useMemo, useState } from "react";
import { Sprout, Users, Link2, Gauge as GaugeIcon, SlidersHorizontal, Database, AlertCircle, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { soilApi } from "@/lib/soil-api";
import type { FarmRecord, MetaInfo, RegionSummary } from "@/lib/soil-types";
import { SoilHealthTab } from "@/components/tabs/soil-health-tab";
import { HumanDriversTab } from "@/components/tabs/human-drivers-tab";
import { LinkingTab } from "@/components/tabs/linking-tab";
import { ResilienceTab } from "@/components/tabs/resilience-tab";
import { PolicySimulatorTab } from "@/components/tabs/policy-simulator-tab";
import { toast } from "sonner";

const TABS = [
  { id: "observatory", label: "Soil Health Observatory", icon: Sprout },
  { id: "drivers", label: "Human Drivers", icon: Users },
  { id: "linking", label: "Linking People & Soil", icon: Link2 },
  { id: "resilience", label: "Health & Resilience Index", icon: GaugeIcon },
  { id: "policy", label: "Policy Simulator", icon: SlidersHorizontal },
] as const;

export default function Page() {
  const [tab, setTab] = useState<string>("observatory");
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [records, setRecords] = useState<FarmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load metadata + a (potentially filtered) slice of records up-front.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [metaResp, regionsResp, dsResp] = await Promise.all([
          soilApi.meta(),
          soilApi.regionSummary(),
          soilApi.dataset({ limit: 2500 }),
        ]);
        if (!active) return;
        setMeta(metaResp);
        setRegions(regionsResp);
        setRecords(dsResp.records);
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error("Failed to load dataset from FastAPI service.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const datasetSummary = useMemo(() => {
    if (!meta) return null;
    return {
      farms: meta.n_farms,
      regions: meta.n_regions,
      years: meta.years.length,
      records: records.length,
    };
  }, [meta, records]);

  return (
    <div className="min-h-screen flex flex-col bg-soil-gradient">
      {/* Header */}
      <header className="border-b border-border/60 bg-paper/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-forest-600 to-soil-600 flex items-center justify-center text-white shadow-sm">
              <Sprout className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight sm:text-base">
                Beyond the Soil Test
              </div>
              <div className="text-[11px] text-muted-foreground">
                Socio-Ecological Soil Health Decision Support Dashboard
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {datasetSummary ? (
              <>
                <Badge variant="outline" className="bg-paper text-xs">
                  <Database className="mr-1 h-3 w-3" />
                  {datasetSummary.farms} farms · {datasetSummary.regions} regions · {datasetSummary.years} yrs
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Demonstration Dataset
                </Badge>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="border-b border-border/60 bg-paper/60">
        <div className="mx-auto w-full max-w-[1400px] px-2 sm:px-6 lg:px-8">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-transparent h-auto p-0 flex w-full justify-start overflow-x-auto scrollbar-soil gap-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-forest-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-3 sm:py-3 text-xs sm:text-sm gap-1.5 whitespace-nowrap"
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">
                      {t.label.split(" ")[0]}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Disclaimer banner */}
            <div className="py-2">
              <Alert className="border-amber-earth/40 bg-amber-earth/5">
                <AlertCircle className="h-4 w-4 text-amber-earth" />
                <AlertDescription className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Demonstration Dataset Generated for Research Prototype.</strong>{" "}
                  All figures are synthetic and intended only to demonstrate the dashboard concept for doctoral
                  research. No real-world claims are made or implied.
                </AlertDescription>
              </Alert>
            </div>

            <div className="pb-8">
              {error ? (
                <Alert variant="destructive" className="m-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>API Error</AlertTitle>
                  <AlertDescription className="text-xs">
                    {error}. The FastAPI service at port 3042 may not be running. Refresh to retry.
                  </AlertDescription>
                </Alert>
              ) : null}

              {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading synthetic demonstration dataset…
                </div>
              ) : (
                <>
                  <TabsContent value="observatory" className="mt-0 focus-visible:outline-none">
                    <SoilHealthTab records={records} regions={regions} />
                  </TabsContent>
                  <TabsContent value="drivers" className="mt-0 focus-visible:outline-none">
                    <HumanDriversTab records={records} regions={regions} />
                  </TabsContent>
                  <TabsContent value="linking" className="mt-0 focus-visible:outline-none">
                    <LinkingTab records={records} />
                  </TabsContent>
                  <TabsContent value="resilience" className="mt-0 focus-visible:outline-none">
                    <ResilienceTab records={records} regions={regions} />
                  </TabsContent>
                  <TabsContent value="policy" className="mt-0 focus-visible:outline-none">
                    <PolicySimulatorTab records={records} />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>
      </nav>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-paper/80">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="font-medium text-foreground">Beyond the Soil Test</span> — Socio-Ecological Soil Health
            Dashboard · Doctoral Research Prototype
          </div>
          <div className="flex items-center gap-3">
            <span>Backend: FastAPI · Pandas · NumPy · scikit-learn</span>
            <span>·</span>
            <span>Frontend: Next.js · TypeScript · Tailwind · Recharts</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
