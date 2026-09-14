# Unified Platform Design — BusinessOS + PointAI

Date: 2026-09-09
Status: Design approved, implementation not started

## Purpose

This document is a decision record. It defines what the merged product is, what it
is explicitly not, and the order in which it gets built.

It supersedes three overlapping roadmaps:

1. `README.md` Phases 0–12
2. `SUMMARY.md` Phases 1–7 (stale — see "Verified state" below)
3. `docs/ideation/ai-website-management-agent.md` Phases 0–7 and Versions 0.1–1.0

Those documents remain useful as idea sources. They are no longer the plan. Where
this document and those documents disagree, this document wins.

`docs/IMPLEMENTATION_STATUS.md` remains authoritative for what currently ships and
is not superseded.

## Verified state, 2026-09-09

Claims below were checked against the code, not against the other documents.

**BusinessOS — working, further along than `SUMMARY.md` claims.** `SUMMARY.md` says
the repository is "ready for the development team to begin implementing the actual
functionality." That is out of date. `npm test` was run on 2026-09-09: all ten suites
pass and the runtime discovers 17 plugins. (Corrected since: `IMPLEMENTATION_STATUS.md`
now says eleven, counting `seo-closed-loop` and `navigation`.) The following
are real:

- Plugin manifest discovery, dependency ordering, capability registry, audit log
- Company Brain with provenance, confidence, conflict detection, semantic retrieval
- Workflow requests with idempotency, previews, checkpoints, and a global
  external-write kill switch
- `PolicyEngine` with risk ordering and hard-denied capabilities
- `ModelRouter` (profiles: private/balanced/quality/economical) over Ollama +
  optional Gemini, with an encrypted credential vault
- Grounded local chat over tenant profile, catalog, Company Brain, semantic index
- SEO closed loop: `SeoOpportunityEngine` → `SeoPrePublishValidator` →
  `SeoExperimentService` state machine → `WordPressStagingConnector` →
  `SeoPostPublishVerifier`
- `SearchConsoleOAuth` begin/exchange
- Read-only SEO crawler with private-network (SSRF) protection
- Docker packaging, installable PWA dashboard, JSON-file persistence

One reason `SUMMARY.md` reads as "nothing built" is that the directories it names —
`core/approvals`, `core/audit`, `core/events`, `core/llm_router`, `core/notifications`,
`core/orchestrator`, `core/policies`, `core/scheduler`, `core/secrets`, `core/workflows` —
are all empty. The implementations live in `core/runtime/*.mjs`, `core/ai/*`, and
`core/security/*`. The empty scaffold directories are cruft and should be deleted.

**PointAI — working, small.** A FastAPI backend (~530 lines) and a CRA/React frontend.
Fetches a URL, strips scripts, renders it in a sandboxed iframe, extracts interactive
elements from the DOM, asks an LLM which one matches the user's goal, and draws a
highlight ring. Caches successful matches in MongoDB keyed by `(host, normalized_goal)`,
re-verifies the cached element against the live DOM on each hit, and self-heals by
deleting entries that no longer resolve.

**Website Ops Agent — does not exist.** An ideation document only.

## The core insight

BusinessOS is deliberately built to stop at the production boundary.

`HARD_DENIED_CAPABILITIES` disables `wordpress.production.publish` and
`wordpress.page.delete`. `WordPressStagingConnector` writes drafts to staging only.
`SeoPostPublishVerifier` *requires* the production fingerprint to be unchanged before
and after in order to pass. A global external-write kill switch sits over everything.

This is correct and should not change. The system does all the work up to the
boundary; a human crosses it.

But `docs/IMPLEMENTATION_STATUS.md` names the real blocker: every external integration
"require[s] their respective OAuth applications, approved scopes, credentials, and a
configured business account." For a Jaipur printing-shop owner, that means navigating
Google Cloud Console to create an OAuth application, verifying a property in Search
Console, and generating an application password in WordPress admin. Those are the
steps that stop the product from being usable by the person it is built for.

Nothing can automate them safely — they happen inside third-party accounts, behind
logins, under terms of service that forbid automated access, and they are exactly the
credential-handling surface where an automated agent should never be.

**PointAI is the layer that carries the owner across the boundary.** That is the
product thesis, and it makes the two projects one product rather than two.

## Decisions

### D1 — PointAI becomes a native BusinessOS plugin. No second runtime.

Port the Python backend to a plugin in this repository. Reject federating a separate
Python service behind an adapter.

