import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js API route handler that proxies all `/api/soil/*` requests to the
 * FastAPI backend service running at http://localhost:3042.
 *
 * This keeps the frontend → backend call as a same-origin request from the
 * browser's perspective, while still using the FastAPI service for all data
 * science computations (regression with scikit-learn, simulation, etc.).
 *
 * The FastAPI service exposes:
 *   GET  /api/health
 *   GET  /api/meta
 *   GET  /api/dataset
 *   GET  /api/region-summary
 *   GET  /api/correlation?group=all|biophysical|social|mixed
 *   GET  /api/trend?indicator=X&group_by=region|overall
 *   POST /api/regression     {x, y, control?}
 *   POST /api/simulate       {policy inputs}
 */

const BACKEND_URL = "http://localhost:3042";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${BACKEND_URL}/api/${path.join("/")}`;
  const url = new URL(req.url);
  const search = url.search;
  try {
    const upstream = await fetch(`${target}${search}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "FastAPI upstream unavailable", detail: msg },
      { status: 502 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${BACKEND_URL}/api/${path.join("/")}`;
  let body: string;
  try {
    body = await req.text();
  } catch {
    body = "{}";
  }
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "FastAPI upstream unavailable", detail: msg },
      { status: 502 },
    );
  }
}
