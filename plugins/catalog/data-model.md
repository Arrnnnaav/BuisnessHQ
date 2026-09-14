# Catalog Plugin Data Model

## Core Entities

### Product/Service
Represents a product or service offered by the business.

#### Fields
- `id` (string, UUID): Unique identifier
- `name` (string): Product/service name
- `description` (text): Detailed description
- `shortDescription` (string): Brief summary for listings
- `categoryId` (string, UUID): Reference to category
- `type` (enum): 'product' | 'service'
- `active` (boolean): Whether item is currently offered
- `attributes` (JSON): Flexible attribute storage for type-specific data
- `pricingInfo` (JSON): Pricing details and rules reference
- `mediaIds` (string[]): Array of media item IDs
- `seoData` (JSON): SEO metadata (keywords, meta description, etc.)
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp
- `createdBy` (string, UUID): User who created the item
- `updatedBy` (string, UUID): User who last updated the item
- `verified` (boolean): Whether information has been verified by owner
- `source` (string): Origin of data ('manual', 'website-import', 'catalog-upload', 'api-sync')

#### Printing-Specific Attributes (for ABizCreator)
Stored in the `attributes` field:
```json
{
  "printing": {
    "material": {
      "type": "string",
      "examples": ["130gsm gloss", "250gsm matte", "300gsm recycled"]
    },
    "size": {
      "type": "string",
      "format": "width x height in mm",
      "examples": ["210 x 297", "90 x 55", "500 x 700"]
    },
    "finish": {
      "type": "string",
      "examples": ["none", "matte lamination", "gloss lamination", "UV coating", "binding"]
    },
    "colors": {
      "type": "string",
      "format": "front/back (e.g., 4/4, 4/1, 1/0)",
      "examples": ["4/4", "4/1", "1/0"]
    },
    "quantity": {
      "min": {"type": "integer", "minimum": 1},
      "max": {"type": "integer", "minimum": 1},
      "unit": "pieces"
    },
    "turnaroundTime": {
      "value": {"type": "integer", "minimum": 0},
      "unit": "enum: hours | days",
      "examples": [{ "value": 4, "unit": "hours" }, { "value": 3, "unit": "days" }]
    },
    "designRequired": {"type": "boolean"},
    "fileRequirements": {
      "formats": {"type": "string[]", "examples": ["PDF", "AI", "IND", "PSD"]},
      "resolution": {"type": "string", "pattern": "^\\d+\\s*DPI$", "examples": ["300 DPI"]},
      "bleed": {"type": "string", "pattern": "^\\d+\\s*mm$", "examples": ["3mm", "5mm"]},
      "safeZone": {"type": "string", "pattern": "^\\d+\\s*mm$", "examples": ["5mm"]}
    }
  },
  "design": {
    "serviceType": {
      "type": "enum",
      "examples": ["logo-design", "brand-identity", "layout-design", "illustration"]
    },
    "revisionsIncluded": {"type": "integer", "minimum": 0},
    "sourceFilesProvided": {"type": "boolean"},
    "deliveryFormat": {
      "type": "string[]",
      "examples": ["PDF", "AI", "JPG", "PNG"]
    }
  }
}
```

### Category
Organizes products/services into logical groups.

#### Fields
- `id` (string, UUID): Unique identifier
- `name` (string): Category name
- `description` (text): Category description
- `parentId` (string, UUID): Reference to parent category (for hierarchy)
- `sortOrder` (integer): Display order
- `icon` (string): Icon identifier or URL
- `active` (boolean): Whether category is active
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `seoSlug` (string): URL-friendly version for web pages

#### ABizCreator Example Categories
- `printing-services`
  - `digital-printing`
  - `offset-printing`
  - `large-format-printing`
- `design-services`
  - `logo-design`
  - `branding`
  - `marketing-materials`
- `materials`
  - `paper-stocks`
  - `vinyl-materials`
  - `fabric-options`
- `finishing`
  - `lamination`
  - `binding`
  - `cutting-and-folding`

### Media
Represents files associated with products/services (images, PDFs, videos).

#### Fields
- `id` (string, UUID): Unique identifier
- `productId` (string, UUID): Reference to parent product/service
- `type` (enum): 'image' | 'pdf' | 'video' | 'document'
- `url` (string): File path or URL
- `altText` (string): Alternative text for accessibility
- `caption` (string): Descriptive caption
- `primary` (boolean): Whether this is the primary/media image
- `sortOrder` (integer): Display order in galleries
- `fileSize` (integer): Size in bytes
- `fileType` (string): MIME type
- `dimensions` (JSON): For images/videos (width, height)
- `duration` (integer): For videos/audio (seconds)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `optimizedVersions` (JSON): Different sizes/formats for web use

