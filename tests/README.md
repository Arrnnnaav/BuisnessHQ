# Testing Strategy

This directory contains all tests for the BusinessOS application.

## Test Categories

### 1. Unit Tests
Tests individual functions, methods, and components in isolation.
- Located in: `tests/unit/`
- Framework: Vitest
- Mocking: External dependencies mocked
- Coverage Goal: 80%+ for core business logic

### 2. Integration Tests
Tests how different components work together.
- Located in: `tests/integration/`
- Framework: Vitest with test database
- Scope: Plugin interactions, API endpoints, data flows
- External Services: Mocked or using test instances

### 3. End-to-End (E2E) Tests
Tests complete user workflows from start to finish.
- Located in: `tests/e2e/`
- Framework: Playwright
- Browsers: Chromium, Firefox, WebKit
- Scenarios: Critical user journeys and business workflows

### 4. Performance Tests
Tests system performance under various loads.
- Located in: `tests/performance/`
- Tools: k6, Artillery, or custom scripts
- Metrics: Response time, throughput, resource usage
- Scenarios: Normal load, peak load, stress testing

### 5. Security Tests
Tests for vulnerabilities and security issues.
- Located in: `tests/security/`
- Tools: OWASP ZAP, custom scripts, manual review
- Focus: Authentication, authorization, data protection
- Frequency: Regular security scanning

### 6. Plugin Tests
Tests specific to individual plugins.
- Located in: `tests/plugins/[plugin-name]/`
- Structure: Mirrors main plugin structure
- Scope: Plugin-specific functionality and integrations

## Test Organization

