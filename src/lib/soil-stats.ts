/**
 * Client-side statistical utilities (used as fallback when FastAPI is restarting,
 * and for fast local computations that don't need the full Pandas/sklearn stack).
 *
 * These mirror the FastAPI computations but run entirely in the browser.
 */
import type { FarmRecord } from "./soil-types";

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function min(xs: number[]): number {
  return xs.length ? Math.min(...xs) : 0;
}

export function max(xs: number[]): number {
  return xs.length ? Math.max(...xs) : 0;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = x[i] - mx;
    const ay = y[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export function linearRegression(
  x: number[],
  y: number[],
): { slope: number; intercept: number; r2: number; slopeSe: number; ci95: [number, number]; n: number } {
  const n = Math.min(x.length, y.length);
  if (n < 3) return { slope: 0, intercept: 0, r2: 0, slopeSe: 0, ci95: [0, 0], n };
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  // R²
  let sse = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const yhat = slope * x[i] + intercept;
    sse += (y[i] - yhat) ** 2;
    sst += (y[i] - my) ** 2;
  }
  const r2 = sst === 0 ? 0 : 1 - sse / sst;
  // Standard error of slope
  const sigma2 = sse / Math.max(1, n - 2);
  const slopeSe = den === 0 ? 0 : Math.sqrt(sigma2 / den);
  // Approx 95% CI using normal approximation (good for n > 30)
  const ci95: [number, number] = [slope - 1.96 * slopeSe, slope + 1.96 * slopeSe];
  return { slope, intercept, r2, slopeSe, ci95, n };
}

export function correlationMatrix(
  records: FarmRecord[],
  columns: string[],
): number[][] {
  const n = columns.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const xs = records.map((r) => Number((r as unknown as Record<string, unknown>)[columns[i]]));
      const ys = records.map((r) => Number((r as unknown as Record<string, unknown>)[columns[j]]));
      const c = i === j ? 1 : pearson(xs, ys);
      matrix[i][j] = c;
      matrix[j][i] = c;
    }
  }
  return matrix;
}

export function summarize(records: FarmRecord[], key: keyof FarmRecord) {
  const xs = records.map((r) => Number(r[key]));
  return {
    mean: mean(xs),
    std: std(xs),
    min: min(xs),
    max: max(xs),
    median: median(xs),
    q25: quantile(xs, 0.25),
    q75: quantile(xs, 0.75),
    n: xs.length,
  };
}

export function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
