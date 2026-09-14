# Catalog Plugin

The Catalog Plugin manages the company's products, services, and inventory. For ABizCreator (printing business), this includes:

- Printing services (business cards, brochures, banners, etc.)
- Design services
- Materials and substrates
- Finishing options
- Pricing information
- Availability and turnaround times

## Key Features

### Product/Service Management
- Create, read, update, delete products and services
- Categorize items (printing, design, materials, etc.)
- Add detailed descriptions and specifications
- Manage media (images, PDFs, brochures)
- Set availability status (active/inactive, seasonal)

### Pricing Integration
- Connect to pricing rules and calculations
- Support for variable pricing (quantity-based, material-based)
- Integration with quotation system
- Price history tracking

### Inventory Tracking (Optional)
- Stock levels for physical inventory
- Reorder alerts
- Supplier information
- Lead times

### Import/Export
- Import from existing catalogs (PDF, Excel, CSV)
- Export to various formats
- Website synchronization
- Google Business Profile product listings

### Events Emitted
- `product.created` - When a new product/service is added
- `product.updated` - When product/service information changes
- `product.deleted` - When a product/service is removed
- `product.activated` / `product.deactivated` - When status changes
- `catalog.refreshed` - When catalog data is updated from external sources

### Events Listened To
- `pricing.changed` - When pricing rules are updated (to refresh product prices)
- `project.completed` - When a project is finished (to potentially add to portfolio)
- `customer.won` - When a new customer is acquired (for follow-up catalog suggestions)

## ABizCreator Specific Configuration

For ABizCreator's printing business in Jaipur, the catalog includes:

### Service Categories
- Digital Printing
- Offset Printing
- Large Format Printing
- Graphic Design
- Branding Services
- Corporate Stationery
- Marketing Materials

### Product Attributes
For printing services:
- Material/Paper Type (GSM, texture, color)
- Size/Dimensions
- Finish (lamination, UV coating, binding)
- Quantity ranges
- Turnaround times
- Design complexity levels
- File requirements (format, resolution, bleed)

### Pricing Models
- Base rate + material costs
- Quantity discounts
- Rush job premiums
- Design complexity factors
- Delivery charges
- Minimum order quantities

## Data Model

### Product/Service Entity
```javascript
{
  id: "unique-identifier",
  name: "Product/Service Name",
  description: "Detailed description",
  category: "brochure-printing", // etc.
  subcategory: "tri-fold", // etc.
  type: "service" | "product",
  active: boolean,
  attributes: {
    // Printing-specific attributes
    material: "130gsm gloss paper",
    size: "A4 (210x297mm)",
    finish: "matte lamination",
    colors: "4/4 (full color both sides)",
    quantityMin: 50,
    quantityMax: 10000,
    turnaroundDays: 3,
    designIncluded: false,
    fileRequirements: {
      format: ["PDF", "AI", "IND"],
      resolution: "300 DPI",
      bleed: "3mm"
    }
  },
  pricing: {
    // References to pricing rules or base prices
    basePrice: 2500, // in currency smallest unit (paise)
    pricePerUnit: 15,
    quantityBreaks: [
      { min: 100, pricePerUnit: 12 },
      { min: 500, pricePerUnit: 10 },
      { min: 1000, pricePerUnit: 8 }
    ],
    rushMultiplier: 1.5,
    designAddOn: 500
  },
  media: [
    {
      id: "media-id",
      type: "image" | "pdf" | "video",
      url: "/path/to/file",
      altText: "Description",
      primary: boolean
    }
  ],
  metadata: {
    createdAt: "timestamp",
    updatedAt: "timestamp",
    createdBy: "user-id",
    verified: boolean,
    source: "manual-entry" | "website-import" | "catalog-upload",
    seoKeywords: ["brochure printing jaipur", "color brochure printing"]
  },
  relationships: [
    {
      type: "pricing_rule",
      target: "pricing-rule-id"
    },
    {
      type: "category",
      target: "printing-services"
    }
  ]
}
```

## API Endpoints

### Product Management
- `GET /api/catalog/products` - List products/services
- `POST /api/catalog/products` - Create new product/service
- `GET /api/catalog/products/:id` - Get specific product/service
- `PUT /api/catalog/products/:id` - Update product/service
- `DELETE /api/catalog/products/:id` - Delete product/service
- `GET /api/catalog/products/search?q=:query` - Search products/services

### Catalog Operations
- `POST /api/catalog/import` - Import catalog from file
- `GET /api/catalog/export` - Export catalog to file
- `POST /api/catalog/refresh` - Refresh catalog from external sources
- `GET /api/catalog/stats` - Get catalog statistics

## UI Components

### Dashboard Pages
- Catalog Overview (list/grid view)
- Product/Service Detail Form
- Category Management
- Import/Export Wizard

### Widgets
- Catalog Overview (total items, active/inactive counts)
- Recently Added Products
- Low Stock Alerts (if inventory tracking enabled)
- Popular Products/Services

### Forms
- Product/Service Creation/Edit Form
- Bulk Import Configuration
- Category Management Form

## Implementation Notes

### For ABizCreator V1
1. Focus on service-based catalog (printing and design services)
2. Include printing-specific attributes and pricing models
3. Enable website import for existing service pages
4. Connect to quotation system for automatic price retrieval
5. Implement basic media management for project photos and samples
6. Prepare for future inventory tracking (if needed for physical stock)

### Extension Points
- Custom attributes for different business types
- Pricing engine integration hooks
- Multi-currency support
- Tax calculation integration
- Supplier/vendor management
- Product variants and options system