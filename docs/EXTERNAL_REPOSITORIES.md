# External repository integration strategy

GitHub repositories are treated as upstream sources, not copied into the core runtime automatically.
The BusinessOS plugin manager remains the boundary for permissions, audit records, policy checks, and owner approvals.

## Recommended pattern

1. Register an upstream repository with its URL, license, pinned revision, and intended capabilities.
2. Review its dependency, security, data, and deployment assumptions.
3. Choose one of three integration modes:
   - **Reference**: borrow concepts and implement a native BusinessOS adapter.
   - **Connector**: call a separately deployed service through a narrow interface.
   - **Embedded plugin**: vendor only an isolated, reviewed module behind a BusinessOS manifest.
4. Translate external output into Company Brain evidence with source, timestamp, and confidence/provenance.
5. Route every write through the BusinessOS action gateway and policy/approval engine.

## Current candidates

### trycompai/crm

Useful ideas: evidence-backed CRM records, durable work queues, scheduled rechecks, and explicit data boundaries.
The repository is a MIT-licensed agent-first CRM, but its stack is a separate Bun/Turborepo, Next.js, NestJS, Prisma/Postgres deployment.
It should therefore start as a reference/adapter rather than being dropped into the local-first runtime.

### every-app/open-seo

Useful capabilities: keyword research, rank tracking, site audits, competitor insights, and MCP/agent skills.
It is MIT-licensed and uses DataForSEO for live SEO data, so it is not fully offline and introduces a paid external-data dependency.
The safe first step is a connector that imports SEO observations into the SEO plugin; external skills must not bypass BusinessOS approvals or publish directly.

The registry for these adapters lives in `core/plugins/external-repository-adapter.mjs`.

## Marketplace implementation

The runtime now includes:

- `universal-plugin-contract.mjs` for a stable capability/runtime/permission contract;
- `repository-analyzer.mjs` for local or previously cloned repository inspection;
- `capability-registry.mjs` so workflows request `pricing.optimize` or `seo.audit`, not repository names;
- `marketplace.mjs` for pending-review, installed, enabled, disabled, and removed states.

GitHub registration deliberately creates a `pending-review` entry. Installation requires a validated `businessos-plugin/v1` contract. The runtime does not clone, install dependencies, run install scripts, or grant permissions as a side effect of registering a URL.
