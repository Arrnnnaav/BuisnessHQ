# AI-Native Website Management Agent — ideation

**Status: superseded idea source. Not a plan.**

Superseded by `docs/superpowers/specs/2026-09-09-unified-platform-design.md` (decision D4:
"the Website Ops Agent is absorbed, not built"). This document is retained because that
spec names it as one of three roadmaps it replaces, and because its risk-tier model,
tool-call contract shape, diff-preview format, audit-entry format, and rollback semantics
were taken into the existing SEO and policy subsystems.

Where this document and the unified platform design disagree, the design document wins.

Specifically **not** carried forward, per that spec's "Explicitly not building" list:
the Website Ops Agent as a standalone subsystem; multi-channel (email/Slack/Teams/WhatsApp);
billing; white-label; agency multi-tenancy; automated production deployment.

Original document follows unchanged below.

---

# AI-Native Website Management Agent --- Extracted Idea, Expanded Concept & Build Plan

## 1. Source Content Extracted from the Screenshots

### Core idea

> "I wanted to manage my company website and publish blogs through AI
> chat, and also give access to non technical folks to update or manage
> the website without me being the middleman every time."

The creator built an agent that allows:

-   Approved team members to update the website.
-   A separate content team to create and publish blogs.
-   Website management through an AI agent/chat interface.
-   Non-technical team members to make website changes without depending
    on a developer.

### How it was built

The creator says they:

-   Vibe-coded the system using Codex.
-   Published the agent with Vercel's newly launched Eve framework.
-   Deployed it on Vercel.
-   Built the initial version in one day.

### AI gateway / model choice

The system also has an AI gateway where users can choose which model to
use and add credits.

The creator states that an update could cost roughly **₹50--₹100**,
depending on the model.

### Communication channels

The current team communicates with the agent through email.

The concept could also be connected to:

-   Slack
-   WhatsApp
-   Microsoft Teams
-   Other communication channels

### Business applications

For a web agency:

-   Turn the system into a subscription service.
-   Manage websites for multiple clients.
-   Provide an AI-native website-management service.

For a company:

-   Reduce turnaround time for small website changes.
-   Team members can simply chat with the agent or send an email instead
    of waiting for a developer.

### Bigger vision

The creator describes this as a starting point for:

-   Building and scaling multiple custom agents for businesses.
-   Giving web agencies a foundation for an AI-native practice.

------------------------------------------------------------------------

# 2. Expanded Problem Statement

## The problem

Most company websites are technically easy to change but operationally
difficult to maintain.

A typical request looks like:

> "Change this heading."

> "Update this pricing card."

> "Add this new customer logo."

> "Publish this blog."

> "Change the CTA."

> "Replace this image."

> "Update the team's bios."

The request usually travels through a chain:

**Employee → Manager → Developer → CMS/Git → Deployment → Verification**

This creates:

-   Delays
-   Developer dependency
-   Context switching
-   Repetitive work
-   Poor visibility into who changed what
-   Risk of unauthorized changes
-   Friction between marketing/content and engineering

The proposed solution is an **AI Website Operations Agent** that turns
natural-language requests into controlled website-management actions.

------------------------------------------------------------------------

# 3. The Better Product Definition

Instead of thinking of this as simply:

> "An AI agent that edits websites."

Define it as:

> **A permissioned AI operating layer for business websites.**

The agent sits between employees and the website's existing
infrastructure.

### High-level architecture

``` text
                    ┌───────────────────────────┐
                    │       Team Members        │
                    │                           │
                    │ Email / Slack / Teams /   │
                    │ WhatsApp / Web Chat       │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │     AI Gateway / Agent     │
                    │                           │
                    │ Intent Detection           │
                    │ Authentication             │
                    │ Authorization               │
                    │ Planning                   │
                    │ Tool Selection              │
                    │ Validation                 │
                    └─────────────┬─────────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
      │ Website/CMS │      │ Blog System │      │ Media/Assets│
      └─────────────┘      └─────────────┘      └─────────────┘
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  ▼
                    ┌───────────────────────────┐
                    │ Validation + Preview      │
                    │ Tests + Approval           │
                    └─────────────┬─────────────┘
                                  ▼
                    ┌───────────────────────────┐
                    │ Publish / Deploy / Rollback│
                    └───────────────────────────┘
```

