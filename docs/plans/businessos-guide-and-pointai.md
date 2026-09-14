# BusinessOS Guide + PointAI — Final Architecture and Implementation Specification

> **Status:** Proposed implementation spec based on the latest product direction.
>
> **Purpose:** This document defines exactly how the always-available BusinessOS Guide and PointAI should work inside GrowthOS so an engineering agent can implement the feature without ambiguity.
>
> **Important architectural change:** PointAI should no longer be treated as a normal optional Marketplace app by itself. Instead, the **BusinessOS Guide** becomes a fixed core feature. PointAI becomes a specialized visual-guidance capability invoked by the Guide when visual step-by-step help is useful.
>
> Provider-specific setup knowledge may still be contributed by plugins.
>
> **Repo status (2026-09-09):** Adopted. Its section 69 ruling is recorded as **R5** in
> `docs/superpowers/specs/2026-09-09-unified-platform-design.md`, superseding R3.
> Not yet implemented — no `core/guide/` exists. The safety boundary in section 21
> (point and instruct, never click, type, submit or handle credentials) is binding on
> any implementation and matches decision D5 in the spec.
> Its 10-phase build order (section 59) is separate from, and runs after, the GrowthOS
> platform phases in `growthos-architecture-and-frontend.md` section 96 onward.
>
> **Port status (2026-09-09).** Internal PointAI is built at `core/guide/pointai/` and
> `apps/dashboard/src/pointai/`, ported from `D:\PROJECTS\PointAI\PointAI`:
> `lib/matcher.js` became the element extractor and the deterministic scoring tier, and
> the ring/rAF tracking from `pages/PointAI.js` became the highlight overlay.
>
> Two things from that project were deliberately **not** ported. Its backend
> `POST /api/fetch` renders a third-party page as sanitized HTML inside an iframe; the
> adopted architecture forbids exactly that for authenticated provider pages
> (section 24, acceptance criterion 19), so external guidance waits for the controlled
> browser in a desktop shell. Its `/api/match` called a hosted Claude model as the primary
> matcher; here the deterministic tier runs first and the model is a fallback whose answer
> is validated against the real element list, so matching still works with no AI
> configured.

---

# 1. Product Definition

The BusinessOS Guide is the persistent assistant for the small-business owner.

It helps the owner:

```text
understand the dashboard
understand what each feature does
know what to do next
find the right plugin
understand why a plugin is recommended
configure installed plugins
connect external accounts
understand Company Brain
understand Needs You
create tasks and reminders
navigate BusinessOS
understand business metrics
invoke visual guidance when needed
```

PointAI is not the whole assistant.

PointAI is the visual-guidance mode used by the BusinessOS Guide.

---

# 2. Core Product Idea

The product should feel like:

> "I can ask BusinessOS what to do, where to go, what app I need, how to set something up, and if I get stuck on a screen it can point at exactly what I should click."

The user should never need to understand:

```text
OAuth
REST API
API scopes
redirect URI
manifest
plugin runtime
GitHub repository
MCP
application password
webhook
```

unless absolutely unavoidable.

The Guide translates technical setup into plain business language.

---

# 3. Final Architecture

```text
BUSINESSOS
│
├── CORE
│   ├── Authentication
│   ├── Workspace / Tenant
│   ├── Company Profile
│   ├── Company Brain
│   ├── Tasks / Reminders
│   ├── Needs You / Approvals
│   ├── AI Runtime / ModelRouter
│   ├── Plugin Runtime
│   ├── Policy / Risk
│   ├── Audit
│   ├── Notifications
│   ├── Marketplace
│   │
│   └── BUSINESSOS GUIDE
│       ├── Contextual Assistant
│       ├── Product Help
│       ├── Navigation Help
│       ├── Plugin Recommender
│       ├── Setup Planner
│       ├── Dashboard Guidance
│       └── PointAI
│           ├── Internal DOM Guidance
│           ├── External Controlled-Browser Guidance
│           ├── Element Matcher
│           ├── Highlight Overlay
│           ├── Step Tracker
│           └── Playbook Cache
│
└── GROWTH APPS / PLUGINS
    ├── SEO
    ├── Pricing
    ├── CRM
    ├── Catalog
    ├── Quotations
    ├── Projects
    ├── Content
    ├── Google Business
    └── ...
```

