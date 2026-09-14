# AI Business Operating System (BusinessOS)

A local-first AI operating layer that learns how a company works, connects to its tools, executes routine business workflows through agents, and keeps the business owner in control of important decisions.

## Vision

The system should allow a non-technical owner to:
- Install the application easily
- Provide information about their company
- Upload catalogs, price sheets, brochures, project photos and documents
- Connect their website, Google Business Profile, Search Console, Analytics and communication/social accounts
- Tell the AI how the company works
- Define important rules and approvals
- Let AI agents perform most routine work
- Get interrupted only when a decision genuinely requires the owner
- See everything happening from one dashboard
- Ask natural-language questions about the business
- Continuously improve the system as new business knowledge and results appear

## Architecture

Based on the blueprint, the system follows a modular plugin architecture with:

### Core Components
- **Company Brain Engine** - Central knowledge repository
- **Plugin Manager** - Manages modular capabilities
- **Agent Orchestrator** - Coordinates specialist agents
- **Workflow Engine** - Executes business processes
- **Event Bus** - Enables loose coupling between components
- **Policy + Risk Engine** - Determines automation levels
- **Approval Engine** - Manages owner approvals
- **LLM Router** - Routes requests to appropriate models
- **Audit System** - Tracks all actions
- **Secrets / OAuth / Security** - Manages credentials
- **Scheduler** - Handles timed operations
- **Notification Engine** - Manages communications
- **Shared Data Layer** - Centralized data storage

### Company Brain Layers
1. **Knowledge Layer** - What the company knows (facts, entities, relationships)
2. **Operating Layer** - How the business works (procedures, policies, skills)
3. **Semantic Layer** - What important terms mean (deterministic definitions)

### Plugin Structure
Each plugin declares:
- manifest
- dependencies
- permissions
- database migrations
- API routes
- dashboard pages
- widgets
- tools
- agents
- skills
- workflows
- events listened to
- events emitted
- settings
- health checks

## Development Phases

### Phase 0 — Discovery
Collect ABizCreator catalog, pricing, service information, website access, Google access, current workflows, owner policies, customer process, quotation process, approval requirements.

### Phase 1 — Core BusinessOS
Build desktop shell, FastAPI, SQLite, authentication, business/workspace, plugin manager, event bus, scheduler, audit, notifications.

### Phase 2 — Company Brain
Build file ingestion, website ingestion, structured company schema, vector retrieval, resolver, knowledge confidence, provenance, conflict detection, decisions, policies, skills, write-back.

### Phase 3 — Agent platform
Build LLM router, Ollama, agent interface, orchestrator, structured outputs, tools registry, workflow system, risk engine, approval engine.

### Phase 4 — Catalog + Projects + CRM
Implement services/products, catalog upload, project upload, asset library, customers, leads, pipeline.

### Phase 5 — Pricing + Quotations
Integrate pricing agent, build cost model, pricing policies, margin engine, quotation builder, pricing recommendations, negotiation assistant, quote history, win/loss data.

### Phase 6 — SEO
Build crawler, technical audit, keyword database, page mapping, Search Console, SEO recommendations, website drafts, website versioning.

### Phase 7 — Google Business
Build OAuth, location connection, profile, posts, reviews, review replies, metrics, profile health.

### Phase 8 — Content & Campaigns
Build project repurposing, content calendar, Google posts, social drafts, website content, campaign object, campaign execution.

### Phase 9 — Analytics & Learning
Connect Search Console, GA4, Google Business, lead CRM, quotes, sales outcomes. Build weekly reports, opportunity engine, anomaly detection, growth memory, pricing memory, campaign memory.

### Phase 10 — Autonomy
Begin Assist → Copilot → Trusted routine automation progression.

### Phase 11 — Packaging
Create installer, hardware detection, automatic Ollama setup, automatic model setup, desktop shortcut, backup, self-healing, simplified onboarding.

