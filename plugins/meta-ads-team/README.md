# AI Meta Ads Team

This is the curated BusinessOS representation of the AI Meta Ads Team
architecture. It is one coordinated advertising operating system, not seven
independent chatbots.

The team contains the Orchestrator plus seven specialists:

1. Strategist — competitor research, audience and offer economics, angle briefs.
2. Copywriter — hooks, proof-led copy, headlines, CTAs, and placement variants.
3. Creative — static, video, carousel, ratio variants, and quality checks.
4. Media Buyer — draft campaign structures, targeting, budgets, and launch plans.
5. Optimizer — data-sufficiency checks, guarded recommendations, and fatigue rules.
6. Analyst — normalized metrics, attribution, diagnosis, and next-test briefs.
7. Account Manager — reports, approvals, client thread, and continuity.

The workflow is:

`research → copy → creative → build → launch → optimize → report → client → repeat`

All agent outputs are declarative artifacts. The plugin cannot directly spend
money, publish campaigns, change budgets, access credentials, or delete history.
The Meta adapter, sales source, and external client communication channel must
be connected separately; every write goes through the BusinessOS workflow and
approval engine.

## Safe staging behavior

- Read-only research and normalized metrics can be imported as evidence.
- Campaigns and ad sets are prepared as drafts and previews.
- Launch is approval-required and unavailable without a reviewed Meta adapter.
- Optimizer output is recommendation-only until per-client policy and real sales
  data are configured.
- Platform attribution is never treated as stronger than verified order data.
- Every artifact carries source evidence, model metadata, policy flags, and an
  audit reference.

The complete source architecture is retained in the supplied
`AI_META_ADS_TEAM_ARCHITECTURE.md`; these files are the executable marketplace
contract and staged implementation boundary for BusinessOS.