---

# 4. Core Decision

## BusinessOS Guide

The Guide is a **fixed core feature**.

It:

```text
is always installed
is always available in the UI
cannot be removed from Marketplace
does not appear as an installable app
shares the core ModelRouter
shares Company Brain
shares tasks
shares approvals
shares audit
shares tenant context
```

## PointAI

PointAI is a **capability of the Guide**.

It activates only when visual guidance is useful.

Examples:

```text
show me where to click
help me connect Search Console
where do I create an Application Password?
show me where this setting is
guide me through this page
```

---

# 5. Floating Guide UI

A small persistent icon should appear at the bottom-right of the dashboard.

Example:

```text
                                      ◉
```

Hover:

```text
Ask BusinessOS
```

Click opens a side panel.

---

# 6. Floating Guide Panel

Recommended layout:

```text
┌─────────────────────────────────────────────┐
│ BusinessOS Guide                       ×   │
├─────────────────────────────────────────────┤
│ What do you want to do?                     │
│                                             │
│ [ Ask anything...                        ]  │
│                                             │
│ Suggested                                  │
│ • What should I do today?                   │
│ • Explain this page                         │
│ • Which app do I need?                      │
│ • Help me improve Google ranking            │
│ • Help me connect Search Console            │
│ • Create a task                             │
├─────────────────────────────────────────────┤
│ Current context                             │
│ SEO Workspace                               │
└─────────────────────────────────────────────┘
```

The floating Guide is for quick contextual help.

The existing full Ask BusinessOS page remains for longer conversations.

---

# 7. Floating Guide vs Ask BusinessOS

## Floating Guide

Used for:

```text
quick questions
contextual help
navigation
plugin recommendations
setup assistance
visual guidance
small actions
```

## Ask BusinessOS Page

Used for:

```text
longer conversations
business analysis
multi-step planning
report interpretation
deeper Company Brain questions
```

Both use the same backend services and ModelRouter.

---

# 8. Guide Responsibilities

The Guide has five main responsibilities.

---

# 9. Responsibility 1 — Explain the Current Page

The Guide should know which route the owner is viewing.

Example context:

```text
route: /apps/seo
page: SEO Workspace
plugin: seo
```

User asks:

```text
"What do I do here?"
```

Guide answers using:

```text
route
page metadata
plugin metadata
setup state
company state
```

Example:

> This page helps you find opportunities in Google Search. Your website is connected, but Search Console is not. Connecting it will let SEO use real query, impression, click and ranking data.

Actions:

```text
[Connect Search Console]
[Guide Me]
```

---

# 10. Responsibility 2 — Recommend Plugins

The owner should not need to understand the entire Marketplace.

Examples:

```text
"I want to manage customers."

"I want to track enquiries."

"I want to know which services make profit."

"I want more Google leads."

"I want to send quotations faster."
```

The Guide maps the user goal to required capabilities.

Example:

```text
User intent:
manage customer follow-ups

Required capability:
crm.lead_management

Provider:
CRM plugin
```

Then:

> CRM is the app you need. It lets you store customers, track enquiries, manage follow-ups and see lead stages.

Actions:

```text
[Install CRM]
[Learn More]
```

---

# 11. Plugin Recommendation Must Not Be Pure LLM Guessing

Use deterministic capability matching first.

Flow:

```text
User Request
↓
Intent / Goal Classification
↓
Capability Requirements
↓
Installed Capability Check
↓
Marketplace Capability Index
↓
Plugin Recommendation
↓
LLM Explanation
```

The model explains the recommendation.

The capability index decides which plugin can satisfy the need.

---

# 12. Capability Recommendation Example

```text
User:
"I want to know which products are most profitable."

Detected goals:
profitability
pricing analysis
margin tracking

Required capabilities:
pricing.margin_analysis
pricing.cost_analysis

Recommended:
Pricing plugin
```

