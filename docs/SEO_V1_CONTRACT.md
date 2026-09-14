# Locked V1 SEO Vertical Slice

## Security boundary

- `search_console.query.read` is read-only OAuth.
- `wordpress.production.page.read` is public/read-only.
- `wordpress.staging.draft.create` and `wordpress.staging.draft.update_owned` are the only WordPress writes.
- `wordpress.production.publish` and `wordpress.page.delete` are hard-denied by policy and are not exposed by the companion plugin.
- The encrypted vault stores connector references and credentials. Audit records never contain credential values or hidden model reasoning.

## Transaction

1. Crawl production and retain the website snapshot reference.
2. Import an immutable Search Console query/page snapshot.
3. Deterministically classify one of `low_ctr`, `ranking_gap`, `ranking_drop`, `wrong_intent`, or `cannibalization`.
4. Attach verified Company Brain references.
5. Ask Qwen3 4B for title and meta-description candidates only.
6. Run deterministic pre-publish validation.
7. Present the evidence, exact before/after values, and validator results in **Needs You**.
8. Freeze and hash the approved payload.
9. Create a staging-only, ownership-marked WordPress draft.
10. Read the draft back, compare it to the approved hash, and re-fingerprint production.
11. Mark the experiment `ACTIVE` only if the draft matches and production is unchanged.
12. Append a hash-chained audit record containing evidence, references, model metadata, approval, WordPress identifiers, fingerprints, verification and timestamps.

## Experiment lifecycle

`CREATED → AWAITING_APPROVAL → APPROVED → STAGING_WRITE_STARTED → VERIFICATION_PENDING → ACTIVE → MEASURING → COMPLETED`

Failure states are `REJECTED`, `VALIDATION_FAILED`, `STAGING_WRITE_FAILED`, `VERIFICATION_FAILED`, and `CANCELLED`.

## WordPress installation

Install `wordpress-plugin/businessos-connector` on staging only, define `BUSINESSOS_STAGING_SITE` as `true`, create a user with the **BusinessOS Connector** role, and generate an Application Password for that user. Production does not receive this write connector.