Rationale: the portable surface is small. `extractElements` is already browser
JavaScript and does not move. What remains is an HTML sanitizer (`cheerio`), a fetch,
a prompt, and one cache. Against that, a second runtime permanently costs a second
datastore, a second model gateway, and duplicate auth/vault/audit paths in a product
whose central promise is a simple local install.

### D2 — Drop MongoDB. Playbook cache moves to the tenant store.

PointAI uses MongoDB for exactly one collection. BusinessOS persists to JSON files
with no daemon. Requiring a non-technical owner to run a MongoDB server to use a
local-first desktop app defeats the product.

The cache key gains a tenant: `(tenantId, host, goal_norm)`. BusinessOS is
multi-tenant; the current two-part key would leak learned playbooks across tenants.

Keep the existing design intact: strict exact-match on normalized goal (never fuzzy),
live re-verification of the cached element signature against the current DOM, and
self-healing deletion of stale entries.

### D3 — Remove Emergent. Route through the existing `ModelRouter`.

Delete `emergentintegrations`, `litellm`, and the unused `openai`,
`google-generativeai`, `google-genai`, and `google-api-python-client` dependencies.

Independent of tidiness, the pinned `litellm` wheel installs from
`customer-assets.emergentagent.com` — a third-party-hosted binary in the dependency
chain. It should go.

`ModelRouter` is the provider abstraction; do not build a second one. Element matching
calls it with an explicit task so routing policy stays in one place.

Open question, to be settled by measurement rather than assumption: PointAI's prompt
currently targets `claude-sonnet-5`, while the router offers `qwen3:4b-instruct` and
Gemini. Ranking ~200 DOM elements against an intent is a reasoning task, and the local
4B model may not hold up. Add Anthropic as a third provider, then measure match
accuracy across local and cloud on the existing demo pages before choosing the default
route. Privacy mode must still work, even if degraded, because page content reaching a
cloud provider is a real disclosure.

### D4 — The Website Ops Agent is absorbed, not built.

Do not build it as a subsystem. It is a separate product in a crowded category, and
the SEO closed loop already implements a narrower, safer version of the same pipeline
with a real state machine and verification.

Take its good parts into what exists: risk tiers, the tool-call contract shape, diff
preview, the audit-entry format, and rollback semantics. "Chat to edit the website"
becomes a later capability of the website plugin, gated by the same policy engine.

The deeper reason is audience, not category. That document's problem statement is a
multi-person bottleneck — `Employee → Manager → Developer → CMS → Deploy` — and its
answer is five roles, multi-channel access, a second human approving, and agency
multi-tenancy. The owner this product is built for is employee, manager, approver, and
admin at once. There is no middleman to remove. Its sections 6, 15, 16, 17, and 18 are
therefore not deferred, they are addressed to a customer we do not have.

That is also why `AuthService` stays single-owner and no role model is added. RBAC is
not missing from this design; it is out of scope by the same argument, and adding it
later requires a real second user first.

### D5 — The guidance layer never acts. It points.

On third-party surfaces, PointAI reads the page and highlights the target. It never
clicks, never submits a form, never types into a field, never handles a credential.

This is a hard product boundary, not a v1 limitation. It is what keeps the system
clear of automated-access terms of service, out of the credential path, and compatible
with 2FA and passkeys. It also matches the staging/production boundary the rest of the
system already respects.

Corollary for the code-location feature: reading a repository to find where a snippet
belongs is allowed; committing it is not. Output is "here is the file, the line, and
the exact text" with a confidence level, and a human pastes it.

### D6 — Real-page overlay via an app-controlled browser window, not a published extension.

The current sandboxed-iframe approach cannot work on the pages that matter. Google,
GitHub, and WordPress admin all refuse to be framed, and a fetched copy has no session,
so the owner would be looking at a logged-out replica of a page they need to be logged
into.

Two ways to overlay a real page: a browser extension, or a Chromium window the app
controls and injects an overlay into. Choose the controlled window. An extension means
store review, a separate install, and a second thing to keep updated — friction aimed
squarely at the least technical user in the product's audience. The desktop app opening
a window is one install.

The sandboxed iframe approach stays, demoted to what it is already good at: the demo
pages and a practice mode. Concretely, the demo HTML in `backend/demo_pages/` carries
over as content and the sanitize-and-frame path is rebuilt inside the dashboard panel;
the CRA shell around it does not survive (see D7).

### D7 — One dashboard. The existing PWA.