Optional secondary recommendation:

```text
Quotations
```

only if it materially supports the user's goal.

Avoid recommending unnecessary plugins.

---

# 13. Responsibility 3 — Guide BusinessOS Usage

The Guide should help users operate the GrowthOS dashboard itself.

Examples:

```text
"What is Company Brain?"

"What is Needs You?"

"How do I add a new product?"

"Where can I disable SEO?"

"How do I create a task?"

"What does this metric mean?"

"How do I install CRM?"
```

Because BusinessOS owns its own frontend, internal guidance can directly highlight elements in the current dashboard.

---

# 14. Internal PointAI Mode

Inside BusinessOS itself, the Guide can use normal DOM access.

Flow:

```text
User:
"Show me where to add a product."

↓
Guide resolves target action

↓
Internal PointAI mode

↓
Highlight:
Add Product

↓
Tooltip:
Click here to create a new product.
```

No controlled browser is required for internal BusinessOS pages.

---

# 15. Internal Guidance Capabilities

Internal visual guidance may:

```text
highlight buttons
highlight tabs
highlight form fields
scroll to a section
show numbered steps
show a tooltip
show a short explanation
```

It should not automatically execute business actions merely because it can access the DOM.

Internal navigation may be automated only for safe product navigation if explicitly designed.

For high-risk actions, normal approval/policy still applies.

---

# 16. Responsibility 4 — Help Configure Plugins

Every installed plugin may require setup.

Examples:

```text
SEO:
website
Search Console

Google Business:
Google account
business profile

Website:
WordPress staging

Email:
email provider

WhatsApp:
business account
```

The Guide should know:

```text
which plugin is installed
which setup requirements are complete
what is missing
what order setup should happen
```

---

# 17. Plugin Setup Requirements

Plugins should be able to declare setup metadata.

Conceptual structure:

```text
setup_requirements:
  - id: search_console
    title: Connect Google Search Console
    required: true
    capability: google.search_console.read
    guide_flow: search-console-connect
```

The core Guide uses these declarations.

---

# 18. Plugin-Contributed Help Metadata

Plugins may contribute:

```text
capabilities
help topics
setup requirements
recommended use cases
suggested actions
Guide prompts
PointAI setup flows
```

This prevents the core Guide from hardcoding every plugin forever.

Example SEO plugin:

```text
help_topics:
- "What is an SEO opportunity?"
- "Why do I need Search Console?"
- "What does CTR mean?"

recommended_when:
- improve_google_ranking
- grow_organic_traffic
- understand_search_performance
```

---

# 19. Responsibility 5 — External Setup Guidance

When the owner needs to perform an action inside a third-party website, the Guide can activate external PointAI mode.

Examples:

```text
Google Search Console
Google Cloud
WordPress Admin
Meta Business
WhatsApp Business
other provider consoles
```

The Guide should not try to automate these account interfaces.

---

# 20. External PointAI Mode

Flow:

```text
User:
"Help me connect WordPress."

↓
BusinessOS Guide determines:
Application Password required

↓
User clicks:
Guide Me

↓
Controlled browser opens WordPress Admin

↓
PointAI inspects visible interactive elements

↓
Highlights:
Users

↓
Owner clicks

↓
Highlights:
Profile

↓
Owner clicks

↓
Highlights:
Application Passwords

↓
Owner creates credential manually

↓
Guide returns to BusinessOS
```

---

# 21. Permanent PointAI Safety Boundary

PointAI may:

```text
read page structure
identify interactive elements
highlight an element
show arrows / rings
show click instructions
show what text belongs in a non-sensitive field
track progress
maintain a playbook
```

PointAI must never:

```text
click
submit
enter passwords
read password values
store passwords
handle OTP values
handle passkeys
bypass 2FA
approve account permissions
operate an account autonomously
```

This is a permanent product rule.

---

# 22. Credential Handling

When setup produces a credential:

