# Plugin System

Plugins are the modular capability system that allows different businesses to have completely different configurations while sharing the same BusinessOS core.

## Philosophy

Instead of one giant monolith with every feature permanently running, BusinessOS uses a plugin architecture where:
- Core systems stay installed permanently
- Capabilities are installed as plugins
- Different companies can have completely different plugin configurations
- Plugins can be enabled/disabled without data loss
- Plugins can be completely uninstalled when no longer needed

## Plugin Structure

Each plugin should declare:

```
plugin/
├── manifest.json          # Plugin metadata, version, dependencies
├── permissions.json       # Required permissions and access levels
├── migrations/            # Database migration scripts
├── api/                   # API route definitions
├── dashboard/             # UI pages and components
├── widgets/               # Dashboard widgets and UI elements
├── tools/                 # Callable functions for agents
├── agents/                # Specialist agent definitions
├── skills/                # Executable business procedures
├── workflows/             # Multi-step business processes
├── events/                # Event listeners and emitters
├── settings/              # User-configurable options
└── health-checks/         # Health monitoring procedures
```

## Communication Patterns

Plugins should communicate through capabilities and events to avoid tight coupling:

### Event-Based Communication
Example flow:
1. Catalog plugin emits: `product.updated`
2. Pricing plugin listens for: `product.updated` → reevaluates pricing
3. Pricing plugin emits: `pricing.changed`
4. Website plugin listens for: `pricing.changed` → checks public pricing
5. Campaign plugin listens for: `pricing.changed` → verifies active promotions

This is much cleaner than direct code imports between plugins.

## Plugin Lifecycle

1. **Discovery** - System discovers available plugins
2. **Installation** - Plugin files are copied/extracted to plugin directory
3. **Initialization** - Plugin manifest is read, dependencies checked
4. **Activation** - Plugin is enabled and begins operation
5. **Configuration** - User configures plugin settings through UI
6. **Execution** - Plugin performs its designated functions
7. **Deactivation** - Plugin is temporarily disabled (data preserved)
8. **Uninstallation** - Plugin is permanently removed (with confirmation)

## Plugin Types

### Core Plugins (Always Present)
- Company Brain Interface
- Agent Orchestrator
- Workflow Engine
- Event Bus
- Policy/Risk Engine
- Approval System
- LLM Router
- Audit System
- Scheduler
- Notifications
- Auth/Security
- Secrets Management

### Business Apps (Revenue-Focused)
- Catalog/Products/Services
- CRM/Leads
- Projects
- Quotations
- Pricing & Margin Intelligence

### Growth Apps (Acquisition-Focused)
- SEO
- Local SEO
- Google Business Profile
- Reviews/Reputation
- Content
- Campaigns
- Competitor Intelligence
- Citations/Backlink Opportunities

### Intelligence Apps (Insight-Focused)
- Analytics (Search Console, GA4, GBP metrics)
- Lead Attribution
- Ranking Monitoring
- Reporting
- Opportunity Engine

### Communication Apps (Engagement-Focused)
- Email
- WhatsApp
- Social Channels
- Website Integration
- CMS Connectors

## ABizCreator Plugin Configuration

For the first client (ABizCreator printing business), enable:

### Business
- Catalog
- Products/Services
- Projects
- Customers
- CRM
- Leads
- Quotations
- Pricing & Margin Intelligence

### Growth
- SEO
- Local SEO
- Google Business Profile
- Reviews / Reputation
- Content
- Campaigns
- Competitor Intelligence
- Citations / Backlink Opportunities

### Analytics
- Search Console
- GA4
- Google Business metrics
- Lead attribution
- Ranking monitoring
- Reporting

### Communication
- Email
- WhatsApp
- Social channels

### Website
- Website crawler
- Website editor/CMS connector
- SEO publishing
- Rollback/versioning

## Development Guidelines

### Manifest Format
```json
{
  "id": "plugin-id",
  "name": "Human Readable Name",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "BusinessOS Team",
  "license": "MIT",
  "businessos": {
    "minVersion": "0.1.0",
    "ui": {
      "dashboard": true,
      "settings": true,
      "widgets": true
    }
  },
  "dependencies": [
    "plugin-id-for-dependency"
  ],
  "permissions": [
    "read:catalog",
    "write:projects",
    "execute:pricing_calculation"
  ]
}
```

### Permission System
Plugins declare required permissions which are granted by the owner during installation or runtime:
- `read:*` - Read access to data types
- `write:*` - Write/modify access to data types
- `execute:*` - Permission to run specific tools/skills
- `admin:*` - Administrative privileges

### Settings Storage
Plugin settings are stored in the shared data layer with plugin-specific namespacing to avoid conflicts.

### Health Checks
Each plugin should implement health check procedures that report:
- Connection status to external services
- Data freshness and validity
- Performance metrics
- Error rates and patterns