/**
 * PNG and CSV export utilities.
 *
 * PNG export uses html-to-image to snapshot arbitrary DOM chart containers.
 * CSV export builds a UTF-8 BOM CSV blob and triggers a download.
 */

import type { FarmRecord } from "./soil-types";

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  const csv = "\ufeff" + lines.join("\n"); // BOM for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Snapshot a DOM node (a chart container) to PNG and trigger download.
 * Uses the lightweight `html-to-image` library.
 */
export async function downloadPNG(element: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  // Apply a white background to ensure exported PNGs are readable
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    style: { background: "#ffffff" },
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportFarmRecords(records: FarmRecord[], filename = "soil_dataset_export.csv") {
  downloadCSV(filename, records as unknown as Record<string, unknown>[]);
}