------------------------------------------------------------------------

# 4. Core Product Capabilities

## 4.1 Website Editing

Users should be able to say:

-   "Change the homepage headline to ..."
-   "Update the pricing section."
-   "Replace the hero image."
-   "Add a new testimonial."
-   "Change the CTA button."
-   "Update our office address."
-   "Remove the old partner logo."

The agent translates the request into a structured operation.

Example:

``` text
User request:
"Change the homepage CTA from Book a Demo to Talk to Sales."

Agent:
1. Identify homepage.
2. Find CTA component.
3. Verify current text.
4. Prepare proposed change.
5. Show preview/diff.
6. Request approval if required.
7. Apply change.
8. Validate page.
9. Report result.
```

------------------------------------------------------------------------

# 5. Blog Publishing Agent

The content team should have a dedicated workflow.

### Example

``` text
User:
"Create a blog about how AI is changing customer support."

Agent:
    ↓
Research / supplied sources
    ↓
Create outline
    ↓
Draft article
    ↓
SEO optimization
    ↓
Generate metadata
    ↓
Create featured-image prompt
    ↓
Human review
    ↓
Approval
    ↓
Publish
```

### Blog fields

The agent should manage:

-   Title
-   Slug
-   Content
-   Author
-   Category
-   Tags
-   Featured image
-   Meta title
-   Meta description
-   Canonical URL
-   Publish date
-   Draft/published state

------------------------------------------------------------------------

# 6. Permission System

This is one of the most important parts of the product.

Do **not** give every user unrestricted website access.

Create roles.

## Suggested roles

### Admin

Can:

-   Configure the website.
-   Manage users.
-   Configure integrations.
-   Change permissions.
-   Approve high-risk actions.
-   View audit logs.

### Developer

Can:

-   Change code/configuration.
-   Manage deployments.
-   Modify integrations.
-   Handle technical failures.

### Content Manager

Can:

-   Create blogs.
-   Edit blogs.
-   Publish blogs if permitted.
-   Manage SEO metadata.

### Marketing

Can:

-   Edit approved marketing content.
-   Update campaigns.
-   Modify landing-page copy.
-   Request changes.

### General Employee

Can:

-   Request simple changes.
-   Submit content.
-   Request updates.

Cannot directly perform high-risk actions.

------------------------------------------------------------------------

# 7. Risk-Based Approval System

A major improvement over a simple chatbot is to classify actions by
risk.

## Low risk

Can execute automatically:

-   Change a typo.
-   Update a phone number.
-   Update a simple text field.
-   Change a blog draft.

## Medium risk

Require confirmation:

-   Change homepage copy.
-   Update pricing.
-   Replace images.
-   Publish a blog.
-   Modify SEO metadata.

## High risk

Require admin approval:

-   Delete pages.
-   Change navigation.
-   Modify DNS/domain settings.
-   Change production configuration.
-   Install integrations.
-   Change authentication.
-   Modify code.
-   Deploy major application changes.

This gives the agent autonomy without giving it unlimited authority.

------------------------------------------------------------------------

# 8. The Agent Should Use Tools, Not Directly "Control the Website"

A strong architecture separates the LLM from execution.

The LLM should decide:

> "I need to update the homepage CTA."

It should then call a controlled tool such as:

``` text
update_page_content(
    page="homepage",
    component="hero_cta",
    field="label",
    new_value="Talk to Sales"
)
```

Other tools could include:

``` text
get_page()
search_site()
update_content()
create_blog()
update_blog()
publish_blog()
upload_asset()
create_preview()
deploy_site()
rollback_deployment()
get_deployment_status()
get_audit_log()
```

The agent should **never** be given unrestricted shell/database access
in the production environment.

------------------------------------------------------------------------

# 9. Website Integration Strategy

There are three useful integration models.