### Phase 12 — Convert ABizCreator into reusable Printing Pack
Extract printing schemas, skills, workflows, dashboard defaults, KPIs, onboarding questions into Printing Business Pack.

## Technology Stack

| Layer | Choice | Why this | Alternative considered & why rejected |
|-------|--------|----------|---------------------------------------|
| Desktop Framework | Tauri + React/TypeScript | Lightweight, secure, native-like desktop experience | Electron (higher resource usage) |
| Backend | FastAPI (Python) | High performance, automatic docs, async support | Django (heavier), Node.js/Express (less mature Python ML ecosystem) |
| Database | SQLite (initial) → PostgreSQL (later) | Zero-config, file-based, excellent for single-user | MySQL (overkill for initial), MongoDB (lacks strong consistency for business data) |
| Vector Store | Qdrant/Chroma | Excellent for semantic search, integrates well with LLMs | Pinecone (cost), Weaviate (more complex setup) |
| LLM | Ollama (local) + API fallbacks | Privacy, cost control, offline capability | Pure cloud APIs (privacy concerns, ongoing costs) |
| Build System | pnpm/workspaces | Monorepo support, fast installs | Yarn (similar but pnpm preferred), Npx (workspace support less mature) |
| Testing | Jest/Vitest | Excellent React/TS testing, fast | Cypress (overkill for unit), Playwright (E2E focused) |

## ABizCreator Specific Features

For the first client (ABizCreator - printing/design business in Jaipur):

### Enabled Plugins
- Catalog (printing & design items)
- Projects (completed work with photos)
- CRM / Leads
- Quotations
- Pricing Intelligence
- SEO
- Local SEO
- Google Business Profile
- Reviews / Reputation
- Content
- Campaigns
- Competitor Intelligence
- Analytics (Search Console, GA4)
- Communication (Email, WhatsApp, Social)

### Key Focus Areas
- Increase visibility and qualified enquiries for printing-related searches in Jaipur
- Reduce manual marketing and follow-up work for the owner
- Project repurposing (one completed project → portfolio page, GBP post, social posts, SEO links)
- Local SEO geo-grid tracking (Vaishali Nagar #2, Sodala #5, etc.)
- Deterministic pricing engine with margin guards
- Approval workflows for risky actions (discounts, price changes, negative reviews)

## Getting Started

### Runtime smoke test

The first executable kernel is now available without installing a framework:

```bash
npm test
npm run demo
```

The runtime discovers plugin manifests, resolves dependencies, enables plugins through the event bus, records audit entries, and evaluates approval risk. External GitHub projects are integrated through reviewed adapters; see `docs/EXTERNAL_REPOSITORIES.md`.

### Run the local dashboard

```bash
npm start
```

Open `http://127.0.0.1:4173`. The current local MVP includes the Home command center, Company Brain teaching, Needs You approvals, Apps & Features, GitHub repository registration, capability discovery, audit activity, persistent JSON state, and seeded ABizCreator data.

### Run the complete Docker product

```bash
docker compose up -d --build
```

Open `http://localhost:4173`. On the first launch Docker downloads Qwen3 4B and EmbeddingGemma into a persistent Ollama volume. Business data, accounts, and the encrypted credential vault are kept in a separate persistent volume. Use `docker compose logs -f model-setup` to watch the first model download.

Qwen3 4B is the only local generative model. If it is unavailable and the owner selected a non-private AI mode, BusinessOS can use the encrypted Gemini API key entered under **AI & Connections**. EmbeddingGemma is non-generative and is used only to index and retrieve Company Brain context.

The dashboard is an installable Progressive Web App. In Chrome or Edge, use the **Install desktop app** prompt to create a standalone desktop window and shortcut. See `apps/desktop/README.md`.

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Run the installer: `cd installer && node install.js`
4. Launch BusinessOS: `pnpm dev` (or run the installed executable)
5. Complete the onboarding wizard
6. Connect your business data and tools
7. Let the AI begin working while you maintain control through the "Needs You" inbox

## License

MIT