```
tests/
├── unit/                 # Unit tests
│   ├── core/             # Core system tests
│   │   ├── company_brain/
│   │   ├── orchestrator/
│   │   ├── workflows/
│   │   ├── events/
│   │   ├── approvals/
│   │   ├── policies/
│   │   ├── llm_router/
│   │   ├── plugins/
│   │   ├── audit/
│   │   ├── scheduler/
│   │   ├── notifications/
│   │   ├── auth/
│   │   └── secrets/
│   ├── plugins/          # Plugin unit tests
│   │   ├── catalog/
│   │   ├── projects/
│   │   ├── crm/
│   │   ├── quotations/
│   │   ├── pricing/
│   │   ├── seo/
│   │   ├── local_seo/
│   │   ├── google_business/
│   │   ├── reviews/
│   │   ├── content/
│   │   ├── campaigns/
│   │   ├── competitors/
│   │   ├── analytics/
│   │   ├── social/
│   │   ├── whatsapp/
│   │   └── email/
│   ├── integrations/     # Integration tests
│   │   ├── google/
│   │   ├── website/
│   │   ├── meta/
│   │   ├── email/
│   │   └── whatsapp/
│   └── data/             # Data layer tests
├── integration/          # Integration tests
│   ├── api/              # API endpoint tests
│   ├── plugins/          # Plugin interaction tests
│   ├── workflows/        # Cross-plugin workflow tests
│   ├── events/           # Event flow tests
│   └── data/             # Data layer integration tests
├── e2e/                  # End-to-end tests
│   ├── user-journeys/    # Complete user workflows
│   │   ├── onboarding/
│   │   ├── catalog-management/
│   │   ├── project-lifecycle/
│   │   ├── quotation-process/
│   │   ├── seo-optimization/
│   │   ├── gbp-management/
│   │   ├── review-response/
│   │   ├── campaign-execution/
│   │   └── content-publishing/
│   ├── business-scenarios/ # Business-specific scenarios
│   │   ├── abizcreator/
│   │   ├── seasonal-peaks/
│   │   ├── bulk-operations/
│   │   └── multi-location/
│   └── performance/      # Performance-focused E2E tests
├── performance/          # Dedicated performance tests
│   ├── load-testing/     # Gradual load increase tests
│   ├── stress-testing/   # Beyond capacity tests
│   ├── spike-testing/    # Sudden load increase tests
│   ├── endurance-testing/# Long-duration load tests
│   └── scalability-testing/# Growth pattern tests
├── security/             # Security tests
│   ├── vulnerability/    # Known vulnerability tests
│   ├── penetration/      # Penetration testing
│   ├── authentication/   # Auth system tests
│   ├── authorization/    # Permission system tests
│   ├── data-protection/  # Data encryption and privacy tests
│   └── compliance/       # Regulatory compliance tests
├── plugins/              # Plugin-specific test suites
│   ├── catalog/          # Catalog plugin tests
│   ├── projects/         # Projects plugin tests
│   ├── crm/              # CRM plugin tests
│   ├── quotations/       # Quotations plugin tests
│   ├── pricing/          # Pricing plugin tests
│   ├── seo/              # SEO plugin tests
│   ├── local_seo/        # Local SEO plugin tests
│   ├── google_business/  # GBP plugin tests
│   ├── reviews/          # Reviews plugin tests
│   ├── content/          # Content plugin tests
│   ├── campaigns/        # Campaigns plugin tests
│   ├── competitors/      # Competitors plugin tests
│   ├── analytics/        # Analytics plugin tests
│   ├── social/           # Social plugin tests
│   ├── whatsapp/         # WhatsApp plugin tests
│   └── email/            # Email plugin tests
├── fixtures/             # Test data and mocks
│   ├── data/             # Test data sets
│   │   ├── minimal/      # Minimal test data set
│   │   ├── sample/       # Sample business data set
│   │   ├── large/        # Large data set for performance tests
│   │   └── edge-cases/   # Edge case and boundary test data
│   ├── mocks/            # Mock objects and services
│   │   ├── apis/         # Mock external APIs
│   │   ├── databases/    # Mock database connections
│   │   ├── files/        # Mock file system
│   │   └── vectors/      # Mock vector database
│   └── configurations/   # Test configurations and environments
├── helpers/              # Test utilities and helpers
│   ├── assertions/       # Custom assertion libraries
│   ├── builders/         # Test data builders
│   ├── mocks/            # Test mocking utilities
│   ├── setup/            # Test setup and teardown helpers
│   └── utils/            # General test utility functions
├── reports/              # Test results and reports
│   ├── unit/             # Unit test reports
│   ├── integration/      # Integration test reports
│   ├── e2e/              # E2E test reports
│   ├── performance/      # Performance test reports
│   ├── security/         # Security test reports
│   └── coverage/         # Code coverage reports
├── configs/              # Test configuration files
│   ├── vitest.config.ts  # Vitest configuration
│   ├── playwright.config.ts # Playwright configuration
│   ├── jest.config.js    # Jest configuration (if used)
│   └── k6.config.js      # k6 configuration (if used)
└── README.md             # This file
```

## Testing Guidelines

### Naming Conventions
- **Test Files**: `[feature-or-method].test.ts` or `[feature-or-method].spec.ts`
- **Test Suites**: `describe('feature or component', () => { ... })`
- **Test Cases**: `it('should do something when condition', () => { ... })`
- **Test Groups**: Use `describe` blocks to group related tests
- **Setup/Cleanup**: Use `beforeEach`, `afterEach`, `beforeAll`, `afterAll` as needed

### Test Structure
```typescript
describe('Feature or Component Name', () => {
  let service: ServiceUnderTest;
  let mockDependency: MockedDependency;

  beforeEach(() => {
    // Set up fresh instances for each test
    mockDependency = createMockDependency();
    service = new ServiceUnderTest(mockDependency);
  });

  describe('Method Name', () => {
    it('should return expected result for valid input', () => {
      // Arrange
      const input = validTestInput;
      
      // Act
      const result = service.methodName(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should throw error for invalid input', () => {
      // Arrange
      const input = invalidTestInput;
      
      // Act & Assert
      expect(() => service.methodName(input)).toThrow(ErrorType);
    });
  });
});
```

