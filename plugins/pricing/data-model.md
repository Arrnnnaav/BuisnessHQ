# Pricing Plugin Data Model

## Core Entities

### Cost Components
Represents individual cost elements that make up the total cost of a product or service.

#### Fields
- `id` (string, UUID): Unique identifier
- `name` (string): Human-readable name (e.g., "Paper Cost", "Setup Labor")
- `type` (enum): Category of cost
  - `material`: Raw materials (paper, ink, substrates, etc.)
  - `labor`: Direct labor costs (press operation, finishing, etc.)
  - `overhead`: Indirect costs (rent, utilities, administration, etc.)
  - `finishing`: Post-printing processes (lamination, binding, etc.)
  - `design`: Creative and design work
  - `delivery`: Shipping and delivery costs
  - `tax`: Government taxes and duties
  - `other`: Miscellaneous costs
- `description` (text): Detailed explanation of what this cost covers
- `calculationMethod` (enum): How the cost is calculated
  - `formula`: Mathematical formula based on input variables
  - `lookup`: Table-based lookup (e.g., material pricing by GSQ/size)
  - `external_api`: Call to external service for current pricing
  - `fixed_amount`: Constant value regardless of inputs
  - `percentage`: Percentage of another cost or total
- `formula` (string): Mathematical expression if `calculationMethod` is `formula`
  - Examples: `"quantity * materialRate * (1 + wasteFactor)"`, `"baseSetup + (timePerUnit * quantity)"`
- `inputs` (JSON): Schema defining required input variables
  - Each input has: `name`, `type` (string|number|boolean|enum), `required` (boolean), `description`
  - Examples for printing: `quantity`, `materialType`, `area`, `sides`, `complexity`, `turnaroundTime`
- `defaults` (JSON): Default values for optional inputs
- `outputUnit` (string): Unit of result (`currency`, `time`, `area`, `weight`, etc.)
- `currency` (string): ISO currency code (e.g., "INR", "USD")
- `effectiveFrom` (timestamp): When this cost component becomes active
- `effectiveTo` (timestamp): When this cost component expires (null for permanent)
- `lastUpdated` (timestamp): When this component was last modified
- `source` (string): Origin of this cost data
  - Examples: `"supplier-list"`, "market-rate", "internal-calculation", "industry-standard"
- `confidence` (number 0-1): Confidence in the accuracy of this cost component
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp
- `createdBy` (string, UUID): User who created the component
- `updatedBy` (string, UUID): User who last updated the component

#### Printing-Specific Cost Component Examples

**Material Cost - Paper**
```json
{
  "name": "Paper Stock Cost",
  "type": "material",
  "description": "Cost of paper/substrate based on GSM, type, size, and quantity",
  "calculationMethod": "lookup",
  "lookupTable": "paper_pricing",
  "inputs": {
    "materialType": {
      "type": "string",
      "required": true,
      "description": "Type of paper (130gsm gloss, 250gsm matte, etc.)",
      "enum": [
        "130gsm gloss", "130gsm matte", "170gsm gloss", "170gsm matte",
        "250gsm gloss", "250gsm matte", "300gsm gloss", "300gsm matte",
        "350gsm gloss", "350gsm matte", "400gsm gloss", "400gsm matte"
      ]
    },
    "size": {
      "type": "string",
      "required": true,
      "description": "Paper size in mm format (WxH)",
      "pattern": "^\\d+x\\d+$"
    },
    "quantity": {
      "type": "number",
      "required": true,
      "minimum": 1,
      "description": "Number of sheets needed"
    },
    "sides": {
      "type": "number",
      "required": true,
      "description": "Number of sides to print (1 or 2)",
      "enum": [1, 2]
    }
  },
  "defaults": {
    "wasteFactor": 0.05,
    "specification": "A4"
  },
  "outputUnit": "currency",
  "currency": "INR",
  "confidence": 0.9
}
```