## Model A --- CMS-first

Best for websites already using:

-   WordPress
-   Webflow
-   Contentful
-   Sanity
-   Strapi
-   Shopify
-   Other CMS platforms

The agent calls APIs and modifies structured content.

### Advantage

Safer and easier.

------------------------------------------------------------------------

## Model B --- Git-based website

For websites built with:

-   Next.js
-   React
-   Astro
-   Hugo
-   Other Git-based systems

The agent can:

1.  Read the repository.
2.  Understand the website structure.
3.  Identify the correct file/component.
4.  Create a change.
5.  Run tests/build.
6.  Create a preview deployment.
7.  Show the diff.
8.  Request approval.
9.  Merge/deploy.

This is much more powerful but requires stronger safeguards.

------------------------------------------------------------------------

## Model C --- Hybrid

This is probably the strongest long-term approach.

``` text
Structured content
        +
CMS/API
        +
Git/code changes
        +
Deployment system
```

Use the safest available interface for each task.

------------------------------------------------------------------------

# 10. The Website "Knowledge Layer"

The agent needs context before it can reliably change a website.

Create a website knowledge index containing:

-   Page list
-   Routes
-   Components
-   Content models
-   CMS fields
-   Brand guidelines
-   Tone of voice
-   SEO rules
-   Navigation structure
-   Deployment process
-   Environment information
-   User permissions
-   Previous changes

Example:

``` text
Website
├── Homepage
│   ├── Hero
│   ├── Logos
│   ├── Features
│   ├── Testimonials
│   └── CTA
├── About
├── Pricing
├── Contact
└── Blog
    ├── Posts
    ├── Categories
    └── Authors
```

This allows the agent to reason about the website instead of blindly
searching files.

------------------------------------------------------------------------

# 11. Change Preview / Diff

Before modifying production, the system should show:

``` text
CHANGE REQUEST

Homepage → Hero → CTA

Before:
Book a Demo

After:
Talk to Sales

Requested by:
Marketing Team

Risk:
LOW

[Approve] [Reject]
```

For code changes:

``` diff
- Book a Demo
+ Talk to Sales
```

For visual changes, generate a preview URL.

This is a major trust feature.

------------------------------------------------------------------------

# 12. Audit Log

Every action should be recorded.

Example:

``` text
2026-09-08 18:41

User:
marketing@company.com

Request:
"Update homepage CTA"

Agent:
Website Agent v1

Action:
update_page_content

Old:
Book a Demo

New:
Talk to Sales

Approval:
Approved by Marketing Manager

Deployment:
success

Rollback:
Available
```

This makes the system suitable for real businesses.

------------------------------------------------------------------------

# 13. Rollback

Every production change should be reversible.

The system should maintain:

``` text
Change
   ↓
Snapshot / Git commit
   ↓
Deployment
   ↓
Validation
```

If validation fails:

``` text
Deployment failed
       ↓
Automatic rollback
       ↓
Notify user
```

A user should be able to say:

> "Undo the change I made yesterday."

The agent should locate the relevant audit entry and revert it.

------------------------------------------------------------------------

# 14. Validation Layer

After every important change:

### Content validation

Check:

-   Required fields
-   Broken links
-   Missing images
-   Invalid URLs
-   SEO metadata
-   Formatting

### Technical validation

Run:

-   Build
-   Unit tests
-   Type checks
-   Lint
-   Integration checks

### Website validation

Check:

-   Page loads
-   HTTP status
-   Important elements exist
-   No obvious rendering failures

### Optional AI visual validation

Take screenshots of important pages and have a vision model compare:

``` text
Before
   vs
After
```

The AI can flag:

-   Broken layouts
-   Missing sections
-   Incorrect text
-   Unexpected visual changes

------------------------------------------------------------------------

# 15. Multi-Channel Agent

The web chat interface should not be the only interface.

Build a channel abstraction:

``` text
                  ┌───────────────┐
                  │ Agent Backend │
                  └───────┬───────┘
                          │
        ┌─────────┬───────┼────────┬─────────┐
        ▼         ▼       ▼        ▼         ▼
      Web       Email    Slack   Teams    WhatsApp
```

