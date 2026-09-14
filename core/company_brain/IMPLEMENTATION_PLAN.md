# Company Brain Implementation Plan

## Phase 1: Basic Storage Layer
- SQLite database schema for core entities
- Basic CRUD operations
- File storage abstraction (local filesystem initially)
- Vector store initialization (Chroma/Qdrant)

## Phase 2: Knowledge Ingestion
- Website crawler and extractor
- Document parser (PDF, DOCX, Excel, CSV)
- Image metadata extraction
- CRM system connectors
- Google API integrations (Search Console, Analytics, Business Profile)
- Manual input forms and conversation learning

## Phase 3: Knowledge Organization
- Entity relationship mapping
- Confidence scoring system
- Provenance tracking (source, verified_by, timestamps)
- Conflict detection and resolution mechanisms
- Data validation and normalization

## Phase 4: Resolver and Context Building
- Query understanding and intent classification
- Relevant data selection algorithms
- Context aggregation and formatting
- Caching layer for performance
- Context size optimization

## Phase 5: Executive Functions
- Skills and procedures storage
- Policy and rule engine
- Decision memory and learning system
- Semantic layer with deterministic definitions
- Performance learnings and analytics integration

## Phase 6: API and Integration
- RESTful API for core brain operations
- Event publishing/subscription
- Plugin interface for extensions
- Admin UI for knowledge management
- Export/import capabilities

## Technical Components

### Database Schema (Initial)
```sql
-- Core entities
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'business', 'person', 'product', etc.
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relationships
CREATE TABLE relationships (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL,
    properties JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES entities(id),
    FOREIGN KEY (target_id) REFERENCES entities(id)
);

-- Properties with provenance
CREATE TABLE entity_properties (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT,
    verified_by TEXT,
    valid_from TIMESTAMP,
    valid_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id)
);

-- Skills and procedures
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps JSON NOT NULL, -- Ordered array of step objects
    required_context JSON, -- What context is needed
    guardrails JSON, -- Safety constraints
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Decisions and policies
CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    rationale TEXT,
    approved_by TEXT,
    approved_at TIMESTAMP,
    applies_to JSON, -- Entities/situations this applies to
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rule_json JSON NOT NULL, -- Structured rule definition
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning and metrics
CREATE TABLE learnings (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'fact', 'decision', 'policy', 'procedure', 'learning'
    content JSON NOT NULL,
    evidence JSON, -- Supporting evidence
    confidence REAL DEFAULT 0.5,
    source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE metrics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value REAL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    tags TEXT[] -- Array of tags for categorization
);
```

### Key Services to Implement
1. **IngestionService** - Handles data import from various sources
2. **StorageService** - Abstracts data persistence (SQLite, vector store, filesystem)
3. **ResolverService** - Selects relevant context for queries
4. **ContextBuilderService** - Formats context for agent consumption
5. **LearningService** - Updates knowledge based on outcomes
6. **ConflictResolutionService** - Handles conflicting information
7. **ProvenanceService** - Tracks data lineage and reliability

### Initial Focus for ABizCreator
For the printing business use case, prioritize:
- Product/service catalog with printing-specific attributes (material, finish, size, quantity)
- Project tracking with visual assets
- Pricing rules and calculation engines
- Local business information (NAP consistency for Jaipur)
- SEO-relevant content and metadata