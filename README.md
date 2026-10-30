# Beyond the Soil Test

Socio-ecological soil health dashboard that links **biophysical soil indicators** with **social and behavioral drivers** of farm management. It is a research prototype for exploring sustainable land management and agricultural resilience.

All figures come from a **synthetic demonstration dataset**. No real-world claims are made.

## Features

Five views in one dashboard:

1. **Soil Health Observatory** — biophysical indicators (SOC, SOM, microbial activity, and related measures), trends, regional comparison, distributions, and radar profiles
2. **Human Drivers** — social/behavioral indicators, filters, correlation heatmap, and regional comparison
3. **Linking People & Soil** — scatterplots with OLS regression (slope, SE, 95% CI, R², p-value) and a cross-domain correlation matrix
4. **Health & Resilience Index** — composite soil health, adoption readiness, and farm resilience scores
5. **Policy Simulator** — sliders for training, extension, incentives, subsidies, community engagement, and time horizon, with scenario vs baseline trajectories

Every chart card can export **PNG** (snapshot) and **CSV** (underlying data).

## Stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts |
| Backend | FastAPI, Pandas, NumPy, scikit-learn, SciPy |
| Data | Deterministic Python generator (`seed=42`) |

The Next.js app proxies `/api/soil/*` to FastAPI on port **3042**. If the Python service is down, the client loads `public/data/*.json` and computes correlations, regression, and simulation in TypeScript (`src/lib/soil-stats.ts`).

## Dataset

Synthetic panel:

- **500 farms** across **10 regions** over **5 years** (2020–2024) — 2,500 rows
- **8 biophysical** indicators (SOC, SOM, microbial activity, soil respiration, bulk density, aggregate stability, water holding capacity, pH)
- **8 social** drivers (trust in extension, knowledge, risk perception, peer influence, social norms, networks, access to testing and advisory)
- **4 management** decisions (cover crop, soil testing frequency, organic amendments, conservation tillage)
- **3 composite** outcomes (soil health score, adoption readiness, farm resilience)

Files:

- `public/data/soil_dataset.csv`
- `public/data/soil_dataset.json`
- `public/data/region_summary.json`

Regenerate with:

```bash
python scripts/generate_dataset.py
```

Requires Pandas and NumPy.

## Quick start

### Prerequisites

- Node.js 20+ (or [Bun](https://bun.sh))
- Python 3.10+ (optional; only needed for the FastAPI service or regenerating data)

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Backend (optional)

From the repo root:

```bash
pip install fastapi uvicorn pandas numpy scikit-learn scipy pydantic
python mini-services/soil-api/main.py
```

The API listens on [http://localhost:3042](http://localhost:3042). Docs: [http://localhost:3042/docs](http://localhost:3042/docs).

Keep the Next.js app running as well. Browser requests go to `/api/soil/...`; Next.js forwards them to FastAPI.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Serve the standalone build (Bun) |
| `npm run lint` | ESLint |

## API (FastAPI)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service status |
| GET | `/api/meta` | Dataset metadata |
| GET | `/api/dataset` | Filtered records |
| GET | `/api/region-summary` | Regional aggregates |
| GET | `/api/correlation` | Pearson matrix (`group=all\|biophysical\|social\|mixed`) |
| GET | `/api/trend` | Annual trends |
| POST | `/api/regression` | OLS with bootstrap confidence intervals |
| POST | `/api/simulate` | Policy scenario simulation |

The Next.js proxy lives at `src/app/api/soil/[...path]/route.ts`.

## Architecture

```
Browser (Next.js + Recharts)
        │  fetch /api/soil/*
        ▼
Next.js catch-all route
        │  http://localhost:3042
        ▼
FastAPI  ←  public/data/soil_dataset.csv

Fallback: public/data/*.json + src/lib/soil-stats.ts
```

## Project layout

```
src/app/                    # App Router pages, layout, API proxy
src/components/tabs/        # Five dashboard tabs
src/components/soil/        # Chart cards, gauges, palette
src/lib/                    # Types, API client, stats, export
mini-services/soil-api/     # FastAPI service
scripts/generate_dataset.py # Synthetic data generator
public/data/                # CSV + JSON demonstration data
```

## Disclaimer

This is a **demonstration dataset generated for a research prototype**. Outputs are synthetic and intended only to show the dashboard concept. They should not be used as evidence of real soil, farm, or policy outcomes.
