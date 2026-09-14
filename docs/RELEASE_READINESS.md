# BusinessOS release readiness

Last verified: 2026-09-12

## Decision

The repository is ready for local staging and a tightly controlled, read-only/recommendation-only customer pilot after the operational pilot gate passes. It is not ready for an unrestricted production launch or autonomous writes to customer systems.

Run the gates from the repository root:

```powershell
npm run release:check
npm test
npm run lint
npm run build
```

The real-customer pilot gate additionally requires explicit operational attestations. These variables are confirmations, not credentials; secrets remain in the encrypted tenant vault or deployment secret manager.

```powershell
$env:CUSTOMER_PILOT_APPROVED="1"
$env:OPERATOR_TOKEN="replace-with-a-unique-random-token-at-least-32-characters"
$env:BUSINESSOS_AI_CONFIGURED="1"
$env:BUSINESSOS_TLS_TERMINATED="1"
$env:BUSINESSOS_BACKUP_CONFIGURED="1"
$env:BUSINESSOS_EXTERNAL_WRITES="0"
npm run release:pilot
```

Never set an attestation until it has actually been verified for the named customer deployment.

## Plugin inventory

| Plugin | Stage | Customer install | Current quality boundary |
|---|---|---:|---|
| Catalog | Pilot | Yes | Workbook grid, multi-file CSV/XLSX import, XLSX export, dynamic rows/columns, cell editing and merges are implemented and tested. |
| SEO | Pilot | Yes | Public crawl, Search Console evidence import, opportunity detection, grounded proposal, approval, staging-only WordPress draft and verification are implemented. AI and WordPress steps need configured integrations. |
| Pricing | Pilot | Yes | Catalog validation, isolated Python staging run, recommendation history and dashboard workspace are implemented. It never applies prices. |
| AI Meta Ads Team | Preview | Yes | Seven employees, orchestrator, contracts, workflow, experiment/safety/metric logic and dashboard are implemented. It creates recommendations only; Meta writes are absent. |
| Pricing Agent | Internal | No | Tested Python adapter used by Pricing; intentionally not a separate customer app. |
| Analytics | Planned | No | Manifest only. |
| Campaigns | Planned | No | Manifest only. |
| Competitors | Planned | No | Manifest only. |
| Content | Planned | No | Manifest only. |
| CRM | Planned | No | Manifest only. |
| Email | Planned | No | Manifest only; first-party email packages are contracts, not a connected mail provider. |
| Google Business | Planned | No | Manifest/notes only. |
| Projects | Planned | No | Manifest only. |
| Quotations | Planned | No | Manifest only. |
| Reviews | Planned | No | Manifest only. |
| Social | Planned | No | Manifest only. |
| Website | Planned | No | Manifest only. |
| WhatsApp | Planned | No | Manifest only. |

All 18 entries remain visible in the marketplace. Planned/internal entries are server-blocked from customer installation; this cannot be bypassed by changing the button in the browser.

## Agent, skill, and connector inventory

Eight signed first-party package definitions are seeded:

- Agents: `email-operations`, `seo-growth`, `meta-ads-team`.
- Skills: `email-curation`, `seo-opportunity-review`, `meta-ads-strategy`, `meta-ads-safety`.
- MCP contract: `email-connector` with explicit `email.send` approval.

The Meta Ads Team contains seven specialist employees—Strategist, Copywriter, Creative, Media Buyer, Optimizer, Analyst, and Account Manager—under one orchestrator. The marketplace package called `meta-ads-team` represents that whole coordinated team, which is why the package inventory reports three top-level agents rather than nine.

## PointAI

Implemented:

- In-product chat, contextual suggestions, UI element matching and highlight instructions.
- Setup playbooks for Search Console, WordPress staging, and email.
- External guide sessions restricted to approved HTTPS hosts.
- Observation sanitization that accepts labels/roles/URLs but rejects values and sensitive fields.
- No storage or telemetry path for page contents, credentials, customer conversations, or form values.

Current boundary: PointAI can guide a user using sanitized page metadata, but the repository does not yet ship a reviewed browser extension or controlled browser driver that opens and operates arbitrary third-party pages. It must not be described as autonomous external-browser control.

## Operator console

```powershell
$env:OPERATOR_TOKEN="replace-with-a-unique-random-token-at-least-32-characters"
npm run operator
```

Open `http://127.0.0.1:4180`. The token is a local operator password; 32 characters provides enough entropy to resist guessing. Use a password manager or secret generator, never commit it, and use a different value per environment.

The console includes tenant/user assignment, install/health analytics, recommendations, review queue, signed immutable registry releases, channel/rollout management, kill switches, first-party package status, and the GitHub Plugin Studio pipeline. Its token is retained only for the browser tab through `sessionStorage`.

## What blocks general production

- No hardened hosted deployment, TLS/reverse-proxy configuration, backup/restore evidence, alert routing, retention policy, or disaster-recovery exercise is present in this repository.
- AI needs a verified local Ollama endpoint or encrypted tenant provider credential.
- PointAI external browser control needs a reviewed extension/driver and adversarial privacy testing.
- Meta OAuth/read adapters, Marketing API write adapters, verified sales-source ingestion, webhook verification, and provider sandbox tests are not implemented.
- Email, CRM, Google Business, WhatsApp, content, campaigns, reviews, social, website, projects, quotations, competitors, and analytics are roadmap manifests, not functioning integrations.
- No plugin is labeled production yet; `npm run release:production` deliberately remains blocked.

## Customer pilot scope

Use a new isolated tenant and synthetic/non-sensitive seed data first. Enable Catalog, Pricing, and read-only SEO. Meta Ads may be shown only as a planning preview. Keep external writes off. Obtain written customer consent, define support/rollback contacts, verify backup restore, then run the authenticated end-to-end demo before onboarding real data.
