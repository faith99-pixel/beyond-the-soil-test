# Beyond the Soil Test — Socio-Ecological Soil Health Dashboard

A production-quality prototype web application that demonstrates how social and
behavioral drivers can be integrated with biophysical soil-health indicators
to support sustainable land management and agricultural resilience.

Built as a proof-of-concept for doctoral research exploring the human drivers
of soil health and farm resilience.

## Stack

### Frontend (Next.js 16 + TypeScript + Tailwind CSS 4 + Recharts)
- **Framework**: Next.js 16 with App Router (TypeScript 5)
- **UI**: shadcn/ui component library (New York) + Tailwind CSS 4
- **Charts**: Recharts (line, bar, scatter, radar, composed)
- **State**: React hooks + TanStack Query-ready API client with graceful fallback
- **Export**: html-to-image (PNG) + native CSV blobs

### Backend (Python + FastAPI + Pandas + NumPy + scikit-learn)
Located in `mini-services/soil-api/main.py`. Provides:
- `GET  /api/health` — service status
- `GET  /api/meta` — dataset metadata
- `GET  /api/dataset` — filtered dataset access
- `GET  /api/region-summary` — regional aggregates
- `GET  /api/correlation?group=all|biophysical|social|mixed` — Pearson correlation matrix
- `GET  /api/trend?indicator=X&group_by=region|overall` — annual trends
- `POST /api/regression` — OLS linear regression with bootstrap CIs (scikit-learn + scipy)
- `POST /api/simulate` — policy scenario simulation

The backend is exposed through a Next.js catch-all route handler at
`/api/soil/[...path]` which proxies to `http://localhost:3042`. If the FastAPI
service is unavailable, the frontend transparently falls back to client-side
computations using the pre-generated JSON dataset and TypeScript statistics
utilities in `src/lib/soil-stats.ts`.

### Data Science (Python)
- **Pandas** — data manipulation
- **NumPy** — numerical computation
- **scikit-learn** — LinearRegression for OLS with CIs
- **scipy.stats** — t-distribution for p-value & CI computation
- **Data generator** — `scripts/generate_dataset.py` (deterministic seed=42)

## Data

A synthetic demonstration dataset is generated for:
- **500 farms**
- **10 regions** (Northern Rivers, Wheatbelt Central, Coastal Plains, etc.)
- **5 years** (2020–2024)
- **8 biophysical indicators** (SOC, SOM, microbial activity, soil respiration, bulk density, aggregate stability, water holding capacity, pH)
- **8 social drivers** (trust in extension, farmer knowledge, risk perception, peer influence, social norms, network participation, access to soil testing, access to advisory)
- **4 management decisions** (cover crop, soil testing frequency, organic amendments, conservation tillage)
- **3 composite outcomes** (soil health score, adoption readiness, farm resilience score)

All data is **synthetic and clearly labeled** as "Demonstration Dataset Generated for Research Prototype". No real-world claims are made.

Files:
- `public/data/soil_dataset.csv` — full dataset (CSV)
- `public/data/soil_dataset.json` — full dataset (JSON, for the frontend)
- `public/data/region_summary.json` — regional aggregates

## Dashboard Structure

### Tab 1 — Soil Health Observatory
- Interactive indicator selector (8 biophysical indicators)
- Trend over time, by region or overall
- Regional comparison bar chart
- Distribution by region (ComposedChart with IQR bar + min/median/max lines)
- Multi-indicator regional radar profile
- Region, year, and indicator filters

### Tab 2 — Human Drivers Dashboard
- Dynamic filters (indicator, region, year, knowledge-min slider)
- 8 social/behavioral indicators
- Social drivers correlation heatmap (Pearson)
- Trend by region
- Regional comparison bar
- Regional comparison "map" (intensity-tiled grid)

### Tab 3 — Linking People & Soil (the key innovation)
- Preset pairs: Trust vs SOM, Extension vs Cover crop, Peer influence vs Soil testing frequency, Knowledge vs Soil health score
- Configurable X (social) and Y (soil outcome) selectors
- Interactive scatterplot with OLS regression overlay
- Regression output sidebar: slope, SE, 95% CI, R², Pearson r, n, p-value
- Cross-domain correlation matrix (social drivers × soil outcomes & resilience)

### Tab 4 — Soil Health & Resilience Index
- Composite index calculation: Soil Health Score, Adoption Readiness Score, Farm Resilience Score
- Three half-donut gauges
- Composite dimensions radar
- Regional comparative rankings table
- Regional composite radar (top 5 regions)

### Tab 5 — Policy Simulator
- Six sliders: Farmer training hours, Extension contact frequency, Financial incentives, Soil testing subsidies, Community engagement, Time horizon
- Three trajectory charts: Adoption Likelihood, Soil Health, Farm Resilience
- Scenario vs Baseline comparison bar
- Predicted Δ vs Baseline delta cards

## Visual Design

- **Style**: Academic, professional, Murdoch University HDR presentation quality
- **Color palette**: Soil browns, forest greens, neutral earth tones (OKLCH color space)
- **Typography**: Geist Sans + Geist Mono
- **Responsive**: Mobile-first, tabs collapse to single-word labels on small screens
- **Accessibility**: Semantic HTML, ARIA roles, keyboard navigable, focus management

## Export

Every chart card includes:
- **PNG export** — high-resolution (2x pixel ratio) snapshot of the chart container
- **CSV export** — UTF-8 with BOM (Excel-friendly) of the underlying data

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (Next.js client)                  │
│  - React 19 + TypeScript                    │
│  - Recharts visualizations                  │
│  - Tailwind CSS 4 + shadcn/ui               │
│  - soil-stats.ts (client-side fallback)     │
└────────────────┬────────────────────────────┘
                 │  fetch /api/soil/*  (relative)
                 ▼
┌─────────────────────────────────────────────┐
│  Next.js API Route (catch-all proxy)        │
│  src/app/api/soil/[...path]/route.ts        │
└────────────────┬────────────────────────────┘
                 │  HTTP to localhost:3042
                 ▼
┌─────────────────────────────────────────────┐
│  FastAPI Backend Service                    │
│  mini-services/soil-api/main.py             │
│  - Pandas data manipulation                 │
│  - scikit-learn LinearRegression + CIs      │
│  - Policy simulator                         │
└─────────────────────────────────────────────┘
```

If the FastAPI service is unavailable, the frontend automatically uses the
pre-generated JSON dataset and the TypeScript statistics utilities — the
dashboard continues to work end-to-end without any degradation.