### Pricing Rule (Optional Advanced Feature)
Defines how pricing is calculated for products/services.

#### Fields
- `id` (string, UUID): Unique identifier
- `name` (string): Rule name/description
- `formula` (string): Mathematical formula or reference to calculator
- `variables` (JSON): Input variables and their types
- `constraints` (JSON): Min/max values, dependencies
- `output` (JSON): Result format and currency
- `effectiveFrom` (timestamp): When rule becomes active
- `effectiveTo` (timestamp): When rule expires
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `appliesTo` (string[]): Product/service IDs or categories this rule applies to

#### Example Pricing Formula for Printing
```
BASE_COST + (MATERIAL_COST * QUANTITY) + (DESIGN_FEE * DESIGN_REQUIRED) + RUSH_PREMIUM
```
Where:
- BASE_COST: Fixed setup cost
- MATERIAL_COST: Cost per unit of material
- QUANTITY: Number of items
- DESIGN_FEE: Additional charge for design work
- DESIGN_REQUIRED: Boolean (0 or 1)
- RUSH_PREMIUM: Multiplier for rush orders (e.g., 1.5 for 50% increase)

## Relationships

### Product/Service ↔ Category
- Many-to-one (each product/service belongs to one category)
- One-to-many (each category can have many products/services)

### Product/Service ↔ Media
- One-to-many (each product/service can have multiple media items)
- Many-to-one (each media item belongs to one product/service)

### Product/Service ↔ Pricing Rule
- Many-to-one (multiple products/services can use the same pricing rule)
- One-to-many (each pricing rule can apply to multiple products/services)

### Product/Service ↔ Project
- Many-to-many (products/services can be used in multiple projects, projects can use multiple products/services)
- Facilitated through a junction table or relationship entity

## Database Schema (SQLite Example)

```sql
CREATE TABLE catalog_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    category_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('product', 'service')) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    attributes JSON, -- Flexible storage for type-specific attributes
    pricing_info JSON, -- Pricing details
    seo_data JSON, -- SEO metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    verified BOOLEAN DEFAULT FALSE,
    source TEXT DEFAULT 'manual',
    FOREIGN KEY (category_id) REFERENCES catalog_categories(id)
);

CREATE TABLE catalog_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    icon TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seo_slug TEXT,
    FOREIGN KEY (parent_id) REFERENCES catalog_categories(id)
);

CREATE TABLE catalog_media (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('image', 'pdf', 'video', 'document')) NOT NULL,
    url TEXT NOT NULL,
    alt_text TEXT,
    caption TEXT,
    primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    file_size INTEGER,
    file_type TEXT,
    dimensions JSON, -- {width: number, height: number}
    duration INTEGER, -- for video/audio in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    optimized_versions JSON, -- {thumbnail: url, medium: url, etc.}
    FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE
);

CREATE TABLE catalog_pricing_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    formula TEXT,
    variables JSON,
    constraints JSON,
    output JSON,
    effective_from TIMESTAMP,
    effective_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applies_to JSON -- Array of product/category IDs
);

-- Junction table for many-to-many relationship between products and projects
CREATE TABLE catalog_product_projects (
    product_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    role TEXT DEFAULT 'used_in', -- 'used_in', 'recommended_for', etc.
    quantity INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, project_id),
    FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES project_entities(id) ON DELETE CASCADE
);
```

## API Response Formats

### Product/Service List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_123",
      "name": "Brochure Printing",
      "description": "Full-color brochure printing on premium paper",
      "shortDescription": "Premium brochures for marketing",
      "categoryId": "cat_printing",
      "type": "service",
      "active": true,
      "attributes": {
        "printing": {
          "material": "170gsm gloss paper",
          "size": "A4 (210x297mm)",
          "finish": "matte lamination",
          "colors": "4/4",
          "quantity": { "min": 50, "max": 5000 },
          "turnaroundTime": { "value": 3, "unit": "days" },
          "designRequired": false,
          "fileRequirements": {
            "formats": ["PDF", "AI", "IND"],
            "resolution": "300 DPI",
            "bleed": "3mm"
          }
        }
      },
      "pricingInfo": {
        "basePrice": 2000,
        "pricePerUnit": 10,
        "quantityBreaks": [
          { "min": 100, "pricePerUnit": 8 },
          { "min": 500, "pricePerUnit": 6 },
          { "min": 1000, "pricePerUnit": 5 }
        ],
        "currency": "INR",
        "rushMultiplier": 1.5,
        "designAddOn": 500
      },
      "mediaIds": ["media_456", "media_789"],
      "seoData": {
        "keywords": ["brochure printing jaipur", "color brochure printing"],
        "metaDescription": "High-quality brochure printing services in Jaipur"
      },
      "createdAt": "2026-08-01T10:00:00Z",
      "updatedAt": "2026-08-15T14:30:00Z",
      "createdBy": "user_001",
      "updatedBy": "user_001",
      "verified": true,
      "source": "manual-entry"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Single Product/Service Response
