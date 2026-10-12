"use client";

import { useRef, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadCSV, downloadPNG } from "@/lib/soil-export";
import { toast } from "sonner";

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  csvData?: Record<string, unknown>[];
  csvName?: string;
  pngName?: string;
  actions?: ReactNode;
}

/**
 * Reusable wrapper card for charts that:
 *  - provides consistent header, description, padding
 *  - includes a PNG export button (snapshots the chart container via internal ref)
 *  - optionally includes a CSV export button
 */
export function ChartCard({
  title,
  description,
  children,
  className,
  csvData,
  csvName,
  pngName,
  actions,
}: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  const handlePng = async () => {
    const node = chartRef.current;
    if (!node) return;
    try {
      await downloadPNG(node, pngName || `${title.toLowerCase().replace(/\s+/g, "-")}.png`);
      toast.success("Chart exported as PNG");
    } catch (e) {
      console.error("PNG export failed:", e);
      toast.error("Failed to export PNG");
    }
  };
  const handleCsv = () => {
    if (!csvData) return;
    downloadCSV(csvName || `${title.toLowerCase().replace(/\s+/g, "-")}.csv`, csvData);
    toast.success("Data exported as CSV");
  };

  return (
    <Card className={`overflow-hidden ${className || ""}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
          {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {csvData ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleCsv}
              title="Export data as CSV"
            >
              <Download className="mr-1 h-3 w-3" />
              CSV
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={handlePng}
            title="Export chart as PNG"
          >
            <Download className="mr-1 h-3 w-3" />
            PNG
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={chartRef} className="p-2 pt-0 sm:p-4 sm:pt-0">
        {children}
      </CardContent>
    </Card>
  );
}