Every channel should eventually use the same:

-   Identity system
-   Permission system
-   Agent runtime
-   Tool layer
-   Audit log
-   Approval engine

This prevents building separate agents for every communication channel.

------------------------------------------------------------------------

# 16. Human-in-the-Loop Design

The system should not aim for 100% autonomy.

The better target is:

> **Maximum useful autonomy with controlled human approval.**

Example:

``` text
Simple typo
    ↓
Automatic

Homepage copy
    ↓
Preview
    ↓
User approval

Production code change
    ↓
Developer review
    ↓
Deploy
```

This is much more realistic for production use.

------------------------------------------------------------------------

# 17. Multi-Tenant Agency Version

The biggest commercial opportunity may be turning this into a platform
for web agencies.

## Agency architecture

``` text
Agency
│
├── Client A
│   └── Website Agent
│
├── Client B
│   └── Website Agent
│
├── Client C
│   └── Website Agent
│
└── Client D
    └── Website Agent
```

The agency gets one dashboard.

Each client gets:

-   Their own website
-   Their own users
-   Their own permissions
-   Their own knowledge base
-   Their own integrations
-   Their own usage/billing
-   Their own audit logs

------------------------------------------------------------------------

# 18. White-Label Opportunity

Agencies could offer:

> "Your AI Website Manager"

Instead of exposing the underlying platform.

For example:

``` text
Client
   ↓
myagency.ai
   ↓
Client-specific AI agent
   ↓
Client website
```

The agency can charge:

-   Setup fee
-   Monthly platform fee
-   Usage fee
-   Support fee
-   Premium automation fee

------------------------------------------------------------------------

# 19. Monetization Model

## Option 1 --- SaaS

Charge per website.

Example structure:

``` text
Starter
1 website
Limited users
Basic content updates

Business
Multiple users
Blog publishing
Approvals
Analytics
Integrations

Agency
Multiple client websites
White-label
Multi-tenant dashboard
Usage controls
```

## Option 2 --- Usage based

Charge according to:

-   AI tokens
-   Agent runs
-   Deployments
-   Content generation
-   Image generation

## Option 3 --- Hybrid

Best commercial model:

``` text
Monthly platform fee
+
AI usage
+
Premium integrations
```

------------------------------------------------------------------------

# 20. Cost-Control System

The model gateway should support model routing.

Do not use an expensive reasoning model for every task.

Example:

``` text
Simple text edit
        ↓
Cheap / fast model

Content generation
        ↓
Mid-tier model

Complex website reasoning
        ↓
Strong reasoning model

Code modification
        ↓
Coding/reasoning model
```

Add a policy such as:

``` text
Task complexity
       ↓
Model router
       ↓
Best model within budget
```

This can dramatically reduce operating cost.

------------------------------------------------------------------------

# 21. AI Gateway Strategy

A gateway can abstract the underlying model provider.

Instead of:

``` text
Agent → OpenAI
```

use:

``` text
Agent
  ↓
AI Gateway
  ├── Model A
  ├── Model B
  ├── Model C
  └── Model D
```

Benefits:

-   Provider flexibility
-   Fallback models
-   Cost optimization
-   Model experimentation
-   Better uptime
-   Per-task routing

------------------------------------------------------------------------

# 22. Core Backend Components

Recommended conceptual services:

``` text
API Gateway
    │
    ├── Authentication
    ├── Authorization
    ├── Tenant Management
    │
    ▼
Agent Orchestrator
    │
    ├── Intent Engine
    ├── Planning
    ├── Model Router
    ├── Tool Executor
    └── Approval Engine
    │
    ▼
Integration Layer
    ├── CMS
    ├── Git
    ├── Vercel
    ├── Storage
    ├── Email
    ├── Slack
    └── Teams
    │
    ▼
Observability
    ├── Audit Logs
    ├── Usage
    ├── Errors
    └── Cost Tracking
```

------------------------------------------------------------------------

# 23. Suggested Database Model

