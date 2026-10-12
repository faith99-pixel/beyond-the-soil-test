"""
Synthetic Data Generator for the Socio-Ecological Soil Health Dashboard.

Generates a demonstration dataset for 500 farms across 10 regions over 5 years
with biophysical soil-health indicators, social/behavioral drivers, management
decisions and farm resilience outcomes.

The generator is deterministic (fixed seed) so that the same dataset is produced
on every run, enabling reproducible research-prototype outputs.

NOTE: This is a DEMONSTRATION DATASET GENERATED FOR RESEARCH PROTOTYPE.
No real-world claims are made or implied.
"""
from __future__ import annotations

import json
import math
import os
import random
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SEED = 42
N_FARMS = 500
N_REGIONS = 10
YEARS = list(range(2020, 2025))  # 5 years

REGIONS = [
    {"id": "R01", "name": "Northern Rivers", "climate": "subtropical", "base_soc": 1.8},
    {"id": "R02", "name": "Wheatbelt Central", "climate": "semi-arid", "base_soc": 1.1},
    {"id": "R03", "name": "Coastal Plains", "climate": "temperate-humid", "base_soc": 2.1},
    {"id": "R04", "name": "Highland Slopes", "climate": "cool-temperate", "base_soc": 2.6},
    {"id": "R05", "name": "Murray Basin", "climate": "mediterranean", "base_soc": 1.3},
    {"id": "R06", "name": "Tropical North", "climate": "tropical", "base_soc": 1.9},
    {"id": "R07", "name": "Arid Interior", "climate": "arid", "base_soc": 0.6},
    {"id": "R08", "name": "Foothills East", "climate": "temperate", "base_soc": 1.7},
    {"id": "R09", "name": "Southern Downs", "climate": "sub-humid", "base_soc": 1.4},
    {"id": "R10", "name": "Western Plateau", "climate": "semi-arid", "base_soc": 0.9},
]

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def logistic_with_noise(z: float, noise: float, rng: random.Random) -> bool:
    p = sigmoid(z) + noise
    return rng.random() < clamp(p, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------
def generate() -> pd.DataFrame:
    rng = random.Random(SEED)
    np_rng = np.random.default_rng(SEED)

    rows: list[dict] = []

    # Pre-assign each farm to a region & a stable farmer profile
    farms = []
    region_pool = [r for r in REGIONS for _ in range(N_FARMS // N_REGIONS)]
    rng.shuffle(region_pool)
    for i in range(N_FARMS):
        region = region_pool[i]
        farms.append(
            {
                "farm_id": f"F{i+1:04d}",
                "region_id": region["id"],
                "region_name": region["name"],
                "climate": region["climate"],
                "base_soc": region["base_soc"],
                # Stable farmer traits (don't change across years)
                "farmer_age": int(clamp(np_rng.normal(52, 12), 25, 78)),
                "farm_size_ha": float(round(clamp(np_rng.lognormal(2.7, 0.8), 5, 2500), 1)),
                "education_years": int(clamp(np_rng.normal(12, 3), 4, 20)),
                "experience_years": int(clamp(np_rng.normal(25, 10), 2, 55)),
                # Stable latent disposition toward innovation (drawn once per farm)
                "innovativeness": float(np_rng.beta(2, 3)),
            }
        )

    for farm in farms:
        # Time-invariant farmer-level social traits baseline (with slight drift)
        baseline_trust = clamp(np_rng.normal(55, 18), 0, 100)
        baseline_knowledge = clamp(np_rng.normal(50, 17), 0, 100)
        baseline_risk = clamp(np_rng.normal(50, 16), 0, 100)
        baseline_peer = clamp(np_rng.normal(50, 18), 0, 100)
        baseline_norms = clamp(np_rng.normal(55, 15), 0, 100)
        baseline_participation = clamp(np_rng.normal(45, 20), 0, 100)
        baseline_access_test = clamp(np_rng.normal(50, 22), 0, 100)
        baseline_access_adv = clamp(np_rng.normal(52, 20), 0, 100)

        for yr_idx, year in enumerate(YEARS):
            # Year effect: slow positive drift in social capital & adoption over time
            t = yr_idx / (len(YEARS) - 1)

            # ---------------------------------------------------------------
            # Social drivers (0-100 scales) — drift over time + noise
            # ---------------------------------------------------------------
            trust = clamp(baseline_trust + 5 * t + np_rng.normal(0, 4), 0, 100)
            knowledge = clamp(baseline_knowledge + 8 * t + np_rng.normal(0, 4), 0, 100)
            risk = clamp(baseline_risk + 2 * t + np_rng.normal(0, 5), 0, 100)
            peer = clamp(baseline_peer + 6 * t + np_rng.normal(0, 4), 0, 100)
            norms = clamp(baseline_norms + 4 * t + np_rng.normal(0, 4), 0, 100)
            participation = clamp(baseline_participation + 9 * t + np_rng.normal(0, 5), 0, 100)
            access_test = clamp(baseline_access_test + 7 * t + np_rng.normal(0, 5), 0, 100)
            access_adv = clamp(baseline_access_adv + 6 * t + np_rng.normal(0, 5), 0, 100)

            # ---------------------------------------------------------------
            # Management decisions — driven by social drivers + innovation
            # ---------------------------------------------------------------
            innov = farm["innovativeness"]
            cover_crop_logit = (
                -2.4
                + 0.025 * trust
                + 0.022 * knowledge
                + 0.018 * peer
                + 0.020 * participation
                + 0.6 * innov
                + 0.5 * t
            )
            cover_crop = logistic_with_noise(cover_crop_logit, np_rng.normal(0, 0.05), rng)

            soil_test_freq = max(
                0,
                round(
                    0.4
                    + 0.025 * access_test
                    + 0.020 * knowledge
                    + 0.015 * trust
                    + 0.4 * innov
                    + 0.3 * t
                    + np_rng.normal(0, 0.35),
                    1,
                ),
            ) if (access_test + knowledge) > 60 else float(round(max(0.0, np_rng.normal(0.6, 0.3) + 0.02 * access_test), 1))

            organic_logit = (
                -2.0
                + 0.020 * knowledge
                + 0.018 * norms
                + 0.015 * peer
                + 0.5 * innov
                + 0.4 * t
            )
            organic = logistic_with_noise(organic_logit, np_rng.normal(0, 0.05), rng)

            till_logit = (
                -2.2
                + 0.022 * trust
                + 0.020 * knowledge
                + 0.018 * risk
                + 0.5 * innov
                + 0.5 * t
            )
            conservation_tillage = logistic_with_noise(till_logit, np_rng.normal(0, 0.05), rng)

            # ---------------------------------------------------------------
            # Biophysical soil indicators — driven by management + region + year
            # ---------------------------------------------------------------
            base_soc = farm["base_soc"]
            soc = (
                base_soc
                + 0.45 * cover_crop * (t + 0.5)
                + 0.30 * organic * (t + 0.5)
                + 0.20 * conservation_tillage * (t + 0.5)
                + 0.004 * soil_test_freq
                + 0.01 * (knowledge - 50)
                + np_rng.normal(0, 0.18)
            )
            soc = clamp(soc, 0.2, 5.5)

            # SOM ≈ SOC * 1.724 (Van Bemmelen factor)
            som = soc * 1.724 + np_rng.normal(0, 0.15)
            som = clamp(som, 0.4, 9.5)

            # Microbial activity (mg CO2/kg/day) — increases with SOM and cover crops
            microbial = (
                18 + 8 * som + 4 * cover_crop + 3 * organic + 0.05 * participation
                + np_rng.normal(0, 2.2)
            )
            microbial = clamp(microbial, 5, 80)

            # Soil respiration (mg CO2-C/g/day) — correlated with microbial activity
            respiration = 0.04 * microbial + 0.20 + np_rng.normal(0, 0.06)
            respiration = clamp(respiration, 0.05, 4.5)

            # Bulk density (g/cm3) — decreases with SOM (better structure)
            bulk_density = clamp(1.55 - 0.06 * som - 0.05 * cover_crop + np_rng.normal(0, 0.04), 0.9, 1.7)

            # Aggregate stability (%) — increases with SOM, organic amendments, tillage reduction
            aggregate_stab = clamp(
                30 + 6 * som + 8 * cover_crop + 5 * organic + 7 * conservation_tillage + np_rng.normal(0, 4),
                5, 95,
            )

            # Water holding capacity (%) — improves with SOM & aggregate stability
            whc = clamp(
                22 + 2.5 * som + 0.15 * aggregate_stab + 1.5 * cover_crop + np_rng.normal(0, 2),
                10, 60,
            )

            # pH — region-driven with management influence
            ph_base = {
                "subtropical": 5.4, "semi-arid": 7.2, "temperate-humid": 5.8,
                "cool-temperate": 5.6, "mediterranean": 6.4, "tropical": 5.2,
                "arid": 7.6, "temperate": 6.0, "sub-humid": 6.2,
            }.get(farm["climate"], 6.0)
            ph = clamp(ph_base + 0.4 * organic - 0.2 * cover_crop + np_rng.normal(0, 0.25), 4.2, 8.6)

            # ---------------------------------------------------------------
            # Composite outcomes
            # ---------------------------------------------------------------
            # Soil Health Score (0-100): normalize biophysical indicators
            soil_health_score = clamp(
                15
                + 8 * soc
                + 4 * som
                + 0.6 * microbial
                + 6 * aggregate_stab / 10
                + 0.5 * whc
                - 12 * (bulk_density - 1.0)
                - 3 * abs(ph - 6.5)
                + np_rng.normal(0, 3),
                0, 100,
            )

            # Adoption Readiness Score (0-100): combination of social drivers
            adoption_readiness = clamp(
                0.3 * trust
                + 0.25 * knowledge
                + 0.15 * peer
                + 0.15 * participation
                + 0.1 * access_test
                + 0.05 * access_adv
                + 8 * innov * 10 * 0  # innov already encoded via betas, kept simple
                + 5 * t
                + np_rng.normal(0, 4),
                0, 100,
            )

            # Farm Resilience Score (0-100): combines soil health + adoption readiness + risk perception
            farm_resilience_score = clamp(
                0.40 * soil_health_score
                + 0.30 * adoption_readiness
                + 0.15 * risk
                + 0.10 * participation
                + 0.05 * (100 - abs(farm["farm_size_ha"] - 200))  # mid-size farms slightly more resilient
                + np_rng.normal(0, 3),
                0, 100,
            )

            rows.append(
                {
                    "farm_id": farm["farm_id"],
                    "region_id": farm["region_id"],
                    "region_name": farm["region_name"],
                    "climate": farm["climate"],
                    "year": year,
                    "farmer_age": farm["farmer_age"],
                    "farm_size_ha": farm["farm_size_ha"],
                    "education_years": farm["education_years"],
                    "experience_years": farm["experience_years"],

                    # Biophysical
                    "soc_percent": round(soc, 3),
                    "som_percent": round(som, 3),
                    "microbial_activity": round(microbial, 2),
                    "soil_respiration": round(respiration, 3),
                    "bulk_density": round(bulk_density, 3),
                    "aggregate_stability": round(aggregate_stab, 2),
                    "water_holding_capacity": round(whc, 2),
                    "ph": round(ph, 2),

                    # Social drivers (0-100)
                    "trust_extension": round(trust, 2),
                    "farmer_knowledge": round(knowledge, 2),
                    "risk_perception": round(risk, 2),
                    "peer_influence": round(peer, 2),
                    "social_norms": round(norms, 2),
                    "participation_networks": round(participation, 2),
                    "access_soil_testing": round(access_test, 2),
                    "access_advisory": round(access_adv, 2),

                    # Management decisions
                    "cover_crop_adoption": bool(cover_crop),
                    "soil_testing_frequency": float(soil_test_freq),
                    "organic_amendments": bool(organic),
                    "conservation_tillage": bool(conservation_tillage),

                    # Composite outcomes
                    "soil_health_score": round(soil_health_score, 2),
                    "adoption_readiness": round(adoption_readiness, 2),
                    "farm_resilience_score": round(farm_resilience_score, 2),
                }
            )

    df = pd.DataFrame(rows)
    return df


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
def main() -> None:
    df = generate()
    # Write CSV (used by export feature / external tools)
    csv_path = OUTPUT_DIR / "soil_dataset.csv"
    df.to_csv(csv_path, index=False)
    print(f"Wrote CSV: {csv_path}  ({len(df)} rows)")

    # Write JSON (used by frontend)
    json_path = OUTPUT_DIR / "soil_dataset.json"
    records = df.to_dict(orient="records")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "description": "Demonstration Dataset Generated for Research Prototype",
                    "n_farms": N_FARMS,
                    "n_regions": N_REGIONS,
                    "years": YEARS,
                    "seed": SEED,
                    "disclaimer": "Synthetic data. No real-world claims.",
                },
                "records": records,
            },
            f,
            indent=2,
            default=str,
        )
    print(f"Wrote JSON: {json_path}")

    # Also write a region summary (used by region comparison views)
    summary = (
        df.groupby(["region_id", "region_name"])
        .agg(
            n_farms=("farm_id", "nunique"),
            mean_soc=("soc_percent", "mean"),
            mean_som=("som_percent", "mean"),
            mean_microbial=("microbial_activity", "mean"),
            mean_trust=("trust_extension", "mean"),
            mean_knowledge=("farmer_knowledge", "mean"),
            mean_participation=("participation_networks", "mean"),
            mean_soil_health=("soil_health_score", "mean"),
            mean_resilience=("farm_resilience_score", "mean"),
            mean_adoption=("adoption_readiness", "mean"),
        )
        .reset_index()
    )
    summary_path = OUTPUT_DIR / "region_summary.json"
    summary.to_json(summary_path, orient="records", indent=2)
    print(f"Wrote region summary: {summary_path}")


if __name__ == "__main__":
    main()