**Labor Cost - Press Operation**
```json
{
  "name": "Press Operation Labor",
  "type": "labor",
  "description": "Labor cost for operating the printing press",
  "calculationMethod": "formula",
  "formula": "(setupTime + (runTimePerUnit * quantity)) * laborRate",
  "inputs": {
    "setupTime": {
      "type": "number",
      "required": true,
      "description": "Setup time in minutes",
      "minimum": 0
    },
    "runTimePerUnit": {
      "type": "number",
      "required": true,
      "description": "Time to print one unit in minutes",
      "minimum": 0
    },
    "quantity": {
      "type": "number",
      "required": true,
      "description": "Number of units to print",
      "minimum": 1
    },
    "laborRate": {
      "type": "number",
      "required": true,
      "description": "Labor rate per minute",
      "minimum": 0
    },
    "complexityFactor": {
      "type": "number",
      "required": false,
      "description": "Multiplier for job complexity (1.0 = standard)",
      "minimum": 0.5,
      "default": 1.0
    }
  },
  "defaults": {
    "laborRate": 1.5,
    "complexityFactor": 1.0
  },
  "outputUnit": "currency",
  "currency": "INR",
  "confidence": 0.85
}
```

**Finishing Cost - Lamination**
```json
{
  "name": "Lamination Cost",
  "type": "finishing",
  "description": "Cost of applying lamination film",
  "calculationMethod": "formula",
  "formula": "(area * 2 * laminationRatePerSqCm) + setupFee",
  "inputs": {
    "width": {
      "type": "number",
      "required": true,
      "description": "Width in mm",
      "minimum": 1
    },
    "height": {
      "type": "number",
      "required": true,
      "description": "Height in mm",
      "minimum": 1
    },
    "quantity": {
      "type": "number",
      "required": true,
      "description": "Number of units",
      "minimum": 1
    },
    "laminationType": {
      "type": "string",
      "required": true,
      "description": "Type of lamination",
      "enum": ["matte", "gloss", "soft-touch"]
    },
    "laminationRatePerSqCm": {
      "type": "number",
      "required": true,
      "description": "Cost per square centimeter",
      "minimum": 0
    },
    "setupFee": {
      "type": "number",
      "required": false,
      "description": "Setup fee for lamination job",
      "minimum": 0,
      "default": 20
    }
  },
  "defaults": {
    "laminationType": "matte",
    "laminationRatePerSqCm": 0.15,
    "setupFee": 20
  },
  "outputUnit": "currency",
  "currency": "INR",
  "confidence": 0.9
}
```

### Pricing Rules
Defines how prices are calculated from costs, incorporating business policies and strategies.

#### Fields
- `id` (string, UUID): Unique identifier
- `name` (string): Human-readable name/description
- `description` (text): Detailed explanation of when and how this rule applies
- `appliesTo` (JSON): Conditions specifying which products/services this rule covers
  - Can include: `productTypes`, `categories`, `attributes`, `tags`, `customers`
- `pricingStrategy` (enum): Overall approach to pricing
  - `cost_plus`: Base price = cost / (1 - targetMargin)
  - `market_based`: Price based on competitor analysis
  - `value_based`: Price based on perceived customer value
  - `competitive`: Price to match or beat competitors
  - `penetration`: Low price to gain market share
  - `premium`: High price to signal quality/exclusivity
- `basePrice` (number): Fixed cost component (currency units)
- `pricePerUnit` (number): Variable cost component per unit (currency units)
- `quantityBreaks` (array): Tiered pricing based on quantity
  - Each entry: `{ minQuantity: number, multiplier: number }`
  - Example: `[{min: 50, mult: 1.0}, {min: 100, mult: 0.9}, {min: 500, mult: 0.8}]`
- `marginSettings` (JSON): Margin-related configuration
  - `minimumMargin` (number 0-1): Minimum allowed margin (e.g., 0.20 for 20%)
  - `targetMargin` (number 0-1): Desired margin (e.g., 0.35 for 35%)
  - `maximumMargin` (number 0-1): Maximum allowed margin (e.g., 0.60 for 60%)
  - `marginType` (enum): How margin is calculated
    - `on_cost`: Margin = (price - cost) / cost
    - `on_price`: Margin = (price - cost) / price (most common)
- `adjustments` (JSON): Price modifiers
  - `rushJobMultiplier` (number >= 1.0): Multiplier for expedited work
  - `designComplexityFactors` (JSON): Additional charges by design level
  - `colorComplexity` (JSON): Charges based on color configuration
  - `sizeAdjustments` (JSON): Modifiers for non-standard sizes
  - `materialUpgrades` (JSON): Premium charges for better materials
  - `finishingAddons` (JSON): Itemized pricing for finishing processes
  - `deliveryCharges` (JSON): Delivery cost calculations
  - `taxApplication` (boolean): Whether to apply taxes