Guidance appears as a panel in the BusinessOS dashboard, alongside the approvals inbox
and Company Brain, sharing its auth, tenant, vault, and audit log. The CRA/React app is
not carried over; much of it is demo scaffolding for the iframe sandbox that D6 demotes.

### D8 — Reuse the existing SSRF guard.

PointAI's `/api/fetch` accepts a user-supplied URL, prepends a scheme if missing, and
fetches it server-side with redirects enabled and no host validation. That reaches
internal addresses and cloud metadata endpoints. The SEO crawler already has
private-network protection; the ported fetch path must use it. This is a fix, not a
port detail.

## Architecture after the merge

```
BusinessOS (single Node runtime, JSON persistence, one install)
│
├── core/runtime      plugin manager · event bus · policy engine · workflow · audit
├── core/ai           ModelRouter (ollama · gemini · anthropic) · AiRuntime
├── core/security     credential vault
├── core/company_brain knowledge · provenance · semantic index
│
├── plugins/seo       opportunity → validate → experiment → staging draft → verify
├── plugins/pricing   staged recommendations, approval-only
└── plugins/guidance  ← PointAI, ported
        ├── element extraction   (browser-side, unchanged)
        ├── match + confidence   (prompt → ModelRouter)
        ├── playbook cache       (tenant-scoped, self-healing)
        ├── overlay window       (controlled Chromium, D6)
        └── code locator         (repo read → file+line+snippet, never commits)
```

Data flow for a guided step:

```
Owner states a goal ("connect my Search Console")
    → guidance plugin resolves tenant context from Company Brain
        (which integrations are already connected, which domain is theirs)
    → playbook cache checked  (tenantId, host, goal_norm)
        → hit: re-verify signature against live DOM → highlight
        → miss: extract elements → ModelRouter → match + confidence + steps → cache
    → overlay highlights the element in the controlled window
    → owner clicks, types, approves — the system does not
    → audit entry recorded
```

## Explicitly not building

Listed so that later "we should also…" conversations have something to check against.

- A second Python service, or MongoDB anywhere in the product
- A second model gateway or provider abstraction
- The Website Ops Agent as a standalone subsystem (D4)
- Any automated click, form submission, keystroke, or credential entry on a
  third-party site (D5)
- Automated commits or pull requests from the code locator (D5)
- A published browser extension (D6)
- Production publishing — the hard-denied capabilities stay denied. Lifting them is a
  separate decision with its own spec, not a side effect of this work.
- Multi-channel (email/Slack/Teams/WhatsApp), billing, white-label, agency
  multi-tenancy — all deferred, none in this slice
- Website building as a service — a different product; revisit only after the slice
  below proves out

## First slice

Superseded on ordering by R1 below: this is no longer the first work, it runs after the
platform and frontend phases. Its content and its "Done when" gate are unchanged.

One tenant (ABizCreator Demo), one end-to-end path, chosen because it attacks the
blocker named in `IMPLEMENTATION_STATUS.md` and needs the least new code.

**Path:** the owner connects WordPress and Google Search Console — guided by the
overlay wherever a click inside a third-party account is unavoidable — and BusinessOS
then runs one real SEO opportunity through validation, approval, and a staging draft,
with post-publish verification confirming production is untouched.

Everything after the connection step already exists and is tested. The new work is the
guidance layer and the ported plugin.

**Done when:**

1. A person who has never seen Google Cloud Console completes both connections
   unaided, with the overlay as their only instruction.
2. Credentials land in the existing encrypted vault. The guidance layer never receives
   one.
3. A real Search Console row produces an opportunity, a validated proposal, an
   approval request, and a staging draft in WordPress.
4. `SeoPostPublishVerifier` confirms the production fingerprint is unchanged.
5. Every step appears in the audit log, attributed, with the guidance steps
   distinguishable from the automated ones.
6. Timed end to end. If guided connection is slower than a competent developer doing it
   manually, the thesis needs revisiting before more is built on it.

## Risks

**The 4B model may not be good enough for element matching.** Settled by measurement
(D3), not argument. If local matching fails and cloud is required, privacy mode becomes
degraded-by-default for this feature and the product's privacy claim needs restating
honestly.

**Guidance may be a one-time-use feature.** An owner connects their accounts once and
may never open the panel again. That is acceptable *inside* BusinessOS, where recurring
value comes from SEO, pricing, and content. It would not support a standalone product,
which is a further argument against splitting PointAI back out later.

