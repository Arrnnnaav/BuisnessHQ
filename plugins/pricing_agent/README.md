# Pricing Agent Integration

The public `Arrnnnaav/Pricing-Agent` source is vendored in `vendor/` at a pinned shallow clone. BusinessOS enables the plugin for discovery and staging, but production price changes are never automatic.

## Staging now

Run from the BusinessOS repository root:

```bat
py -3.12 plugins\pricing_agent\scripts\stage.py --catalog plugins\pricing_agent\tests\fixtures\staging-catalog.json
```

The command creates `data/pricing_agent/staging.db` and `data/pricing_agent/staging-results.json`. It uses the upstream agent's catalog/competitor SQLite structure and the same 15% margin floor plus 25% maximum price-change guardrail. Results are approval-only and have no external effects.

In the dashboard, open **Pricing Staging** after importing a catalog. The bridge runs the same harness per owner workspace and stores the resulting SQLite database and JSON output under `data/pricing_agent/<owner-id>/<run-id>/`.

## Before Gemini production mode

1. Import a real, owner-verified catalog with a SKU, current price, cost, category, and stock.
2. Replace synthetic competitor history with an approved compliant data source.
3. Create an isolated Python virtual environment and install `vendor/requirements.txt`.
4. Put `GEMINI_API_KEY` only in the encrypted BusinessOS credential vault or deployment secret manager—never in source, catalog files, or git.
5. Keep the first production runs in owner-approval mode and verify audit records and price-change rollback.

`scripts/prepare.py` loads only an owner-verified catalog and an approved competitor-price feed into the upstream SQLite schema. `scripts/run_production.py` sets `BUSINESSOS_APPROVAL_MODE=queue`, which returns every recommendation as pending owner approval and prevents the upstream agent from auto-applying or prompting in a terminal.