### Best Practices
1. **Isolation**: Each test should be independent and not rely on other tests
2. **Deterministic**: Tests should produce the same results every time
3. **Fast**: Unit tests should run quickly (aim for <100ms each)
4. **Readable**: Tests should clearly express intent and expected behavior
5. **Maintainable**: Tests should be easy to update when requirements change
6. **Focused**: Each test should verify one specific behavior or outcome
7. **Comprehensive**: Cover normal cases, edge cases, and error conditions
8. **Documented**: Tests should serve as documentation for expected behavior

### Mocking Guidelines
- **External Dependencies**: Always mock databases, APIs, file system, etc.
- **Time Dependencies**: Mock Date.now() or use libraries like sinon for time
- **Random Elements**: Seed random number generators for reproducible results
- **External Services**: Mock Google APIs, email services, payment processors, etc.
- **Plugins**: Mock other plugins when testing plugin-specific functionality
- **UI Components**: Mock DOM APIs or use testing libraries like React Testing Library

### Code Coverage
- **Statement Coverage**: Aim for 90%+ on core business logic
- **Branch Coverage**: Aim for 80%+ on complex decision-making code
- **Function Coverage**: Aim for 100% on public APIs and interfaces
- **Line Coverage**: Use as supplementary metric, not primary goal
- **Quality Over Quantity**: Meaningful tests are better than numerous trivial tests

## Environment Setup

### Test Database
- Uses separate test database instance
- Automatically migrated and seeded before test runs
- Cleaned up after each test suite
- Configuration in `tests/configs/test-database.ts`

### Test Services
- Mock implementations of external services
- Configurable behavior for different test scenarios
- Verification of expected interactions
- Configuration in `tests/configs/test-services.ts`

### Test Users and Permissions
- Pre-defined test users with various permission levels
- Configurable roles and access levels
- Secure handling of test credentials
- Configuration in `tests/configs/test-users.ts`

### Continuous Integration
- Runs on every pull request and commit
- Parallel execution for faster feedback
- Artifact preservation for debugging failed tests
- Notification on test failures and regressions
- Deployment blocking on test failures in main branches

## ABizCreator Specific Testing

### Printing Business Scenarios
- Catalog management with printing-specific attributes
- Project lifecycle from quote to completion
- Quotation generation with complex pricing rules
- SEO optimization for Jaipur-local printing searches
- Google Business Profile management for local visibility
- Review management and response workflows
- Content creation for printing educational materials
- Campaign execution for seasonal printing promotions
- Analytics tracking of print business metrics
- Integration testing with printing industry tools and formats

### Local Business Scenarios (Jaipur Focus)
- Geographic targeting and local search optimization
- Multi-language content handling (Hindi/English)
- Seasonal business pattern modeling (wedding, festival seasons)
- Local event and festival participation tracking
- Regional competitor analysis and positioning
- Local citation and directory management
- Weather-dependent material and service adjustments
- Transportation and delivery logistics modeling

### Performance and Scale Testing
- Seasonal peak load simulation (Diwali, wedding seasons)
- Bulk data import/export testing (catalog synchronization)
- High-volume message testing (WhatsApp/email campaigns)
- Concurrent user simulation (multiple staff accessing system)
- Large media handling (high-resolution project galleries)
- Complex reporting generation (historical trend analysis)
- Real-time feature testing (live chat, notifications)
- Integration load testing (multiple external system syncs)

### Security and Compliance Testing
- Customer data protection (PII, financial information)
- Payment data security (if processing payments)
- Communication privacy (messages, emails, calls)
- Content security (uploaded files, user-generated content)
- Access control verification (role-based permissions)
- Audit trail completeness (tracking all significant actions)
- Data retention compliance (following data policies)
- Local regulation compliance (Indian business laws)