**Third-party UIs change.** Google redesigns its consoles. The cache already self-heals
by deleting entries that no longer resolve, and a miss costs a model call rather than a
wrong answer — but a redesign mid-flow will strand an owner partway. The overlay must
fail loudly and offer a text fallback rather than pointing confidently at nothing.

**Scope.** Three roadmaps existed before this document because the idea keeps growing.
The cut list above is the defense. Adding to it requires a new spec.

## Reconciliation with the GrowthOS architecture plan, 2026-09-09

`docs/plans/growthos-architecture-and-frontend.md` was written after this document and
covers ground this one does not: product structure, plugin lifecycle, marketplace,
frontend architecture, tasks/reminders, and the owner-facing information architecture.

Most of it is additive and consistent with this spec: PointAI never clicks, types,
submits, or handles credentials; the human crosses the credential and production
boundary; production publish and delete stay hard-denied; writes are staging-only;
verification requires an unchanged production fingerprint. None of that changes.

Where the two documents disagreed, the following was decided. These override the
relevant text above.

### R1 — Build order: the GrowthOS plan wins. Platform before slice.

This document made the SEO V1 slice the first work, on the grounds that it needed the
least new code. The GrowthOS plan (section 115) puts roughly eighteen platform and UI
items ahead of it. That order is adopted.

Consequence to state plainly: the product thesis — that guided setup carries a
non-technical owner across the OAuth boundary — stays untested for the whole of that
platform work. The "Done when" criteria below, especially the timing criterion, do not
disappear because they moved later. They are the gate on the slice whenever it runs.

### R2 — Overlay surface: this document wins. D6 stands.

The GrowthOS plan specifies the Guide Me panel, stepper, and highlight overlay without
naming the browser surface being highlighted, and its section 69 assumes the PWA is
sufficient. It is not. A PWA cannot inject an overlay into a third-party page, and the
pages that matter refuse framing and would render logged-out.

D6 stands: a real-page overlay requires an app-controlled Chromium window and therefore
a native desktop shell. Note that `apps/desktop/README.md` currently argues against a
native shell on portability grounds; that document is now out of date and must be
revised when the shell lands. Open question 2 below remains open and is now on the
critical path for PointAI, not for the whole product.

### R3 — PointAI placement: this document wins. It is a plugin. ~~Active~~ **Superseded by R5.**

The GrowthOS plan (section 114) makes PointAI a top-level layer beside core and plugins.
It ships as `plugins/guidance` instead, per D1, so it goes through the same manifest,
permission, capability-registry and audit path as every other capability, and can be
disabled. Onboarding may depend on it; that makes it a default-installed plugin, not a
core subsystem.

**Superseded 2026-09-09 by R5.** The reasoning above still holds for *provider-specific
setup knowledge*, which stays plugin-contributed. It does not hold for the assistant
itself, because the scope grew past third-party setup.

### R4 — Frontend: the GrowthOS plan wins. React SPA per its section 75.

`apps/dashboard` is today a single vanilla-JavaScript file with no build step. The
GrowthOS plan's section 2 says to evolve the existing UI while its section 75 prescribes
a full SPA module tree; the SPA tree is what gets built. Section 2's "evolve, do not
discard" applies to the visual identity and information architecture, not to the
implementation.

This adds a build toolchain to a product whose promise is a simple local install. The
mitigation is that the build output stays a static bundle served by the existing
`apps/server.mjs`, with no additional runtime process.

### Resolved without a separate decision

- **Anthropic provider (D3).** Retained. The GrowthOS plan lists only Qwen3, EmbeddingGemma,
  and Gemini. D3's requirement stands: add Anthropic and measure element-matching accuracy
  before choosing a default route, because a 4B model ranking roughly two hundred DOM
  elements is the single assumption PointAI rests on. Not needed until `plugins/guidance`
  is built.
- **Empty `core/` scaffold directories.** The GrowthOS plan's section 74 populates several
  of the directories this document called cruft. They are no longer deleted wholesale;
  each is either implemented under section 74 or removed. Open question 4 is closed.
- **Multi-channel (email, WhatsApp).** Both documents defer it. The GrowthOS plan places it
  at its phase 12. No conflict in practice.
- **GitHub importer.** The GrowthOS plan's section 97 removes repository concepts from the
  owner-facing marketplace and keeps them for plugin authors. `docs/EXTERNAL_REPOSITORIES.md`
  documents the current behavior and must be updated when that lands.


