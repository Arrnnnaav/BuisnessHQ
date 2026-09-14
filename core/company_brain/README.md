# Company Brain Engine

The Company Brain is the central knowledge repository that represents:
- Facts
- Entities and Relationships
- Policies and Procedures
- Skills and Decision Memory
- Semantic Metrics and Performance Learnings
- Provenance and Freshness Tracking

## Three Layers

### 1. Knowledge Layer
What the company knows:
- Business information
- Services and Products
- Catalogs and Pricing
- Customers and Suppliers
- Projects and Files
- Website Information

### 2. Operating Layer
How the business works:
- Pricing Policy and Procedures
- Quotation Workflow
- Discount Rules
- Complaint Handling
- Project Completion Process
- Review Request Procedures
- Publishing Rules
- Owner-Approval Rules

### 3. Semantic Layer
What important terms mean (deterministic definitions):
- Active Lead
- Stale Quote
- Won Customer
- Organic Lead
- Quote Conversion Rate
- Repeat Customer

## Core Components

### Ingestion + Normalization
Processes data from:
- Website
- Catalogs
- Spreadsheets
- Documents
- Photos
- CRM Systems
- Google Services
- Owner Input
- Historical Decisions

### Resolver
Routes and resolves company context for agents:
- Selects relevant information based on queries
- Avoids overwhelming agents with entire company knowledge
- Provides targeted context for specific tasks

### Context Builder
Builds structured context for agent consumption:
- Combines resolved knowledge
- Applies business rules and policies
- Formats data for agent understanding

### Learning + Write-back
Updates the Company Brain based on actions and outcomes:
- Classifies new knowledge (Fact, Decision, Policy, Procedure, Learning)
- Updates confidence scores and provenance
- Resolves conflicts between information sources
- Tracks performance learnings

## Data Model

Core entities stored in the Company Brain:
- Tenant
- Business
- Location
- Person
- Customer
- Product
- Service
- Project
- Lead
- Quote
- Rule
- Policy
- Decision
- Skill
- Workflow
- Event
- Metric
- Integration
- Approval
- AgentRun
- AuditEvent

Industry-specific extensions (like printing-specific structures) live in plugin configurations.