- `currency` (string): ISO currency code
- `effectiveFrom` (timestamp): When this rule becomes active
- `effectiveTo` (timestamp): When this rule expires (null for permanent)
- `lastUpdated` (timestamp): When this rule was last modified
- `createdBy` (string, UUID): User who created the rule
- `updatedBy` (string, UUID): User who last updated the rule
- `version` (integer): Incremental version number for tracking changes
- `notes` (text): Free-form notes about the rule
- `tags` (string[]): Categorization tags for organization
- `isActive` (boolean): Whether this rule is currently active
- `confidence` (number 0-1): Confidence in the appropriateness of this rule
- `reviewDate` (timestamp): When this rule should be reviewed for relevance

#### ABizCreator Pricing Rule Examples

**Standard Brochure Printing Rule**
```json
{
  "name": "Standard Brochure Printing",
  "description": "Base pricing for brochure printing jobs with standard turnaround",
  "appliesTo": {
    "productTypes": ["brochure-printing"],
    "categories": ["printing-services", "marketing-materials"],
    "attributes": {
      "printing.finish": ["none", "matte-lamination", "gloss-lamination"]
    }
  },
  "pricingStrategy": "cost_plus",
  "basePrice": 1500,
  "pricePerUnit": 8,
  "quantityBreaks": [
    { "minQuantity": 50, "multiplier": 1.0 },
    { "minQuantity": 100, "multiplier": 0.9 },
    { "minQuantity": 250, "multiplier": 0.85 },
    { "minQuantity": 500, "multiplier": 0.8 },
    { "minQuantity": 1000, "multiplier": 0.75 }
  ],
  "marginSettings": {
    "minimumMargin": 0.25,
    "targetMargin": 0.35,
    "maximumMargin": 0.50,
    "marginType": "on_price"
  },
  "adjustments": {
    "rushJobMultiplier": {
      "sameDay": 2.0,
      "nextDay": 1.5,
      "twoDay": 1.25
    },
    "designComplexityFactors": {
      "none": 0,
      "basic": 200,
      "standard": 400,
      "complex": 600,
      "custom": 800
    },
    "colorComplexity": {
      "1/0": 0,
      "1/1": 150,
      "2/0": 250,
      "2/1": 350,
      "2/2": 400,
      "4/0": 500,
      "4/1": 600,
      "4/2": 650,
      "4/4": 700
    },
    "sizeAdjustments": {
      "A5": 0.9,
      "A4": 1.0,
      "A3": 1.2,
      "A2": 1.5,
      "A1": 2.0
    },
    "materialUpgrades": {
      "130gsm": 0,
      "170gsm": 0.5,
      "250gsm": 1.0,
      "300gsm": 1.5,
      "350gsm": 2.0,
      "premium": 2.5
    },
    "finishingAddons": {
      "none": 0,
      "matte-lamination": 120,
      "gloss-lamination": 120,
      "uv-coating": 180,
      "binding": 250,
      "numbering": 80,
      "perforation": 60
    }
  },
  "currency": "INR",
  "isActive": true,
  "confidence": 0.9,
  "reviewDate": "2027-08-01T00:00:00Z"
}
```

**Premium Business Card Rule**
```json
{
  "name": "Premium Business Cards",
  "description": "Pricing for premium business cards with special finishes",
  "appliesTo": {
    "productTypes": ["business-card-printing"],
    "attributes": {
      "printing.material": ["250gsm", "300gsm", "350gsm"],
      "printing.finish": ["spot-uv", "embossing", "foil-stamping"]
    }
  },
  "pricingStrategy": "premium",
  "basePrice": 800,
  "pricePerUnit": 15,
  "quantityBreaks": [
    { "minQuantity": 100, "multiplier": 1.0 },
    { "minQuantity": 250, "multiplier": 0.9 },
    { "minQuantity": 500, "multiplier": 0.8 }
  ],
  "marginSettings": {
    "minimumMargin": 0.40,
    "targetMargin": 0.50,
    "maximumMargin": 0.60,
    "marginType": "on_price"
  },
  "adjustments": {
    "rushJobMultiplier": 1.5,
    "designComplexityFactors": {
      "standard": 100,
      "custom": 250
    },
    "colorComplexity": {
      "4/4": 0,
      "4/4+spot-uv": 150,
      "4/4+foil-stamping": 300,
      "4/4+embossing": 250
    },
    "materialUpgrades": {
      "250gsm": 0,
      "300gsm": 0.3,
      "350gsm": 0.6,
      "premium-coated": 0.8
    }
  },
  "currency": "INR",
  "isActive": true,
  "confidence": 0.85,
  "reviewDate": "2027-02-01T00:00:00Z"
}
```