A simple initial schema could contain:

``` text
organizations
users
roles
permissions

websites
website_integrations
website_knowledge

agent_sessions
agent_messages
agent_runs

tool_calls
approval_requests

content_items
blog_posts
assets

changes
deployments
rollback_points

usage_events
model_usage
audit_logs
```

The critical relationship is:

``` text
Organization
    ↓
Website
    ↓
Users + Permissions
    ↓
Agent
    ↓
Tools
    ↓
Changes
    ↓
Deployments
```

------------------------------------------------------------------------

# 24. MVP Scope

Do **not** try to build everything initially.

The first version should prove one simple loop:

> **User request → AI understands → controlled website update → preview
> → approval → deployment → confirmation**

## MVP features

### 1. Authentication

-   Login
-   Organizations
-   Users

### 2. Website connection

Start with **one website technology**.

Prefer a stack where changes can be reliably represented as structured
content or Git changes.

### 3. AI chat

Example:

> "Change the homepage heading."

### 4. Website discovery

Agent understands:

-   Pages
-   Components
-   Content fields

### 5. Tool execution

Start with only a few tools:

``` text
get_page
search_content
update_content
create_preview
deploy
```

### 6. Approval

Show a diff before production changes.

### 7. Audit log

Record every change.

### 8. Rollback

Allow reverting the latest change.

That is enough to demonstrate the product.

------------------------------------------------------------------------

# 25. MVP User Journey

``` text
1. Admin connects website
        ↓
2. Agent scans/indexes website
        ↓
3. Admin adds team members
        ↓
4. Admin assigns roles
        ↓
5. Employee sends request
        ↓
6. Agent understands request
        ↓
7. Agent identifies required tool
        ↓
8. Agent creates proposed change
        ↓
9. System shows diff/preview
        ↓
10. User/manager approves
        ↓
11. Agent executes change
        ↓
12. Validation runs
        ↓
13. Deployment succeeds
        ↓
14. Audit log is updated
        ↓
15. User receives confirmation
```

------------------------------------------------------------------------

# 26. Phase-by-Phase Development Plan

## Phase 0 --- Architecture & Constraints

### Goal

Decide exactly what the first version supports.

### Tasks

-   Pick one website stack.
-   Pick one model gateway.
-   Define agent tools.
-   Define permissions.
-   Define approval rules.
-   Define deployment process.
-   Define rollback strategy.

### Deliverable

A small technical design document.

------------------------------------------------------------------------

# Phase 1 --- Website Connector

### Goal

Connect one real website.

Build:

-   Authentication
-   Website connection
-   Repository/CMS connection
-   Website scanner
-   Page/component index

### Success criterion

The system can answer:

> "What pages does this website have?"

and:

> "Where is the homepage hero heading?"

------------------------------------------------------------------------

# Phase 2 --- Agent Tool Layer

Build safe tools:

``` text
search_site
get_content
update_content
create_preview
validate_site
deploy_site
rollback_change
```

Each tool should have:

-   Strict input schema
-   Permission checks
-   Logging
-   Error handling
-   Validation

------------------------------------------------------------------------

# Phase 3 --- AI Agent

Implement:

``` text
User request
      ↓
Intent detection
      ↓
Plan
      ↓
Tool selection
      ↓
Tool execution
      ↓
Validation
      ↓
Response
```

Important:

The model should not directly manipulate infrastructure.

It should request tool calls.

------------------------------------------------------------------------

# Phase 4 --- Approval System

Add:

``` text
Risk classification
       ↓
Approval policy
       ↓
Human approval
       ↓
Execution
```

Example:

``` text
LOW
Typo correction
→ automatic

MEDIUM
Homepage change
→ confirmation

HIGH
Code/deployment/config
→ admin/developer approval
```

------------------------------------------------------------------------

# Phase 5 --- Blog Agent

Add:

-   Blog drafting
-   SEO
-   Metadata
-   Categories
-   Images
-   Preview
-   Approval
-   Publishing

This creates the second major use case.

------------------------------------------------------------------------

# Phase 6 --- Multi-Channel Interface