```text
PointAI guides owner to create it
↓
Owner copies it
↓
PointAI mode ends / ignores credential content
↓
BusinessOS secure connection field receives it
↓
Credential Vault encrypts it
```

PointAI itself should not receive the value.

---

# 23. Sensitive Field Handling

PointAI should identify sensitive UI fields such as:

```text
password
OTP
secret
API key
token
private key
credit card
```

When such a field is detected:

```text
do not inspect value
do not log value
do not send value to a model
do not include value in screenshots/context
```

It may say:

> Enter the value requested by the provider here.

But never read the value.

---

# 24. External Browser Architecture

The final external PointAI experience should use an app-controlled browser window rather than iframe copies for sites that block framing.

Conceptually:

```text
BusinessOS Desktop Shell
↓
Controlled Browser Window
↓
Real Authenticated Third-Party Page
↓
PointAI Overlay
```

The existing PWA is sufficient for the core product but not sufficient for real third-party overlay guidance.

A native shell / controlled Chromium surface is required before full external PointAI deployment.

---

# 25. Internal vs External Guidance

```text
INTERNAL BUSINESSOS PAGE
→ normal DOM access
→ direct highlight

EXTERNAL PROVIDER PAGE
→ controlled browser
→ injected overlay
→ user performs all actions
```

Both are exposed through the same Guide UI.

---

# 26. PointAI Element Matching

For a page, extract compact interactive-element metadata.

Example:

```text
index
tag
text
aria-label
role
href
placeholder
nearby text
visibility
disabled state
```

Do not send the full page DOM to the model unless necessary.

---

# 27. PointAI Matching Flow

```text
Goal
↓
Current URL / Host
↓
Current Step
↓
Interactive Element List
↓
Playbook Cache
↓
If valid cached element exists:
    reuse
Else:
    ModelRouter match
↓
Return:
element index
confidence
explanation
optional next-step plan
```

---

# 28. Playbook Cache

Cache key:

```text
tenant_id
host
normalized_goal
step_context
```

Cached element signature:

```text
tag
text
aria
role
href pattern
nearby text
```

On reuse:

```text
re-resolve against current DOM
```

If no longer found:

```text
delete stale cache
rerun matching
```

Never trust stale page coordinates.

---

# 29. Model Architecture

Use the existing BusinessOS ModelRouter.

Do not create a new model gateway.

---

# 30. Model Responsibilities

## Qwen3 4B

Good for:

```text
simple page explanation
plugin recommendation explanation
summaries
help answers
basic goal classification
small internal navigation tasks
```

## Deterministic Code

Use for:

```text
capability matching
installed plugin checks
route lookup
connection state
permission state
plugin setup state
task execution permissions
navigation metadata
sensitive-field handling
```

## PointAI Element Matching

Use the ModelRouter with a dedicated task type.

Example:

```text
task = guidance.element_match
```

The default provider should be chosen after accuracy testing.

---

# 31. PointAI Model Routing

Suggested routing:

```text
Privacy mode:
Qwen3 4B

Balanced:
Qwen3 first
cloud fallback if confidence too low

Highest Quality:
strong cloud model where configured

Lowest Cost:
Qwen3
```

The system must make clear if cloud usage sends page structure outside the machine.

---

# 32. Guide Context Package

Every Guide request should receive a compact structured context.

Suggested fields:

```text
tenant_id
company_id
current_route
current_page
current_plugin
company_profile_summary
business_goals
installed_plugins
enabled_plugins
available_plugins
connected_accounts
setup_requirements
profile_completion
needs_you_count
tasks_due
recent_activity
relevant_company_brain_refs
current_ui_actions
```

Do not send the entire database.

---

# 33. Example Context

```text
tenant:
abizcreator

route:
/apps/seo

installed:
seo
catalog
pricing

connections:
website = connected
search_console = disconnected

business_goals:
increase local visibility
generate more enquiries
```

Guide response:

> SEO is installed and your website is connected. The next useful step is Search Console because it lets BusinessOS use real Google queries, impressions, clicks and ranking data.

Actions:

```text
[Connect Search Console]
[Guide Me]
```

---

# 34. Proactive Suggestions