### Price Calculations
Stores the results of price calculations for auditing, reporting, and learning.

#### Fields
- `id` (string, UUID): Unique identifier
- `timestamp` (timestamp): When this calculation was performed
- `productOrServiceId` (string, UUID): Reference to what was priced
- `specification` (JSON): The exact specs that were priced
- `costBreakdown` (JSON): Detailed cost by component
  - Each component: `{ name: string, amount: number, type: string }`
- `pricingRuleId` (string, UUID): Reference to the pricing rule applied
- `basePrice` (number): Calculated base price before adjustments
- `adjustments` (JSON): Details of adjustments applied
  - Mirrors the adjustments structure from pricing rules
- `recommendedPrice` (number): Final recommended price
- `marginPercentage` (number 0-1): Actual margin achieved
- `currency` (string): ISO currency code
- `validUntil` (timestamp): When this calculation expires (based on cost volatility)
- `confidence` (number 0-1): Confidence in this calculation's accuracy
- `factorsConsidered` (string[]): What inputs/variables were considered
- `assumptions` (string[]): Assumptions made during calculation
- `validatedBy` (string, UUID): User who validated this calculation (if applicable)
- `validatedAt` (timestamp): When validation occurred
- `isOverride` (boolean): Whether this was manually overridden
- `overrideReason` (text): Reason for manual override (if applicable)
- `createdBy` (string, UUID): System or user who performed calculation
- `updatedBy` (string, UUID): User who last updated this record

#### Example Price Calculation
```json
{
  "name": "Price Calculation for Brochure Job",
  "timestamp": "2026-08-15T10:30:00Z",
  "productOrServiceId": "prod_brochure_std",
  "specification": {
    "quantity": 250,
    "materialType": "170gsm gloss",
    "size": "210x297",
    "finish": "matte-lamination",
    "colors": "4/4",
    "designRequired": true,
    "designComplexity": "standard",
    "rushJob": false,
    "deliveryRequired": true
  },
  "costBreakdown": [
    { "name": "Paper Stock", "amount": 1200, "type": "material" },
    { "name": "Printing", "amount": 800, "type": "printing" },
    { "name": "Lamination", "amount": 300, "type": "finishing" },
    { "name": "Design", "amount": 400, "type": "design" },
    { "name": "Labor", "amount": 600, "type": "labor" },
    { "name": "Wastage", "amount": 150, "type": "material" },
    { "name": "Delivery", "amount": 200, "type": "delivery" },
    { "name": "Overhead", "amount": 350, "type": "overhead" }
  ],
  "pricingRuleId": "rule_brochure_standard",
  "basePrice": 4200,
  "adjustments": {
    "designComplexity": 400,
    "delivery": 200
  },
  "recommendedPrice": 6000,
  "marginPercentage": 0.30,
  "currency": "INR",
  "validUntil": "2026-09-15T10:30:00Z",
  "confidence": 0.92,
  "factorsConsidered": [
    "current-material-pricing",
    "standard-labor-rates",
    "typical-machine-efficiency"
  ],
  "assumptions": [
    "Standard equipment utilization",
    "Normal quality control standards",
    "No special file preparation needed",
    "Delivery within Jaipur city limits"
  ],
  "isOverride": false,
  "createdBy": "system",
  "updatedBy": "system"
}
```

### Price Experiments
Tracks A/B tests and other pricing experiments for data-driven optimization.

#### Fields
- `id` (string, UUID): Unique identifier
- `name` (string): Descriptive name of the experiment
- `description` (text): Detailed explanation of what's being tested
- `hypothesis` (text): What the experiment aims to prove/disprove
- `productOrServiceId` (string, UUID): What is being tested (can be null for broad tests)
- `pricingRuleId` (string, UUID): Base rule being varied (can be null)
- `variants` (array): Different pricing approaches being tested
  - Each variant: `{ id: string, name: string, description: string, configuration: JSON, trafficPercentage: number }`
  - Configuration follows the same structure as pricing rules adjustments
