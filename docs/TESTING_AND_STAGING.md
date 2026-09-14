# Testing Before Customer Deployment

For the containerized product path, follow `docs/DOCKER_DEPLOYMENT.md`. The Compose deployment binds the dashboard to localhost, persists both business data and models, and provisions the required Qwen3 4B and EmbeddingGemma models automatically.

Never use invented credentials against a real provider. They cannot authenticate, and attempting to bypass a provider's OAuth process is unsafe.

## Stage 1: Built-in Test Lab

Create an owner account, complete the company profile, import a sanitized sample catalog, then open **Test Lab**. Every supported action is simulated and produces no external effect:

- `seo.audit`
- `content.draft`
- `gbp.publish`
- `review.reply`
- `email.send`
- `pricing.recommendation`

Use this to validate catalog mapping, Company Brain context, policy tiers, approvals, output shape, and audit trails.

For a repeatable real local-AI smoke test, run `npm start` in one terminal and `npm run test:e2e:demo` in another. The script uses a development-only demo owner, keeps external writes disabled, selects the portable Qwen3 4B runtime, and asks a grounded question against the sanitized tenant. Qwen3 8B remains an opt-in model for higher-memory machines.

Set `BUSINESSOS_DATA_ROOT` to a dedicated temporary or staging directory when running
end-to-end checks. This keeps demo accounts, vault files, approvals, and audit events out
of the normal `data/` workspace.

When validating on a machine without Ollama, set `BUSINESSOS_E2E_REQUIRE_AI=0`. The
authenticated tenant, seed, approval, semantic-index, and safety checks still run; only
the final generation call is skipped. The default remains a real local-AI smoke test.

The dashboard **AI & Connections** page accepts one optional Gemini API key. It is encrypted locally and used only for cloud AI tasks. Ollama requires no API key. Google Business Profile, Search Console, analytics, email, WhatsApp, Meta, and website publishing still require separate official OAuth/service credentials.

## Pricing Agent Staging

The Pricing Agent is staging-enabled without a Gemini key. Run `npm run pricing:stage` to import the included fixture catalog, create a local SQLite database, generate synthetic competitor history, and write approval-only recommendations. The results are stored under `data/pricing_agent/`; no source catalog or external system is changed.

When a real catalog is ready, export a sanitized JSON array containing `sku`, `name`, `category`, `price`, and `cost`, then replace the `--catalog` input. Missing or invalid price/cost values are rejected and reported rather than guessed.

## Stage 2: Staging Tenant

Create an internal tenant such as `ABizCreator Demo`, using copied-but-sanitized catalog and website data. This tenant must have a separate owner account and no customer credentials.

Keep **External writes** disabled until every intended connector has passed its provider-supported test environment. Enabling the global switch requires the exact confirmation phrase `ENABLE EXTERNAL WRITES`; individual high-risk workflow approvals remain required after that switch is enabled.

Use provider-supported testing facilities where available:

- **Email:** MailHog, Mailtrap, or a dedicated non-customer mailbox.
- **WhatsApp:** Meta/WhatsApp test number and test recipients.
- **Meta:** developer app in development mode and test Page/Instagram account.
- **Google OAuth:** a separate Google Cloud project, test OAuth users, redirect URI for the staging domain, and a non-customer Google account. Google Business Profile actions ultimately require an approved account and a real test location/profile; do not post to a customer profile during testing.
- **Website:** staging subdomain, preview CMS environment, or Git branch with rollbacks enabled.

## Stage 3: ABizCreator Canary

Connect only ABizCreator's own accounts. Begin read-only, then drafts, then approval-only publishing. Use a small, explicitly chosen canary set: one website draft, one GBP post, one positive-review draft, and one test email. Verify each external result and its audit entry before expanding access.

## Stage 4: Customer Pilot

Onboard one consenting customer with explicit written permission. Keep publishing and pricing in approval mode, enable backups/rollback, monitor every action, and review the pilot weekly before enabling any low-risk automation.
