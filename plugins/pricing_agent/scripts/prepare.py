"""Prepare the upstream Pricing Agent SQLite database from verified inputs.

Production runs require a catalog plus an approved competitor-price feed. This
script never synthesizes competitor data: staging uses stage.py for that.
"""

import argparse
import json
import sqlite3
from pathlib import Path


def load(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return payload.get("catalog", payload) if isinstance(payload, dict) else payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--competitor-feed", required=True, help="Verified JSON rows: sku, competitor, price, in_stock, date")
    parser.add_argument("--database", default="plugins/pricing_agent/vendor/data/pricing_agent.db")
    args = parser.parse_args()
    catalog, feed = load(args.catalog), load(args.competitor_feed)
    database = Path(args.database); database.parent.mkdir(parents=True, exist_ok=True)
    schema = Path("plugins/pricing_agent/vendor/db/schema.sql").read_text(encoding="utf-8")
    connection = sqlite3.connect(database); connection.executescript(schema)
    connection.execute("DELETE FROM catalog"); connection.execute("DELETE FROM competitor_prices")
    rows = []
    for item in catalog:
        price, cost = float(item["price"]), float(item["cost"])
        if price <= 0 or cost <= 0: raise ValueError(f"Invalid price/cost for {item.get('sku')}")
        rows.append({"sku": item["sku"], "name": item["name"], "brand": item.get("brand", "BusinessOS"), "category": item.get("category", "Uncategorized"), "our_price": price, "cost": cost, "stock": int(item.get("stock", 100))})
    connection.executemany("INSERT INTO catalog VALUES (:sku, :name, :brand, :category, :our_price, :cost, :stock)", rows)
    connection.executemany("INSERT INTO competitor_prices VALUES (:sku, :competitor, :price, :in_stock, :date)", feed)
    connection.commit(); connection.close(); print(json.dumps({"catalog_items": len(rows), "competitor_prices": len(feed), "database": str(database)}))


if __name__ == "__main__":
    main()