### R5 — BusinessOS Guide is core; PointAI is a Guide capability. Supersedes R3.

Source: `docs/plans/businessos-guide-and-pointai.md` section 69, adopted 2026-09-09.

R3 placed the assistant in `plugins/guidance` so it would inherit the manifest,
permission and audit path. That was right when guidance meant "walk me through a
third-party signup". The scope in the adopted document is larger: explaining the current
page, recommending which app to install, onboarding, navigation, and setup planning.

The deciding argument is ordering. The Guide has to work on a fresh workspace where the
owner has installed nothing — that is precisely when someone needs to be told what to
install. A default-installed plugin cannot be the thing that recommends plugins, and an
uninstallable one cannot be relied on by onboarding. So the Guide lives in `core/guide/`
and cannot be uninstalled from Marketplace (that is acceptance criterion 20).

PointAI stops being a top-level layer *and* stops being a standalone plugin. It is a
visual-guidance capability the Guide invokes, at `core/guide/pointai/`.

What R3 still governs: provider-specific setup knowledge stays plugin-contributed, via
the help/setup metadata contract in sections 46-47 of the adopted document. Core owns the
Guide; plugins own what they know about WordPress or Google Business.

What does not change: the safety boundary. PointAI points and instructs. It never clicks,
types, submits, reads or stores credentials, handles OTP or passkeys, or bypasses 2FA
(adopted document section 21, matching D5 here). Moving the code into core removes the
plugin permission gate that used to enforce part of this, so core must enforce it
directly — the boundary is now a property of the implementation, not of the sandbox.

Cost of this ruling, stated plainly: core grows by a subsystem that was going to be
optional, and the "everything is a plugin" symmetry from D1 now has a named exception.
The exception is Guide only. It is not a precedent for moving other capabilities into
core.

Not yet built. `core/guide/` does not exist, and the Guide's own 10-phase build order
runs after the platform phases already in flight.


### R6 — Two layers: the client product, and an operator control plane. Adopted 2026-09-09.

Everything built so far assumes one BusinessOS running on one machine. Selling to more
than one company makes that assumption expensive: every new customer and every new plugin
becomes manual deployment work.

So the system splits in two.

**The client product** is what a business owner sees, and it stays local-first and fully
functional on its own. **The operator control plane** is ours: the plugin registry, release
channels, staged rollouts, kill switches, tenant plans and entitlements, and installation
health. It is never visible to a customer.

**The privacy boundary is the whole point of the split, and it is enforced in code, not by
convention.** The control plane may receive only: tenant id, company name, core version,
installed plugin ids and versions, health state, last-seen time, plan, entitlements, update
channel and feature flags. It must never receive Company Brain content, customer records,
pricing, credentials, full audit contents, business files, or model conversation content.
`control-plane/telemetry-contract.mjs` holds an allowlist and drops everything else, so a
future careless caller cannot widen the channel by accident.

Consequences accepted:

- The Marketplace stops being a view over locally-present manifests and becomes a client of
  the registry. Installing means downloading a signed package and verifying it before it
  runs.
- Packages are signed with ed25519 and verified client-side. An unsigned or tampered
  package does not install, and that check is not skippable by configuration.
- The kill switch controls **known platform states only** — block a version, stop new
  installs, mark an update critical. It is not remote code execution, and it cannot make a
  client run anything it was not already going to run.
- The GitHub importer and repository analyzer, gated behind developer mode by R3/phase 3,
  now have their real home: the operator console's Plugin Studio, where a repository is
  analyzed, manifested, permission-scanned, tested in a sandbox, packaged, signed and
  published. It never returns to the owner-facing Marketplace.

Deferred deliberately: the real ABizCreator pilot run. It needs the owner's website,
staging WordPress and Search Console credentials, which we do not have yet. The SEO vertical
is already proven end to end against fakes and live against a public site.

Website Studio stays on the roadmap as an installable flagship plugin, not a core subsystem.

## Open questions

1. Which model serves element matching by default, after measurement (D3).
2. How the controlled Chromium window is embedded on Windows specifically, given the
   PWA/Tauri packaging path is not yet built (`IMPLEMENTATION_STATUS.md`).
3. Whether the code locator ships in this slice or the next. It is independent of the
   connection path and can be deferred without blocking anything.
4. Closed by R1/R4: the `core/*` scaffold directories are populated per the GrowthOS
   plan section 74, or removed individually. No wholesale deletion.