- `startDate` (timestamp): When the experiment began
- `endDate` (timestamp): When the experiment ended/concluded
- `status` (enum): `draft`, `running`, `paused`, `completed`, `cancelled`
- `successMetric` (enum): What metric determines winning variant
  - `conversion_rate`, `revenue_per_visitor`, `profit_per_visitor`, `units_sold`
- `minimumSampleSize` (number): Minimum observations needed for statistical significance
- `currentSampleSize` (JSON): Observations collected per variant
- `results` (JSON): Statistical results (if experiment completed)
  - Includes: `winner`, `confidenceLevel`, `improvement`, `pValue`
- `createdBy` (string, UUID): User who created the experiment
- `updatedBy` (string, UUID): User who last updated the experiment
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp

### Margin Analytics
Pre-aggregated data for fast margin reporting and analysis.

#### Fields
- `id` (string, UUID): Unique identifier
- `timestamp` (timestamp): When this snapshot was taken
- `periodType` (enum): `hourly`, `daily`, `weekly`, `monthly`, `quarterly`, `yearly`
- `periodStart` (timestamp): Start of the period
- `periodEnd` (timestamp): End of the period
- `entityType` (enum): What the margins are calculated for
  - `product`, `service`, `category`, `customer`, `project`, `quote`
- `entityId` (string, UUID): Reference to the specific entity
- `metrics` (JSON): Aggregated margin metrics
  - `totalRevenue`: number
  - `totalCost`: number
  - `totalProfit`: number
  - `marginOnCost`: number (profit/cost)
  - `marginOnPrice`: number (profit/revenue)
  - `avgTransactionValue`: number
  - `transactionCount`: number
  - `unitsSold`: number
  - `avgQuantityPerTransaction`: number
- `currency` (string): ISO currency code
- `confidence` (number 0-1): Confidence in the accuracy of this snapshot
- `sampleSize` (number): Number of transactions included
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp

## Database Schema (SQLite Example)