The Guide may proactively surface useful recommendations.

Examples:

```text
Search Console missing
CRM might solve repeated manual lead tracking
Profile missing service areas
Pricing installed but catalog incomplete
Task overdue
Approval waiting
```

These should appear subtly.

Do not create intrusive popups.

Use:

```text
floating icon badge
Home suggestion card
small contextual hint
```

---

# 35. Recommendation Rules

A proactive recommendation must be:

```text
evidence-backed
relevant to a current goal
actionable
non-repetitive
dismissible
```

Do not recommend a plugin simply because it exists.

---

# 36. Plugin Recommendation Example

Company state:

```text
23 customers entered manually
CRM not installed
goal = improve follow-up
```

Guide:

> You are already storing customer information manually. CRM can add lead stages and follow-up reminders.

Actions:

```text
[View CRM]
[Not Now]
```

---

# 37. Home Integration

The Home dashboard may show:

```text
Ask BusinessOS
Top Opportunity
Tasks
Needs You
Recent AI Work
```

The Guide icon remains persistent.

Home suggestions may be generated by:

```text
core
installed plugins
Guide recommendation engine
```

---

# 38. Task Creation Through Guide

Examples:

```text
"Remind me tomorrow at 10 to call the supplier."

"Create a task to approve the SEO change today."

"Add a meeting with Rajesh Friday at 3 PM."
```

The Guide calls core task/reminder capabilities.

It does not need a task plugin.

---

# 39. Guide Action Architecture

The Guide should never directly mutate arbitrary data from free-form model output.

Flow:

```text
User Request
↓
Intent
↓
Capability
↓
Structured Action
↓
Validation
↓
Policy
↓
Execute
```

Example:

```text
tasks.create
plugins.install
navigation.open
```

---

# 40. Safe Navigation Actions

The Guide may expose structured internal navigation actions such as:

```text
navigation.open("/apps/seo")
navigation.open("/marketplace")
navigation.open("/tasks")
```

The model proposes the target.

The core validates route existence before navigation.

---

# 41. Plugin Installation Through Guide

Example:

```text
User:
"I need CRM."

Guide:
CRM is recommended.

[Install CRM]
```

Click:

```text
plugin install endpoint
↓
PluginInstallation created
↓
plugin enabled
↓
navigation registered
↓
CRM appears at bottom of Growth Apps
```

The Guide does not bypass plugin lifecycle.

---

# 42. Guide and Marketplace Relationship

Marketplace remains the catalog.

Guide is the intelligent discovery layer.

```text
Marketplace
= browse apps manually

Guide
= tell BusinessOS what you need
  and get the right app suggested
```

Both should use the same Marketplace/Capability index.

---

# 43. Guide and Company Brain Relationship

The Guide should use Company Brain to understand:

```text
what the company does
what services exist
where it operates
what business goals exist
what rules matter
what has already been configured
```

But product-help answers should not require Company Brain when not relevant.

---

# 44. Guide and Needs You

The Guide can explain approvals.

Example:

```text
"Why do I need to approve this?"
```

Guide retrieves:

```text
approval
risk
evidence
policy
before/after
```

and explains it in plain language.

The Guide must not approve on behalf of the owner.

---

# 45. Guide and Plugin Pages

Each plugin can expose a `guide_context` declaration.

Example:

```text
seo:
page_purpose
key_actions
setup_requirements
common_questions
capabilities
```

When the user opens SEO, the Guide automatically gains relevant plugin context.

---

# 46. Guide Metadata Contract for Plugins

Conceptual example:

```json
{
  "guide": {
    "summary": "Find and improve Google search opportunities.",
    "capabilities": [
      "seo.search_console_analysis",
      "seo.opportunity_detection"
    ],
    "recommended_for": [
      "improve_google_rankings",
      "increase_organic_leads"
    ],
    "help_topics": [
      "What is CTR?",
      "Why connect Search Console?"
    ],
    "setup_flows": [
      "search-console-connect"
    ]
  }
}
```

---

# 47. Setup Flow Contract

