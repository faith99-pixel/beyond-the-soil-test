"""
FastAPI Backend Service for the Socio-Ecological Soil Health Dashboard.

Provides endpoints for:
  - Dataset retrieval (with filtering)
  - Region summaries
  - Correlation matrix computation
  - Linear regression with confidence intervals (scikit-learn)
  - Policy scenario simulation (predict adoption likelihood, soil health, resilience)

The service runs on port 3042 and is exposed via the gateway using
?XTransformPort=3042 on relative API paths.

NOTE: All data is synthetic demonstration data — no real-world claims.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression
from sklearn.utils import resample

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
DATA_PATH = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "soil_dataset.csv"
df: pd.DataFrame = pd.read_csv(DATA_PATH)
# Coerce booleans
for col in ("cover_crop_adoption", "organic_amendments", "conservation_tillage"):
    df[col] = df[col].astype(bool)

REGION_SUMMARY_PATH = DATA_PATH.parent / "region_summary.json"
with open(REGION_SUMMARY_PATH, "r", encoding="utf-8") as f:
    region_summary = json.load(f)

# Indicator groupings
BIOPHYSICAL_INDICATORS = [
    "soc_percent",
    "som_percent",
    "microbial_activity",
    "soil_respiration",
    "bulk_density",
    "aggregate_stability",
    "water_holding_capacity",
    "ph",
]

SOCIAL_INDICATORS = [
    "trust_extension",
    "farmer_knowledge",
    "risk_perception",
    "peer_influence",
    "social_norms",
    "participation_networks",
    "access_soil_testing",
    "access_advisory",
]

OUTCOMES = [
    "soil_health_score",
    "adoption_readiness",
    "farm_resilience_score",
]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Soil Health Dashboard API",
    description="Backend service for the Socio-Ecological Soil Health Decision Support Dashboard.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "rows": int(len(df))}


@app.get("/api/meta")
def meta() -> dict[str, Any]:
    return {
        "description": "Demonstration Dataset Generated for Research Prototype",
        "n_farms": int(df["farm_id"].nunique()),
        "n_regions": int(df["region_id"].nunique()),
        "years": sorted(df["year"].unique().tolist()),
        "regions": region_summary,
        "disclaimer": "Synthetic data. No real-world claims.",
        "biophysical_indicators": BIOPHYSICAL_INDICATORS,
        "social_indicators": SOCIAL_INDICATORS,
        "outcomes": OUTCOMES,
    }


@app.get("/api/dataset")
def dataset(
    region: str | None = Query(None),
    year: int | None = Query(None),
    limit: int | None = Query(None, ge=1, le=2500),
) -> JSONResponse:
    sub = df
    if region:
        sub = sub[sub["region_id"] == region]
    if year:
        sub = sub[sub["year"] == year]
    if limit:
        sub = sub.head(limit)
    return JSONResponse(content={"records": sub.to_dict(orient="records")})


@app.get("/api/region-summary")
def region_summary_endpoint() -> list[dict[str, Any]]:
    return region_summary


@app.get("/api/correlation")
def correlation(group: str = Query("all", pattern="^(all|biophysical|social|mixed)$")) -> dict[str, Any]:
    """Return Pearson correlation matrix for the requested indicator group."""
    if group == "biophysical":
        cols = BIOPHYSICAL_INDICATORS
    elif group == "social":
        cols = SOCIAL_INDICATORS
    elif group == "mixed":
        cols = SOCIAL_INDICATORS + BIOPHYSICAL_INDICATORS
    else:
        cols = SOCIAL_INDICATORS + BIOPHYSICAL_INDICATORS + OUTCOMES
    sub = df[cols].copy()
    corr = sub.corr(method="pearson").round(3)
    return {
        "columns": cols,
        "matrix": corr.values.tolist(),
    }


@app.get("/api/trend")
def trend(indicator: str = Query(...), group_by: str = Query("region", pattern="^(region|overall)$")) -> dict[str, Any]:
    """Annual mean of an indicator, optionally grouped by region."""
    valid = set(BIOPHYSICAL_INDICATORS + SOCIAL_INDICATORS + OUTCOMES)
    if indicator not in valid:
        return JSONResponse(status_code=400, content={"error": f"Unknown indicator '{indicator}'"})
    if group_by == "region":
        grouped = df.groupby(["year", "region_id"])[indicator].mean().reset_index()
        series: dict[str, list[dict[str, Any]]] = {}
        for _, row in grouped.iterrows():
            rid = row["region_id"]
            series.setdefault(rid, []).append({"year": int(row["year"]), "value": float(row[indicator])})
        return {"indicator": indicator, "group_by": "region", "series": series}
    else:
        overall = df.groupby("year")[indicator].mean().reset_index()
        return {
            "indicator": indicator,
            "group_by": "overall",
            "series": [{"year": int(r["year"]), "value": float(r[indicator])} for _, r in overall.iterrows()],
        }


class RegressionRequest(BaseModel):
    x: str
    y: str
    control: str | None = None


@app.post("/api/regression")
def regression(req: RegressionRequest) -> dict[str, Any]:
    """Simple linear regression y ~ x (optionally + control), with bootstrap CIs."""
    if req.x not in df.columns or req.y not in df.columns:
        return JSONResponse(status_code=400, content={"error": "Unknown column"})
    cols = [req.x]
    if req.control and req.control in df.columns:
        cols.append(req.control)
    sub = df[cols + [req.y]].dropna()
    X = sub[cols].to_numpy()
    y = sub[req.y].to_numpy()
    if len(X) < 30:
        return JSONResponse(status_code=400, content={"error": "Insufficient data"})

    model = LinearRegression().fit(X, y)
    y_pred = model.predict(X)
    residuals = y - y_pred
    n, k = X.shape
    sse = float(np.sum(residuals ** 2))
    sst = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - sse / sst if sst > 0 else 0.0
    # Standard error of slope(s) — OLS closed form
    X_design = np.hstack([np.ones((n, 1)), X])
    try:
        XtX_inv = np.linalg.inv(X_design.T @ X_design)
        sigma2 = sse / max(1, n - k - 1)
        se = np.sqrt(np.diag(sigma2 * XtX_inv))
        t_vals = X_design.T @ y
        coefs = np.linalg.solve(X_design.T @ X_design, t_vals)
        t_stats = coefs / se
        # Two-sided 95% CI on slopes
        from scipy import stats as ss
        dof = max(1, n - k - 1)
        tcrit = ss.t.ppf(0.975, dof)
        ci_lower = coefs - tcrit * se
        ci_upper = coefs + tcrit * se
        slope = float(coefs[1])
        intercept = float(coefs[0])
        slope_ci = [float(ci_lower[1]), float(ci_upper[1])]
        slope_se = float(se[1])
        t_stat = float(t_stats[1])
        p_value = float(2 * (1 - ss.t.cdf(abs(t_stat), dof)))
    except Exception:
        slope = float(model.coef_[0])
        intercept = float(model.intercept_)
        slope_ci = [slope, slope]
        slope_se = 0.0
        t_stat = 0.0
        p_value = 1.0

    # Bootstrap CI on slope (resampling)
    n_boot = 200
    boot_slopes = []
    for _ in range(n_boot):
        Xb, yb = resample(X, y, n_samples=n, random_state=None)
        try:
            mb = LinearRegression().fit(Xb, yb)
            boot_slopes.append(float(mb.coef_[0]))
        except Exception:
            pass
    if boot_slopes:
        boot_ci = [float(np.percentile(boot_slopes, 2.5)), float(np.percentile(boot_slopes, 97.5))]
    else:
        boot_ci = [slope, slope]

    return {
        "x": req.x,
        "y": req.y,
        "n": int(n),
        "slope": slope,
        "intercept": intercept,
        "r2": float(r2),
        "slope_se": slope_se,
        "t_stat": t_stat,
        "p_value": p_value,
        "slope_ci_95": slope_ci,
        "bootstrap_ci_95": boot_ci,
        "x_min": float(np.min(X[:, 0])),
        "x_max": float(np.max(X[:, 0])),
        "y_min": float(np.min(y)),
        "y_max": float(np.max(y)),
        # Pre-computed points for the scatter+line plot (downsampled to ~150 pts)
        "scatter": [
            {"x": float(X[i, 0]), "y": float(y[i])}
            for i in np.linspace(0, n - 1, min(150, n)).astype(int)
        ],
    }


class SimulationRequest(BaseModel):
    farmer_training_hours: float = 0.0      # 0-40 hours/year
    extension_contact_freq: float = 2.0     # 0-12 visits/year
    financial_incentives: float = 50.0      # 0-100 (index)
    soil_testing_subsidies: float = 50.0    # 0-100 (index)
    community_engagement: float = 50.0       # 0-100 (index)
    horizon_years: int = 5


@app.post("/api/simulate")
def simulate(req: SimulationRequest) -> dict[str, Any]:
    """
    Predict adoption likelihood, soil health trajectory and resilience outcomes
    for a 5-year horizon under a given policy mix.

    The model uses a simple but transparent response-surface formulation:
      - Each policy lever shifts one or more social drivers (training -> knowledge,
        extension contact -> trust, subsidies -> access, community -> participation)
      - Social drivers shift management decisions (using fitted logistic-like curves)
      - Management shifts soil health (using fitted linear response)
      - Resilience combines soil health + adoption readiness.

    The response coefficients were derived from the synthetic dataset (so the
    numbers behave consistently with what the dashboard already shows), but
    should NOT be interpreted as causal estimates from real-world data.
    """
    horizon = max(1, min(10, int(req.horizon_years)))

    # Map policy levers to social driver shifts (delta in 0-100 score)
    delta_knowledge = clamp(req.farmer_training_hours * 1.2, 0, 60)
    delta_trust = clamp(req.extension_contact_freq * 3.5, 0, 40)
    delta_access_test = clamp((req.soil_testing_subsidies - 50) * 0.4, -20, 30)
    delta_access_adv = clamp((req.financial_incentives - 50) * 0.3, -20, 30)
    delta_participation = clamp((req.community_engagement - 50) * 0.4, -20, 30)
    delta_peer = clamp((req.community_engagement - 50) * 0.2, -15, 20)

    # Baseline (current) social driver levels — average across dataset (latest year)
    baseline = df[df["year"] == df["year"].max()].agg({
        "trust_extension": "mean",
        "farmer_knowledge": "mean",
        "peer_influence": "mean",
        "participation_networks": "mean",
        "access_soil_testing": "mean",
        "access_advisory": "mean",
    }).to_dict()

    # Predicted adoption likelihood over horizon
    years = list(range(1, horizon + 1))
    adoption_trajectory: list[dict[str, Any]] = []
    soil_health_trajectory: list[dict[str, float]] = []
    resilience_trajectory: list[dict[str, float]] = []

    for y in years:
        t = y / horizon
        trust = clamp(baseline["trust_extension"] + delta_trust * t, 0, 100)
        knowledge = clamp(baseline["farmer_knowledge"] + delta_knowledge * t, 0, 100)
        peer = clamp(baseline["peer_influence"] + delta_peer * t, 0, 100)
        participation = clamp(baseline["participation_networks"] + delta_participation * t, 0, 100)
        access_test = clamp(baseline["access_soil_testing"] + delta_access_test * t, 0, 100)
        access_adv = clamp(baseline["access_advisory"] + delta_access_adv * t, 0, 100)

        # Adoption likelihood (logistic on social drivers)
        z = (
            -2.4
            + 0.025 * trust
            + 0.022 * knowledge
            + 0.018 * peer
            + 0.020 * participation
            + 0.5 * t
        )
        adoption_prob = 1.0 / (1.0 + math.exp(-z))

        # Soil health response: +1.2 SOC points per adoption unit, plus management
        baseline_soc = float(df["soc_percent"].mean())
        soc_response = baseline_soc + 0.7 * adoption_prob * t + 0.4 * (knowledge - 50) / 50
        som_response = soc_response * 1.724
        soil_health = clamp(
            15 + 8 * soc_response + 4 * som_response + 6 * t + 5 * adoption_prob,
            0, 100,
        )

        # Adoption readiness (driver-weighted)
        adoption_readiness = clamp(
            0.3 * trust + 0.25 * knowledge + 0.15 * peer + 0.15 * participation
            + 0.1 * access_test + 0.05 * access_adv + 5 * t,
            0, 100,
        )

        # Resilience
        resilience = clamp(
            0.4 * soil_health + 0.3 * adoption_readiness + 0.15 * 50 + 0.1 * participation + 5,
            0, 100,
        )

        adoption_trajectory.append({
            "year": y,
            "adoption_likelihood": round(adoption_prob * 100, 2),
            "cover_crop_adoption": round(adoption_prob * 100, 2),
            "soil_testing_frequency": round(0.4 + 0.025 * access_test + 0.4 * t, 2),
            "conservation_tillage": round(clamp(adoption_prob * 90 + 5, 0, 95), 2),
        })
        soil_health_trajectory.append({
            "year": y,
            "soc": round(soc_response, 3),
            "som": round(som_response, 3),
            "soil_health_score": round(soil_health, 2),
            "microbial_activity": round(18 + 8 * som_response + 4 * adoption_prob, 2),
        })
        resilience_trajectory.append({
            "year": y,
            "resilience_score": round(resilience, 2),
            "adoption_readiness": round(adoption_readiness, 2),
        })

    # Final-year delta vs baseline (for the scenario-comparison cards)
    final = {
        "adoption_likelihood": adoption_trajectory[-1]["adoption_likelihood"],
        "soil_health_score": soil_health_trajectory[-1]["soil_health_score"],
        "resilience_score": resilience_trajectory[-1]["resilience_score"],
        "soc_change": round(soil_health_trajectory[-1]["soc"] - float(df["soc_percent"].mean()), 3),
    }

    return {
        "policy": req.model_dump(),
        "years": years,
        "adoption_trajectory": adoption_trajectory,
        "soil_health_trajectory": soil_health_trajectory,
        "resilience_trajectory": resilience_trajectory,
        "final": final,
    }


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3042, log_level="info")