```sql
-- Cost Components Table
CREATE TABLE pricing_cost_components (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('material', 'labor', 'overhead', 'finishing', 'design', 'delivery', 'tax', 'other')),
    calculationMethod TEXT NOT NULL CHECK(calculationMethod IN ('formula', 'lookup', 'external_api', 'fixed_amount', 'percentage')),
    formula TEXT,
    inputs JSON, -- Schema for required inputs
    defaults JSON, -- Default values for optional inputs
    outputUnit TEXT NOT NULL,
    currency TEXT NOT NULL,
    effectiveFrom TIMESTAMP,
    effectiveTo TIMESTAMP,
    lastUpdated TIMESTAMP,
    source TEXT,
    confidence REAL DEFAULT 0.5 CHECK(confidence BETWEEN 0 AND 1),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdBy TEXT,
    updatedBy TEXT
);

-- Pricing Rules Table
CREATE TABLE pricing_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    appliesTo JSON, -- Conditions for when this rule applies
    pricingStrategy TEXT NOT NULL CHECK(pricingStrategy IN ('cost_plus', 'market_based', 'value_based', 'competitive', 'penetration', 'premium')),
    basePrice REAL DEFAULT 0,
    pricePerUnit REAL DEFAULT 0,
    quantityBreaks JSON, -- Array of {minQuantity: number, multiplier: number}
    marginSettings JSON, -- {minimumMargin: number, targetMargin: number, maximumMargin: number, marginType: string}
    adjustments JSON, -- Price modifiers (rush jobs, design complexity, etc.)
    currency TEXT NOT NULL,
    effectiveFrom TIMESTAMP,
    effectiveTo TIMESTAMP,
    lastUpdated TIMESTAMP,
    version INTEGER DEFAULT 1,
    notes TEXT,
    tags TEXT, -- Array stored as JSON or comma-separated
    isActive BOOLEAN DEFAULT TRUE,
    confidence REAL DEFAULT 0.5 CHECK(confidence BETWEEN 0 AND 1),
    reviewDate TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdBy TEXT,
    updatedBy TEXT
);

-- Price Calculations Table (Audit Trail)
CREATE TABLE pricing_calculations (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    productOrServiceId TEXT,
    specification JSON, -- The exact specs that were priced
    costBreakdown JSON, -- Detailed cost by component
    pricingRuleId TEXT,
    basePrice REAL,
    adjustments JSON,
    recommendedPrice REAL NOT NULL,
    marginPercentage REAL NOT NULL CHECK(marginPercentage BETWEEN 0 AND 1),
    currency TEXT NOT NULL,
    validUntil TIMESTAMP,
    confidence REAL DEFAULT 0.5 CHECK(confidence BETWEEN 0 AND 1),
    factorsConsidered TEXT, -- Array stored as JSON or comma-separated
    assumptions TEXT, -- Array stored as JSON or comma-separated
    validatedBy TEXT,
    validatedAt TIMESTAMP,
    isOverride BOOLEAN DEFAULT FALSE,
    overrideReason TEXT,
    createdBy TEXT DEFAULT 'system',
    updatedBy TEXT,
    FOREIGN KEY (productOrServiceId) REFERENCES catalog_products(id),
    FOREIGN KEY (pricingRuleId) REFERENCES pricing_rules(id)
);

-- Price Experiments Table
CREATE TABLE pricing_experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    hypothesis TEXT,
    productOrServiceId TEXT,
    pricingRuleId TEXT,
    variants JSON, -- Array of test variants
    startDate TIMESTAMP,
    endDate TIMESTAMP,
    status TEXT NOT NULL CHECK(status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
    successMetric TEXT NOT NULL CHECK(successMetric IN ('conversion_rate', 'revenue_per_visitor', 'profit_per_visitor', 'units_sold')),
    minimumSampleSize INTEGER,
    currentSampleSize JSON, -- Observations per variant
    results JSON, -- Statistical results if completed
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdBy TEXT,
    updatedBy TEXT,
    FOREIGN KEY (productOrServiceId) REFERENCES catalog_products(id),
    FOREIGN KEY (pricingRuleId) REFERENCES pricing_rules(id)
);

-- Margin Analytics Table (Pre-aggregated for Performance)
CREATE TABLE pricing_margin_analytics (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    periodType TEXT NOT NULL CHECK(periodType IN ('hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    periodStart TIMESTAMP NOT NULL,
    periodEnd TIMESTAMP NOT NULL,
    entityType TEXT NOT NULL CHECK(entityType IN ('product', 'service', 'category', 'customer', 'project', 'quote')),
    entityId TEXT,
    metrics JSON, -- Aggregated margin metrics
    currency TEXT NOT NULL,
    confidence REAL DEFAULT 0.5 CHECK(confidence BETWEEN 0 AND 1),
    sampleSize INTEGER,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_pricing_calculations_timestamp ON pricing_calculations(timestamp);
CREATE INDEX idx_pricing_calculations_product ON pricing_calculations(productOrServiceId);
CREATE INDEX idx_pricing_calculations_rule ON pricing_calculations(pricingRuleId);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(isActive);
CREATE INDEX idx_pricing_rules_appliesTo ON pricing_rules(appliesTo);
CREATE INDEX idx_pricing_experiments_status ON pricing_experiments(status);
CREATE INDEX idx_margin_analytics_period ON pricing_margin_analytics(periodType, periodStart, periodEnd);
CREATE INDEX idx_margin_analytics_entity ON pricing_margin_analytics(entityType, entityId);
```

## API Response Formats

### Cost Calculation Response
```json
{
  "success": true,
  "data": {
    "id": "calc_123",
    "timestamp": "2026-08-15T10:30:00Z",
    "specification": {
      "quantity": 250,
      "materialType": "170gsm gloss",
      "size": "210x297",
      "finish": "matte-lamination",
      "colors": "4/4",
      "designRequired": true,
      "designComplexity": "standard"
    },
    "costBreakdown": {
      "material": 1350,
      "printing": 800,
      "finishing": 300,
      "design": 400,
      "labor": 600,
      "wastage": 150,
      "delivery": 200,
      "overhead": 350,
      "total": 4150
    },
    "pricingRuleApplied": "rule_brochure_standard",
    "basePrice": 4150,
    "adjustmentsApplied": {
      "designComplexity": 400
    },
    "recommendedPrice": 6000,
    "marginPercentage": 0.308,
    "currency": "INR",
    "validUntil": "2026-09-15T10:30:00Z",
    "confidence": 0.92,
    "factorsConsidered": [
      "current-material-pricing",
      "standard-labor-rates",
      "typical-machine-efficiency"
    ],
    "assumptions": [
      "Standard equipment utilization",
      "Normal quality control standards"
    ]
  }
}
```