A provider setup flow should define:

```text
flow_id
plugin_id
goal
provider
preconditions
completion_check
safe instructions
PointAI allowed
sensitive fields
```

Example:

```text
flow_id:
search-console-connect

plugin:
seo

provider:
google

goal:
connect Search Console
```

---

# 48. Guide Flow State

Store:

```text
tenant_id
flow_id
current_step
started_at
last_url
status
```

Status:

```text
active
completed
cancelled
blocked
```

Do not store credentials in flow state.

---

# 49. Guide Audit Events

Important Guide actions should be auditable.

Examples:

```text
guide.question_answered
guide.plugin_recommended
guide.setup_started
guide.pointai_highlighted
guide.setup_completed
guide.internal_navigation
```

Do not log sensitive entered text.

---

# 50. PointAI Audit

Store:

```text
tenant
goal
provider host
step
matched element signature
confidence
model/provider used
cache hit/miss
timestamp
```

Do not store:

```text
password
OTP
token
secret field contents
private page content beyond needed safe metadata
```

---

# 51. Error Handling

If PointAI cannot confidently identify the correct element:

```text
do not guess
```

Show:

> I can't confidently find the next control on this page.

Actions:

```text
[Try Again]
[Show Text Instructions]
[Cancel]
```

Never point confidently at an uncertain element.

---

# 52. Confidence Thresholds

Conceptual:

```text
high confidence:
highlight directly

medium confidence:
show candidate + ask user to confirm

low confidence:
do not highlight
```

Exact thresholds should be tuned through testing.

---

# 53. Internal Highlight UX

Use:

```text
animated ring
subtle arrow
tooltip
screen dimming around target
```

Avoid:

```text
flashing
large intrusive overlays
covering important controls
```

---

# 54. Guide UI States

Floating icon states:

```text
idle
thinking
suggestion_available
setup_active
needs_attention
```

Examples:

```text
◉
◉•
◉1
```

Keep visually subtle.

---

# 55. Guide Panel Sections

Possible panel structure:

```text
Chat
Suggested Actions
Current Page Help
Setup Progress
```

Do not overload V1.

Recommended V1:

```text
chat
context-aware quick actions
active setup step
```

---

# 56. V1 Guide Scope

Implement first:

```text
floating Guide icon
side panel
current-page awareness
core help
plugin recommendation
internal dashboard highlighting
plugin setup requirements
Guide Me actions
basic PointAI setup flow architecture
task creation
navigation actions
```

---

# 57. V1 PointAI Scope

Implement:

```text
internal dashboard guidance first
existing PointAI matching logic adapted
tenant-scoped playbook cache
ModelRouter integration
step tracker
confidence handling
sensitive-field rules
```

External controlled-browser guidance comes after native browser-shell support is available.

---

# 58. V1 Do Not Build

Do not build yet:

```text
autonomous clicking
autonomous typing
browser extension
credential handling
generic automation across arbitrary sites
full voice assistant
mobile PointAI
hundreds of hardcoded tutorials
```

---

# 59. Build Order

## Phase 1 — Core Guide Shell

Build:

```text
floating icon
Guide panel
Guide service
context builder
route awareness
conversation state
```

---

## Phase 2 — Product Help

Build:

```text
page metadata registry
core help topics
Explain This Page
contextual quick actions
```

---

## Phase 3 — Plugin Recommendation

Build:

```text
Marketplace capability index
goal → capability mapping
capability → plugin matching
recommendation UI
Install action
```

---

## Phase 4 — Internal PointAI

Build:

```text
DOM target registry
internal element matcher
highlight overlay
step instructions
show-me-where action
```

---

## Phase 5 — Plugin-Contributed Guide Metadata

Extend plugin manifests/contracts with:

```text
guide summary
capabilities
recommended_for
help_topics
setup_flows
```

---

## Phase 6 — Setup Planner

Build:

```text
plugin setup requirements
setup readiness checks
missing connection detection
Guide Me buttons
setup flow state
```

---

## Phase 7 — PointAI Port

Port useful concepts from the existing PointAI project:

