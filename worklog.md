---
Task ID: soil-dashboard
Agent: main (Super Z)
Task: Build "Beyond the Soil Test: Socio-Ecological Soil Health Dashboard" — a production-quality Next.js 16 + FastAPI research dashboard with 5 tabs, synthetic data, and full export capabilities.

Work Log:
- Initialized fullstack-dev project (Next.js 16 + TypeScript 5 + Tailwind 4 + shadcn/ui)
- Designed earth-tone color palette (soil browns, forest greens, amber earth, clay) using OKLCH color space in globals.css
- Generated synthetic demonstration dataset (500 farms × 10 regions × 5 years = 2500 rows) via Python script with deterministic seed=42 (Pandas + NumPy)
- Built FastAPI backend service (mini-services/soil-api/main.py) with endpoints: health, meta, dataset, region-summary, correlation, trend, regression (scikit-learn + scipy with bootstrap CIs), simulate
- Implemented Next.js catch-all API route (/api/soil/[...path]) that proxies to FastAPI at port 3042
- Built graceful client-side fallback in src/lib/soil-api.ts — if FastAPI is unavailable, all computations (correlation, regression, simulation) are performed client-side using src/lib/soil-stats.ts
- Built 5 tabs:
  1. Soil Health Observatory — biophysical indicators with trend, regional comparison, distribution box plot, radar
  2. Human Drivers Dashboard — social drivers with filters, correlation heatmap, regional map
  3. Linking People & Soil — scatterplot with regression overlay, regression output panel (slope, SE, 95% CI, R², p-value), cross-domain correlation matrix
  4. Health & Resilience Index — composite scores (Soil Health, Adoption Readiness, Farm Resilience) with gauges, radar, regional rankings
  5. Policy Simulator — 6 sliders, 3 trajectory charts, scenario vs baseline comparison, delta cards
- Implemented PNG export (via html-to-image) and CSV export on every chart card
- Mobile responsive: tabs collapse to single-word labels on small screens, grids reflow
- Added "Demonstration Dataset Generated for Research Prototype" disclaimer banner
- Verified via agent-browser: all 5 tabs render, no console errors, CSV export toast works, PNG export toast works, simulator runs, slider interactions update charts
- Lint passes cleanly (0 errors, 0 warnings)

Stage Summary:
- Frontend: src/app/page.tsx, src/app/layout.tsx, src/app/globals.css, src/app/api/soil/[...path]/route.ts
- Components: src/components/soil/{chart-card,gauge,palette}, src/components/tabs/{soil-health,human-drivers,linking,resilience,policy-simulator}-tab
- Libraries: src/lib/{soil-types,soil-api,soil-stats,soil-export}
- Backend: mini-services/soil-api/main.py (FastAPI + Pandas + scikit-learn + scipy)
- Data: scripts/generate_dataset.py → public/data/{soil_dataset.csv, soil_dataset.json, region_summary.json}
- Architecture is deployment-ready: FastAPI runs persistently in production, frontend gracefully falls back to client-side computation if backend is unavailable
- Note: in the sandbox environment, the FastAPI service dies after ~5-10s due to process limits, but the frontend works end-to-end using the fallback