Start with:

1.  Web chat
2.  Email

Then:

3.  Slack
4.  Teams
5.  WhatsApp

Do not build separate agent logic for every channel.

All channels should feed into the same backend.

------------------------------------------------------------------------

# Phase 7 --- Agency Platform

Add:

-   Multiple organizations
-   Multiple websites
-   Client management
-   White-labeling
-   Usage billing
-   Team management
-   Per-client agents
-   Agency dashboard

------------------------------------------------------------------------

# 27. Advanced Features

Once the core system works, add:

## Scheduled website operations

> "Every Monday, update the homepage banner."

## Campaign automation

> "Create a landing page for our Diwali campaign."

## SEO agent

> "Find pages with weak metadata and suggest improvements."

## Website monitoring

> "Alert me if the website breaks."

## Broken-link agent

Automatically detect and suggest fixes.

## Content freshness agent

Detect outdated:

-   Pricing
-   Product descriptions
-   Statistics
-   Team information

## Analytics agent

> "Which landing page performed best last month?"

## Experimentation

> "Create two CTA variants and prepare an A/B test."

------------------------------------------------------------------------

# 28. Stronger Long-Term Vision

The end product should evolve from:

**AI website editor**

into:

**AI Website Operations Platform**

Eventually the agent can manage:

``` text
Content
SEO
Blogs
Landing Pages
Images
Navigation
Analytics
Deployments
Monitoring
Experiments
Forms
Integrations
```

The website becomes something employees can operate through natural
language.

------------------------------------------------------------------------

# 29. Important Security Principles

This product will have production access, so security should be designed
from day one.

## Never give the model:

-   Unrestricted production shell access
-   Arbitrary SQL access
-   Permanent deployment credentials
-   Unrestricted filesystem access

## Instead use:

-   Scoped credentials
-   Tool-level permissions
-   Tenant isolation
-   Approval gates
-   Audit logs
-   Rate limits
-   Secrets manager
-   Sandboxed execution
-   Short-lived credentials

------------------------------------------------------------------------

# 30. Agent Guardrails

Every action should pass:

``` text
Identity
   ↓
Permission
   ↓
Scope
   ↓
Risk
   ↓
Approval
   ↓
Execution
   ↓
Validation
   ↓
Audit
```

This becomes the central safety architecture.

------------------------------------------------------------------------

# 31. Example End-to-End Interaction

### Employee

> "Update the homepage headline to 'Build Faster With AI'."

### Agent

> I found the homepage hero heading.

``` text
Current:
Build software your customers love

Proposed:
Build Faster With AI

Risk:
Low
```

> Would you like me to apply this change?

### Employee

> Yes.

### Agent

``` text
Updating...
✓ Change applied
✓ Build passed
✓ Preview validated
✓ Production deployed

Deployment:
Successful
```

------------------------------------------------------------------------

# 32. Blog Example

### Content team

> "Create a blog about AI agents for small businesses and prepare it for
> review."

Agent:

``` text
✓ Researched topic
✓ Created outline
✓ Drafted article
✓ Added SEO title
✓ Added meta description
✓ Created slug
✓ Added recommended tags
✓ Prepared featured-image prompt

Status:
Draft ready for review
```

Then:

> "Publish it tomorrow at 10 AM."

The system creates a scheduled publishing job.

------------------------------------------------------------------------

# 33. Product Differentiation

A generic AI chatbot is not enough.

The product should differentiate through:

### 1. Deep website understanding

It knows the structure of the website.

### 2. Safe execution

It can actually make changes.

### 3. Permissions

Different people get different powers.

### 4. Approval workflows

Humans stay in control.

### 5. Rollbacks

Every change can be reversed.

### 6. Multi-channel access

Users can operate the website from wherever they already work.

### 7. Multi-tenant agency support

Agencies can operate many websites from one platform.

------------------------------------------------------------------------

# 34. Recommended Product Positioning

Avoid:

> "ChatGPT for websites."

Better:

> **"The AI operating layer for your website."**

Or:

> **"Let your team manage the website without waiting for developers."**