```text
interactive element extraction
goal matching
confidence
step planning
playbook cache
self-healing stale entries
```

Replace:

```text
separate FastAPI runtime
MongoDB
separate provider wrapper
```

with BusinessOS services.

---

## Phase 8 — ModelRouter Integration

Add dedicated task:

```text
guidance.element_match
```

Evaluate Qwen3 4B first.

Measure cloud fallback accuracy if needed.

---

## Phase 9 — External Controlled Browser

Before real external provider guidance:

```text
native desktop shell
controlled Chromium window
overlay injection
secure bridge to Guide
```

Do not use iframe copies for authenticated Google/WordPress flows.

---

## Phase 10 — First Real Guided Setup

Recommended first flows:

```text
Search Console connection
WordPress Application Password setup
```

Success criterion:

> A non-technical owner completes setup using the Guide without external documentation or developer help.

---

# 60. Recommended Directory Structure

```text
core/
  guide/
    guide-service.mjs
    guide-context.mjs
    guide-router.mjs
    capability-recommender.mjs
    setup-planner.mjs
    help-registry.mjs
    actions/
      navigation-actions.mjs
      plugin-actions.mjs
      task-actions.mjs
    pointai/
      element-extractor.mjs
      element-matcher.mjs
      confidence.mjs
      playbook-cache.mjs
      step-runner.mjs
      sensitive-fields.mjs
      audit.mjs

apps/dashboard/src/
  core/
    guide/
      GuideLauncher.jsx
      GuidePanel.jsx
      GuideChat.jsx
      GuideQuickActions.jsx
      GuideSetupStep.jsx
      GuideSuggestionBadge.jsx
  pointai/
    InternalOverlay.jsx
    HighlightRing.jsx
    Tooltip.jsx
    StepIndicator.jsx
```

Future desktop shell:

```text
apps/desktop/
  controlled-browser/
```

---

# 61. Core APIs

Suggested APIs:

```text
POST /api/guide/message
GET  /api/guide/context
GET  /api/guide/suggestions
POST /api/guide/action
POST /api/guide/setup/:flowId/start
POST /api/guide/setup/:flowId/step
POST /api/guide/setup/:flowId/complete
```

Internal PointAI:

```text
POST /api/guide/pointai/match
```

---

# 62. Guide Action Schema

Example:

```json
{
  "type": "plugin.install",
  "plugin_id": "crm"
}
```

or:

```json
{
  "type": "navigation.open",
  "route": "/apps/seo"
}
```

or:

```json
{
  "type": "tasks.create",
  "title": "Call supplier",
  "due_at": "..."
}
```

All actions are validated by deterministic code.

---

# 63. Plugin Recommendation Response Schema

```json
{
  "goal": "manage customer follow-ups",
  "recommended_plugin": "crm",
  "reason": "CRM provides lead tracking and follow-up capabilities.",
  "required_capabilities": [
    "crm.lead_management",
    "crm.followups"
  ],
  "already_installed": false
}
```

---

# 64. PointAI Match Response

```json
{
  "element_index": 14,
  "confidence": 0.93,
  "instruction": "Click Settings.",
  "step": 2,
  "total_steps": 5
}
```

No raw chain-of-thought.

---

# 65. Core / Plugin Boundary

Core Guide owns:

```text
Guide UI
context builder
product help
navigation help
plugin recommendation logic
setup planner
internal PointAI
external PointAI runtime
playbook cache
safety rules
```

Plugins own/contribute:

```text
plugin capabilities
plugin help metadata
plugin setup requirements
plugin-specific setup flows
plugin-specific suggested actions
```

---

# 66. Why the Guide Is Core

It should be core because:

```text
every owner needs help
it helps operate BusinessOS itself
it recommends plugins before they are installed
it assists onboarding
it is the fallback when a user is confused
it coordinates setup across multiple plugins
```

A user should never have to install the assistant that explains how to install apps.

---

# 67. Why PointAI Is Not a Normal Marketplace App

If PointAI were a removable plugin:

