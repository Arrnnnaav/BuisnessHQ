"""Safe, deterministic staging harness for the vendored Pricing Agent.

It validates BusinessOS catalog mapping against the agent's SQLite schema,
generates clearly synthetic competitor history, and writes approval-only price
recommendations. It never calls Gemini or updates the source catalog.
"""

import argparse
import json
import sqlite3
from datetime import date, timedelta
from pathlib import Path

MIN_MARGIN = 0.15
MAX_PRICE_CHANGE = 0.25
COMPETITOR_FACTORS = (0.94, 0.98, 1.01, 1.04)


def positive(value, field, sku):
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{sku}: {field} must be numeric") from error
    if number <= 0:
        raise ValueError(f"{sku}: {field} must be greater than zero")
    return number


def load_catalog(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    products = payload.get("catalog", payload) if isinstance(payload, dict) else payload
    accepted, rejected = [], []
    for item in products:
        sku = str(item.get("sku") or item.get("id") or item.get("name") or "").strip()
        name = str(item.get("name") or "").strip()
        try:
            if not sku or not name:
                raise ValueError("sku and name are required")
            accepted.append({"sku": sku, "name": name, "brand": str(item.get("brand") or "BusinessOS"), "category": str(item.get("category") or "Uncategorized"), "our_price": positive(item.get("price"), "price", sku), "cost": positive(item.get("cost"), "cost", sku), "stock": int(item.get("stock") or 100)})
        except ValueError as error:
            rejected.append({"sku": sku or "unknown", "reason": str(error)})
    return accepted, rejected


def stage(products, database):
    database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database)
    connection.executescript("""
      CREATE TABLE IF NOT EXISTS catalog (sku TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL, category TEXT NOT NULL, our_price REAL NOT NULL, cost REAL NOT NULL, stock INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS competitor_prices (sku TEXT NOT NULL, competitor TEXT NOT NULL, price REAL NOT NULL, in_stock INTEGER NOT NULL, date TEXT NOT NULL, PRIMARY KEY (sku, competitor, date));
    """)
    connection.execute("DELETE FROM catalog"); connection.execute("DELETE FROM competitor_prices")
    connection.executemany("INSERT INTO catalog VALUES (:sku, :name, :brand, :category, :our_price, :cost, :stock)", products)
    history, recommendations = [], []
    today = date.today()
    for product in products:
        latest = []
        for index, factor in enumerate(COMPETITOR_FACTORS):
            competitor = f"Staging Competitor {index + 1}"
            for day in range(7):
                price = round(product["our_price"] * factor * (1 + ((day - 3) * 0.002)), 2)
                history.append((product["sku"], competitor, price, 1, (today - timedelta(days=6-day)).isoformat()))
                if day == 6:
                    latest.append(price)
        competitor_average = sum(latest) / len(latest)
        minimum_price = product["cost"] / (1 - MIN_MARGIN)
        lower_bound, upper_bound = product["our_price"] * (1 - MAX_PRICE_CHANGE), product["our_price"] * (1 + MAX_PRICE_CHANGE)
        proposed = round(min(max(competitor_average, minimum_price, lower_bound), upper_bound), 2)
        recommendations.append({"sku": product["sku"], "current_price": product["our_price"], "competitor_average": round(competitor_average, 2), "recommended_price": proposed, "projected_margin_pct": round((proposed - product["cost"]) / proposed, 4), "confidence": 0.85, "status": "needs-owner-approval", "reasoning": "Deterministic staging recommendation constrained by 15% margin floor and 25% maximum change. No Gemini call and no price was updated."})
    connection.executemany("INSERT INTO competitor_prices VALUES (?, ?, ?, ?, ?)", history); connection.commit(); connection.close()
    return recommendations


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, help="JSON array or object with a catalog array")
    parser.add_argument("--database", default="data/pricing_agent/staging.db")
    parser.add_argument("--output", default="data/pricing_agent/staging-results.json")
    args = parser.parse_args()
    products, rejected = load_catalog(args.catalog)
    results = {"mode": "staging", "external_effects": False, "catalog_items_accepted": len(products), "catalog_items_rejected": rejected, "recommendations": stage(products, Path(args.database)) if products else []}
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps({"accepted": len(products), "rejected": len(rejected), "recommendations": len(results["recommendations"]), "output": str(output)}))


if __name__ == "__main__":
    main()