### Pricing Rule Response
```json
{
  "success": true,
  "data": {
    "id": "rule_456",
    "name": "Standard Brochure Printing",
    "description": "Base pricing for brochure printing jobs with standard turnaround",
    "appliesTo": {
      "productTypes": ["brochure-printing"],
      "categories": ["printing-services", "marketing-materials"],
      "attributes": {
        "printing.finish": ["none", "matte-lamination", "gloss-lamination"]
      }
    },
    "pricingStrategy": "cost_plus",
    "basePrice": 1500,
    "pricePerUnit": 8,
    "quantityBreaks": [
      { "minQuantity": 50, "multiplier": 1.0 },
      { "minQuantity": 100, "multiplier": 0.9 },
      { "minQuantity": 250, "multiplier": 0.85 },
      { "minQuantity": 500, "multiplier": 0.8 },
      { "minQuantity": 1000, "multiplier": 0.75 }
    ],
    "marginSettings": {
      "minimumMargin": 0.25,
      "targetMargin": 0.35,
      "maximumMargin": 0.50,
      "marginType": "on_price"
    },
    "adjustments": {
      "rushJobMultiplier": {
        "sameDay": 2.0,
        "nextDay": 1.5,
        "twoDay": 1.25
      },
      "designComplexityFactors": {
        "none": 0,
        "basic": 200,
        "standard": 400,
        "complex": 600,
        "custom": 800
      },
      "colorComplexity": {
        "1/0": 0,
        "1/1": 150,
        "2/0": 250,
        "2/1": 350,
        "2/2": 400,
        "4/0": 500,
        "4/1": 600,
        "4/2": 650,
        "4/4": 700
      },
      "sizeAdjustments": {
        "A5": 0.9,
        "A4": 1.0,
        "A3": 1.2,
        "A2": 1.5,
        "A1": 2.0
      },
      "materialUpgrades": {
        "130gsm": 0,
        "170gsm": 0.5,
        "250gsm": 1.0,
        "300gsm": 1.5,
        "350gsm": 2.0,
        "premium": 2.5
      },
      "finishingAddons": {
        "none": 0,
        "matte-lamination": 120,
        "gloss-lamination": 120,
        "uv-coating": 180,
        "binding": 250,
        "numbering": 80,
        "perforation": 60
      }
    },
    "currency": "INR",
    "effectiveFrom": "2026-08-01T00:00:00Z",
    "lastUpdated": "2026-08-15T10:30:00Z",
    "version": 1,
    "isActive": true,
    "confidence": 0.9,
    "reviewDate": "2027-08-01T00:00:00Z",
    "createdAt": "2026-08-01T08:00:00Z",
    "updatedAt": "2026-08-15T10:30:00Z",
    "createdBy": "user_001",
    "updatedBy": "user_001"
  }
}
```

## Events

### Emitted by Pricing Plugin
- `pricing.cost_component.added` - New cost component created
- `pricing.cost_component.updated` - Cost component modified
- `pricing.cost_component.deleted` - Cost component removed
- `pricing.rule.created` - New pricing rule created
- `pricing.rule.updated` - Pricing rule modified
- `pricing.rule.deleted` - Pricing rule removed
- `pricing.rule.activated` - Pricing rule made active
- `pricing.rule.deactivated` - Pricing rule made inactive
- `pricing.calculation.performed` - Price calculation completed
- `pricing.recommendation.generated` - Price recommendation created
- `pricing.discount.applied` - Discount applied to quote/order
- `pricing.margin.alert` - Margin fell below threshold
- `pricing.experiment.started` - Price experiment begun
- `pricing.experiment.completed` - Price experiment finished
- `pricing.experiment.results.available` - Experiment results ready
- `pricing.margin.analytics.updated` - Margin analytics refreshed

### Listened to by Pricing Plugin
- `catalog.product.updated` - Product/service specs changed (recalculate costs)
- `catalog.product.created` - New product/service added (set up pricing)
- `catalog.category.updated` - Category changed (review applicable rules)
- `material.cost.updated` - Supplier pricing changed (update cost components)
- `labor.rate.updated` - Labor rates changed (update cost components)
- `quote.sent` - Quote sent to customer (track quoted price)
- `quote.won` / `quote.lost` - Quote outcome known (learn from results)
- `project.completed` - Project finished (compare estimated vs actual)
- `customer.won` - New customer acquired (review pricing strategy)
- `competitor.price.updated` - Competitor pricing changed (adjust strategy)
- `marketing.campaign.started` - Promotion started (adjust for promotional pricing)
- `price.change.requested` - Owner requested price change (process through approval)