# LLM Function Calling Tools - Test Suite

## 🔴 TDD RED Phase Status

Comprehensive failing tests for LLM function calling tools with focus on security, Swedish/English support, and performance.

## 📊 Coverage Targets

- **Tool Functions**: 95% code coverage
- **Security Validation**: 100% code coverage
- **Provider Fallback**: 100% code coverage
- **Schema Validation**: 100% code coverage

## 🧪 Test Files

### Core Tool Tests

1. **`test_metrics_tool.ts`** - Metrics Query Tool
   - KPI calculations (completeness, anomaly burden, review progress)
   - Swedish number formatting (1 234,56)
   - Performance: < 5s execution
   - Cache optimization
   - Data aggregation (sum, median, percentile)

2. **`test_warehouse_sql_tool.ts`** - SQL Read-Only Access
   - SQL injection prevention (100% coverage)
   - Read-only enforcement
   - Query timeout (5s default, 30s max)
   - Swedish character support (åäö)
   - PII detection and blocking

3. **`test_insights_tool.ts`** - Insights CRUD Operations
   - Search with Swedish/English text
   - Auto-generated IDs (INS-YYYY-MM-NNN)
   - Duplicate detection
   - Insight linking and dependencies
   - Impact calculation

4. **`test_scenarios_tool.ts`** - Scenario Planning
   - Deterministic execution verification
   - Immutable snapshots
   - Performance: median < 60s, p95 < 120s
   - Swedish seasonal adjustments
   - Memory optimization for 1000+ suppliers

5. **`test_reports_tool.ts`** - Report Generation
   - Multi-format export (PDF, HTML, DOCX, Markdown)
   - Swedish/English content
   - GDPR compliance reports
   - Performance: < 5s generation
   - Confidentiality watermarks

6. **`test_explain_rule_tool.ts`** - Rule Explanations
   - Simple to complex rule breakdowns
   - Target audience adaptation
   - Example generation
   - Visual flowcharts
   - Multi-language explanations

### Integration Tests

7. **`test_llm_integration.ts`** - End-to-End Orchestration
   - Provider fallback chain: Claude → GPT-4o → Gemini
   - Concurrent tool execution (max 5)
   - Rate limiting and queuing
   - Complete workflows with dependencies
   - Circuit breaker for failing providers

## 🚀 Running Tests

```bash
# Run all LLM tool tests
npm run test:llm-tools

# Run with coverage
npm run test:llm-tools:coverage

# Run specific tool tests
npm test tests/llm-tools/test_metrics_tool.ts

# Run integration tests only
npm test tests/llm-tools/test_llm_integration.ts

# Watch mode for development
npm run test:llm-tools:watch
```

## 🛡️ Security Test Patterns

All tools are tested against:

- **SQL Injection**: `'; DROP TABLE users; --`
- **XSS Attempts**: `<script>alert('XSS')</script>`
- **Command Injection**: `; ls -la`
- **Path Traversal**: `../../etc/passwd`
- **PII Detection**: Swedish personnummer patterns

## 🌍 Localization Testing

### Swedish (sv)
- Number format: `1 234,56`
- Currency: `1 234,56 SEK`
- Percentage: `92,5 %`
- Date: `2024-01-15` (ISO) or `15 januari 2024`

### English (en)
- Number format: `1,234.56`
- Currency: `$1,234.56`
- Percentage: `92.5%`
- Date: `January 15, 2024`

## 📊 Performance Benchmarks

| Operation | Target | Test Coverage |
|-----------|--------|---------------|
| Tool Call | < 5s | ✓ |
| Scenario (median) | < 60s | ✓ |
| Scenario (p95) | < 120s | ✓ |
| Report Generation | < 5s | ✓ |
| Provider Fallback | < 10s/attempt | ✓ |

## 🔄 Provider Fallback Chain

```
Claude Sonnet 4 (priority 1)
  ↓ (on failure)
GPT-4o (priority 2)
  ↓ (on failure)
Gemini 1.5 Flash (priority 3)
  ↓ (all failed)
Error with retry suggestions
```

## 📁 Test Data

Swedish test suppliers:
- Återvinning AB
- Städföretaget i Västerås
- Avfallshantering Örebro
- Miljötjänst Stockholm

## 🔧 Mock Utilities

Global test helpers available:

```typescript
// Create mock provider
const provider = createMockProvider('claude-sonnet-4');

// Create mock tool
const tool = createMockTool('metrics');

// Swedish test data
const data = generateSwedishTestData();

// Security patterns
const patterns = securityTestPatterns.sqlInjection;

// Performance benchmarks
const benchmark = performanceBenchmarks.tool_execution.p95;
```

## 🎯 Next Steps (GREEN Phase)

1. Implement tool base classes
2. Add provider adapters
3. Implement security validators
4. Add Swedish formatters
5. Create orchestrator
6. Implement caching layer
7. Add rate limiting
8. Create audit logging

## 📐 Compliance

- GDPR Article 17 (Right to erasure)
- Swedish Data Protection Authority (IMY) requirements
- 5-year retention policy
- EU data residency

## 🔍 Test Execution Order

1. Security validation (blocking)
2. Schema validation
3. Tool execution
4. Response validation
5. Audit logging

## ⚠️ Known Test Dependencies

- Node.js 18+ (for webcrypto)
- TypeScript 5.0+
- Jest 29+
- zod for schema validation

## 📦 NPM Scripts

```json
{
  "test:llm-tools": "jest --config jest.config.llm-tools.js",
  "test:llm-tools:coverage": "jest --config jest.config.llm-tools.js --coverage",
  "test:llm-tools:watch": "jest --config jest.config.llm-tools.js --watch",
  "test:llm-tools:debug": "node --inspect-brk ./node_modules/.bin/jest --config jest.config.llm-tools.js --runInBand"
}
```