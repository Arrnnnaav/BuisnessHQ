# Implementation Status

> Release truth is tracked in [RELEASE_READINESS.md](./RELEASE_READINESS.md). Marketplace entries now carry runtime readiness metadata: tested pilot/preview apps may be installed, while manifest-only roadmap entries remain visible but are server-blocked.

This repository now provides a deployable local staging foundation and a complete read-only AI/SEO vertical slice. It is not yet a production release because external providers still require approved OAuth applications, customer consent, deployment infrastructure, and provider-specific write tests.

## Delivered in this repository

- Plugin manifest discovery, dependency ordering, enablement, capability registry, audit log, and policy checks.
- GitHub marketplace registration with an explicit review state; repositories are never cloned or executed automatically.
- A universal plugin contract and local repository compatibility detector.
- Tenant-isolated Company Brain records with provenance, confidence, validity windows, conflict detection, semantic retrieval, targeted context resolution, outcome write-back, and reusable skills.
- Persistent, resumable, tenant-isolated workflow requests with idempotency, evidence, previews, checkpoints, approval comments, and a global external-write kill switch.
- A local dashboard for the command center, approvals, Company Brain records, installed plugins, marketplace entries, audit activity, and workflow requests.
- A curated first-party AI Meta Ads Team plugin (`plugins/meta-ads-team`): Orchestrator plus Strategist, Copywriter, Creative, Media Buyer, Optimizer, Analyst, and Account Manager definitions; research-to-repeat workflow; StrategyBrief/CopyPackage/CreativePackage/CampaignPlan/OptimizationDecision/AttributionSnapshot/ClientReport contracts; and approval/budget safety gates.
- The Meta Ads Team also includes staging services for normalized Meta/sales metrics, data-sufficiency checks, budget-change validation, guarded optimization recommendations, and experiment lifecycle transitions. These services never call Meta directly or spend money.
- Focused executable self-tests for the runtime, navigation registry, marketplace, Company Brain, and workflow gate.
- A server-driven navigation registry with Core / Growth Apps / Platform sections, install-ordered plugin entries, and a React dashboard shell that renders it.
- Per-tenant plugin lifecycle: install with dependency resolution, enable, disable, update, and uninstall with an explicit keep-or-delete-data choice. Installation is persisted in `data/installations.json`; a new workspace starts with the Catalog / SEO / Pricing starter set rather than every discovered manifest.
- Apps & Features screen and a per-plugin page with the core-owned Danger Zone, both driven by `/api/apps`.
- A curated owner Marketplace (Discover / Installed / Updates). Registering a GitHub repository is developer tooling and returns 403 unless `BUSINESSOS_DEVELOPER_MODE=1`.
- The BusinessOS Guide as a core feature: floating panel, page explanation, deterministic capability recommendation (the index decides, a model only rewords), and validated actions that install through the normal plugin lifecycle. Works with no AI configured.
- Core tasks and reminders (`core/tasks/task-store.mjs`, `/api/tasks`).
- The SEO vertical end to end: a stepped workspace that gates each stage on real evidence, a Needs You screen showing the exact before/after wording, staging-only publishing, and production fingerprint verification. Publishing uses the text the owner approved, not the text that was drafted.
- An operator control plane (`control-plane/`) and a separate BusinessOS Operator console (`npm run operator`, port 4180): plugin registry with signed packages, release channels, staged rollouts, version kill switches, tenant plans and entitlements, and a Plugin Studio that inspects a repository and publishes it. The console runs as its own process on loopback and refuses to start without `OPERATOR_TOKEN`.
- Operator runtime checks can set `OPERATOR_DATA_ROOT` to an isolated directory; the console keeps its bearer token in tab-scoped session storage rather than persistent browser storage.
- The client/control-plane privacy boundary is an allowlist in code (`control-plane/telemetry-contract.mjs`): only ids, versions, health, plan and channel cross it.
- Operator metadata analytics and recommendations: per-plugin active/disabled installation counts, tenant counts, stale-installation and unused-plugin signals, and capability-overlap suggestions that do not inspect customer content.
- Operator-managed tenant users and plugin assignments, with add/remove/assign/unassign APIs.
- Plugin Studio accepts validated HTTPS GitHub repository URLs, optional refs, and an optional requested outcome; repository import only reads/clones source and never executes it.
- A persistent-ready workbook model for Catalog with dynamic columns, rows, cell updates, merged ranges, conflict-aware multi-table imports, and a dashboard grid with multi-file CSV/XLSX import. XLSX parsing uses a small standard-library Python bridge rather than trusting uploaded workbook macros or formulas.
- First-party package foundations for distinct plugin, skill, agent, and MCP package types, including provenance, digest, lifecycle status, and rejection of arbitrary executable packages.
- Signed control-plane marketplace distribution for local staging: customer catalog discovery, checksum/signature verification, safe-path package installation, and normal tenant plugin lifecycle registration.
- Privacy-preserving PointAI setup playbooks for Search Console, WordPress staging, and email connections; playbooks guide the owner without collecting credential values.
- An external PointAI guide-session contract with allowlisted HTTPS destinations, step state, sanitized UI observations, and matcher output; a browser extension or controlled-browser bridge is still required to observe a cross-origin tab.
- Persistent Plugin Studio review queue with pending/approved/rejected states and publication gating for flagged inspections.
- A first-party package catalog surfaced in the Operator console for GhostCursor-authored skills, agents, and MCP connectors, with enable/disable lifecycle controls.
- The customer Marketplace exposes the same first-party agent/skill/MCP catalog as discoverable, non-executable entries; execution remains behind approved plugin capabilities and workflows.
- Customer tenants can now install, enable, disable, and remove first-party declarative packages; package state is stored with the tenant and does not execute arbitrary code.
- The dashboard core routes are now functional rather than placeholders: Home, Ask BusinessOS, Company Brain, Business Profile, Connections, Activity, Settings, Test Lab, and Tasks all read or write through the authenticated API.
- A local-first agent planning boundary now validates capability-scoped graphs, rejects unknown/cross-plugin/cyclic/duplicate-effect nodes, binds the plan to a SHA-256 digest, persists it per tenant, and requires an existing approval workflow before a plan becomes approved. Plans still cannot execute adapters directly.
- The AI Meta Ads Team is currently declarative and staging-safe: no Meta campaign, budget, creative, or client-message write is available until a reviewed adapter, OAuth connection, real-sales source, and per-client approval policy are configured.
- Internal PointAI: "where is it" questions highlight the real control on screen. Deterministic matching first, a model only as a validated fallback, sensitive fields never read or logged, and a playbook cache that re-resolves against the live DOM instead of storing coordinates. PointAI points; it never clicks, types or submits.
- Owner authentication, isolated company profile/catalog storage, encrypted local credential vault, provider-selection model router, and a first-run onboarding dashboard.
- Real local Ollama chat grounded in the tenant profile, catalog, Company Brain, and semantic index; optional Gemini fallback uses one encrypted dashboard API key.
- Qwen3 4B is the only local generative model. EmbeddingGemma is used only for semantic retrieval, and the encrypted Gemini API key is an optional non-private fallback.
- Docker packaging starts the dashboard, persistent storage, Ollama, Qwen3 4B, and EmbeddingGemma with one `docker compose up -d --build` command.
- The dashboard is an installable cross-platform PWA with a standalone window, icon, and desktop shortcut.
- A managed, staging-enabled Pricing Agent adapter for `Arrnnnaav/Pricing-Agent`, with fixture ingestion, local SQLite history, synthetic competitor observations, and approval-only recommendations.
- A real read-only website SEO crawler/auditor with private-network protection, redirect validation, crawl limits, persistent tenant history, and dashboard reporting.
- A one-click sanitized `ABizCreator Demo` tenant plus an executable local end-to-end staging script.
- A dashboard Test Lab that simulates SEO, content, GBP, reviews, email, and pricing actions without external effects. See `docs/TESTING_AND_STAGING.md`.