```json
{
  "success": true,
  "data": {
    // Same structure as items in the list response above
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Description of what went wrong",
    "details": {
      // Optional field-specific validation errors
      "fieldName": "Specific error for this field"
    }
  }
}
```

## Events

### Emitted by Catalog Plugin
- `catalog.product.created` - New product/service added
- `catalog.product.updated` - Product/service information changed
- `catalog.product.deleted` - Product/service removed
- `catalog.product.activated` - Product/service made active
- `catalog.product.deactivated` - Product/service made inactive
- `catalog.category.created` - New category added
- `catalog.category.updated` - Category information changed
- `catalog.category.deleted` - Category removed
- `catalog.media.uploaded` - New media file added
- `catalog.media.deleted` - Media file removed
- `catalog.import.completed` - Catalog import finished
- `catalog.export.completed` - Catalog export finished
- `catalog.stats.updated` - Catalog statistics refreshed

### Listened to by Catalog Plugin
- `pricing.rules.updated` - When pricing rules change (to refresh product prices)
- `project.completed` - When a project is finished (to suggest adding to portfolio/catalog)
- `customer.won` - When new customer acquired (for catalog-based follow-up suggestions)
- `website.content.updated` - When website content changes (for synchronization)
- `google.business.profile.updated` - When GBP info changes (for product listing sync)

## Security Considerations

### Permissions
- `read:catalog` - Required to view catalog information
- `write:catalog` - Required to create/update/delete catalog items
- `execute:catalog_search` - Required to search catalog
- `write:media` - Required to upload/delete media files
- `execute:catalog_import` - Required to import catalog from files
- `execute:catalog_export` - Required to export catalog to files

### Data Validation
- All inputs validated on both client and server
- File uploads restricted to safe types (images, PDFs, documents)
- File size limits enforced
- Path traversal prevented in file operations
- SQL injection prevented through parameterized queries
- XSS prevention in rendered content
- CSRF protection on state-changing operations

## Performance Considerations

### Indexing Strategy
- Primary keys on all ID fields
- Foreign key indexes for relationships
- Composite indexes for common query patterns:
  - `(category_id, active, type)`
  - `(active, verified)`
  - `(created_at)` for time-based queries
  - Full-text search indexes on name/description fields

### Caching
- Frequently accessed product lists cached
- Category hierarchies cached
- Media metadata cached
- Expensive calculations (like complex pricing) cached per product

### Pagination
- List endpoints support pagination with configurable limits
- Default limit: 20 items per page
- Maximum limit: 100 items per page
- Cursor-based pagination available for large datasets

## Extensibility

### Custom Attributes
Businesses can extend the attributes schema for their specific needs:
- Add new top-level keys in the attributes object
- Define validation rules for custom attributes
- Create UI components for editing custom attributes
- Extend API to handle custom attribute queries

### Plugin Integration
- Hooks for integration with pricing engine
- Events for synchronization with other systems
- Extension points for custom import/export formats
- Webhook support for external system notifications
- API versioning for backward compatibility

## ABizCreator Implementation Notes

### Phase 1 (MVP)
- Basic product/service management with printing attributes
- Simple pricing display (manual entry)
- Basic media management for product images
- CSV import/export functionality
- Manual category management

### Phase 2
- Website import for existing service pages
- Basic pricing rule integration
- SEO metadata management
- Google Business Profile product synchronization
- Enhanced media handling (thumbnails, optimization)

### Phase 3
- Advanced pricing engine integration
- Inventory tracking (if needed for physical stock)
- Supplier/vendor management
- Product variants and options system
- Automated catalog refresh from external sources
- Analytics integration (views, clicks, conversions)