For agencies:

> **"Turn website maintenance into an AI-powered subscription
> service."**

------------------------------------------------------------------------

# 35. Recommended Technical Strategy

For the first serious prototype:

``` text
Frontend
→ Next.js / React

Backend
→ TypeScript service/API

Agent
→ Tool-calling LLM

Model Gateway
→ Provider abstraction / AI gateway

Database
→ PostgreSQL

Auth
→ Organization + RBAC system

Knowledge
→ Structured website index + vector search only where useful

Website integration
→ Git or CMS API

Deployment
→ Existing deployment platform

Storage
→ Object storage for assets

Observability
→ Structured logs + audit events
```

The exact vendors can be changed later. Keep the architecture
provider-agnostic.

------------------------------------------------------------------------

# 36. What NOT to Build First

Avoid these in V1:

-   Supporting every CMS.
-   Supporting every communication platform.
-   Fully autonomous code deployment.
-   Complex analytics.
-   A/B testing.
-   Advanced SEO automation.
-   Large plugin marketplace.
-   Custom model training.
-   Huge multi-agent architecture.

First prove:

> **Natural-language request → safe website change → approval →
> successful deployment.**

------------------------------------------------------------------------

# 37. Success Metrics

The product should be measured by outcomes.

### Primary metrics

-   Average time to complete website change.
-   Percentage of requests completed without developer involvement.
-   Successful deployment rate.
-   Rollback rate.
-   Human approval rate.
-   Agent failure rate.

### Business metrics

-   Websites per customer.
-   Monthly recurring revenue.
-   AI cost per website.
-   Gross margin.
-   Monthly active users.
-   Requests per website.

### Agency metrics

-   Number of clients managed per employee.
-   Maintenance hours saved.
-   Revenue per client.
-   Support tickets reduced.

------------------------------------------------------------------------

# 38. The Most Important Architectural Insight

The key idea is **not the chatbot**.

The difficult and valuable part is the controlled execution system
behind it:

``` text
Natural Language
       ↓
Intent
       ↓
Website Context
       ↓
Plan
       ↓
Permission
       ↓
Risk Classification
       ↓
Approval
       ↓
Tool Execution
       ↓
Validation
       ↓
Deployment
       ↓
Audit + Rollback
```

That pipeline is what turns an AI demo into a production product.

------------------------------------------------------------------------

# 39. Final Recommended Roadmap

## Version 0.1 --- Proof of Concept

Build:

-   Web chat
-   One website
-   Website scanner
-   3--5 tools
-   One model provider
-   Simple approval
-   Basic audit log

### Goal

Prove that a non-technical user can safely change website content.

------------------------------------------------------------------------

## Version 0.2 --- Production MVP

Add:

-   RBAC
-   Multi-user support
-   Preview
-   Deployment validation
-   Rollback
-   Blog publishing
-   Usage tracking
-   Better error recovery

### Goal

A real small company can use it daily.

------------------------------------------------------------------------

## Version 0.3 --- Multi-Channel

Add:

-   Email
-   Slack
-   Teams
-   WhatsApp

### Goal

Users don't need to open a separate dashboard.

------------------------------------------------------------------------

## Version 0.4 --- Agency Platform

Add:

-   Multi-tenancy
-   Multiple websites
-   Client dashboard
-   White-labeling
-   Billing
-   Usage limits

### Goal

A web agency can manage dozens/hundreds of client websites.

------------------------------------------------------------------------

## Version 1.0 --- AI Website Operations Platform

Add:

-   SEO agent
-   Analytics agent
-   Monitoring agent
-   Content agent
-   Campaign agent
-   Scheduled actions
-   Visual validation
-   Automated maintenance
-   Intelligent model routing

### Goal

Move from:

**"AI that changes my website"**

to:

**"AI that operates my website."**

------------------------------------------------------------------------

# 40. One-Sentence Product Thesis

> **Give every employee a safe, permission-aware AI interface to operate
> the company's website, while giving developers control over what the
> AI is actually allowed to do.**

That is the core product worth building.