## Requires real external setup before it can be built safely

- Google Business Profile, Search Console, GA4, WhatsApp, email, Meta, and website publishing integrations require their respective OAuth applications, approved scopes, credentials, and a configured business account.
- Real publishing, email, WhatsApp, price updates, and website modifications require approved owner policies, per-action permissions, rollback behavior, and integration-specific end-to-end tests.
- A hosted multi-tenant release needs authentication, tenant isolation, encrypted secrets, database migrations, background jobs, rate limits, monitoring, backups, and production deployment infrastructure.
- A desktop/local-first release needs the Tauri shell, installer, hardware detection, model/Ollama setup, signed builds, and recovery testing.
- OCR and additional specialist verticals still need representative data and acceptance criteria. Web crawling, embeddings, local/cloud model routing, pricing staging, and the first SEO/AI vertical slice are implemented.
- The operator console now includes tenant user add/remove and per-user plugin assignment, package lifecycle status history, review decisions, metadata-only recommendations, and first-party package administration. The remaining operator enhancement is action execution beyond recommendations; any such action must continue through existing approval gates.
- External PointAI guidance has the privacy-preserving session contract and dashboard playbooks, but a production browser extension or controlled-browser bridge is still required to observe authenticated cross-origin pages. The local dashboard cannot safely bypass browser origin boundaries.
- Agent orchestration now has a local-first planning boundary and dashboard entry point: capability-scoped graphs are validated, digest-bound, persisted, and approval-gated. PowerPoint/general Windows adapter execution remains separately gated until reviewed adapters and verification coverage exist.

## Validation commands

- `npm test` runs the focused runtime, navigation, plugin-lifecycle, guide, control-plane, workbook, package, marketplace, Company Brain, workflow, sandbox, Pricing Agent, AI, semantic-index, SEO-auditor, and SEO closed-loop suites.
- `npm start` starts the authenticated dashboard and API at `http://127.0.0.1:4173`.
- `npm run test:e2e:demo` exercises account access, sanitized tenant setup, catalog, Company Brain, approval flow, model routing, and real Ollama generation.
- `npm run pricing:stage` executes the isolated Pricing Agent staging harness without a Gemini key or external write.

## Safety boundary

No third-party repository or connector is executed merely because it was registered. GitHub sources remain pending review until a contract, permissions, adapter, and sandbox strategy have been explicitly approved.