```text
user could uninstall their primary help system
onboarding could depend on an uninstalled feature
plugin recommendation would depend on a plugin
dashboard help would disappear
```

Therefore the visual-guidance runtime should live under the core Guide.

---

# 68. Provider-Specific Setup Still Remains Modular

Example:

```text
SEO plugin
→ contributes Search Console setup metadata

Website plugin
→ contributes WordPress setup metadata

Google Business plugin
→ contributes GBP setup metadata
```

So the core does not become a giant hardcoded provider manual.

---

# 69. Ruling to Add to Existing Decision Record

The current architecture previously treated PointAI as a plugin.

If this specification is adopted, add a new reconciliation ruling:

```text
R5 — BusinessOS Guide becomes core; PointAI becomes a Guide capability.

R3 is superseded.

Reason:
The guidance scope expanded beyond third-party setup into
persistent dashboard assistance, product explanation,
plugin discovery, onboarding, navigation and setup planning.

The Guide must be available before any optional plugin is
installed.

Provider-specific guidance remains plugin-contributed.

The PointAI safety boundary remains unchanged:
it points and instructs, but never clicks, types, submits,
handles credentials or bypasses authentication.
```

Do not silently implement this change without updating the decision record.

---

# 70. Acceptance Criteria

The feature is considered correctly implemented when:

1. A floating Guide icon exists on normal dashboard pages.
2. Clicking it opens a context-aware Guide panel.
3. The Guide knows the current route/page.
4. The Guide can explain the current page.
5. The Guide can recommend a plugin from a user goal.
6. Recommendations are based on declared capabilities, not arbitrary LLM guessing.
7. The Guide can install a plugin only through the normal plugin lifecycle.
8. The Guide can create a core task/reminder.
9. The Guide can navigate to validated internal routes.
10. Internal "show me where" guidance can highlight BusinessOS controls.
11. Plugins can contribute help/setup metadata.
12. The Guide can detect when an installed plugin is missing setup.
13. `Guide Me` can start a setup flow.
14. PointAI never clicks, types, submits or handles credentials.
15. Sensitive field values are never sent to the model or audit.
16. Playbook cache is tenant-scoped and self-healing.
17. All Guide actions are attributable in the audit log.
18. The full Ask BusinessOS page and floating Guide share the same backend.
19. PointAI external-page guidance is not implemented using iframe copies for authenticated provider pages.
20. The core Guide cannot be uninstalled from Marketplace.

---

# 71. Final User Experience

Example journey:

```text
Owner opens BusinessOS

↓
Clicks floating Guide icon

"I want more leads from Google."

↓
Guide checks capabilities

SEO not installed.

↓
Guide:
"SEO can help you find Google search opportunities
using your real website and Search Console data."

[Install SEO]

↓
SEO installs and appears at bottom of Growth Apps.

↓
Guide:
"SEO is installed. Search Console still needs to be connected."

[Connect] [Guide Me]

↓
Owner clicks Guide Me

↓
PointAI guides the owner through the external setup.

↓
Owner completes the provider steps manually.

↓
BusinessOS verifies the connection.

↓
SEO begins using real data.

↓
Guide later explains opportunities and helps the owner
navigate the SEO workflow.
```

---

# 72. Final Architecture Summary

```text
BusinessOS Guide
= always-on core owner assistant

PointAI
= visual guidance mode inside the Guide

Marketplace
= source of optional business apps

Plugins
= optional business capabilities

Company Brain
= verified company knowledge

ModelRouter
= shared AI provider layer

Tasks
= core follow-up/reminder layer

Needs You
= human decision layer
```

The Guide ties all of them together.

---

# 73. Final Product Principle

The owner should never need to ask:

> "Which technical system do I need to understand?"

They should be able to ask:

> "What do I want to achieve?"

BusinessOS should then:

```text
understand the goal
↓
identify the required capability
↓
recommend or open the right app
↓
explain the next step
↓
guide setup if required
↓
invoke PointAI if visual guidance is needed
↓
return to the business workflow
```

That is the intended role of the BusinessOS Guide + PointAI architecture.
