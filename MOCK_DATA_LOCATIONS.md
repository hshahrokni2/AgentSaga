# Mock Data Locations for SVOA Lea Platform

## Frontend Test Mocks

### Insights/Findings
- `/tests/frontend/__mocks__/insights-mocks.tsx`
  - `mockInsights`: 50 sample insights with Swedish/English text
  - `mockSuppliers`: 10 Swedish suppliers
  - `MockWebSocketProvider`: WebSocket context mock
  - `mockApiResponses`: API response generators

- `/tests/frontend/__mocks__/findings-mocks.ts`
  - `mockFindings`: 5 sample findings
  - `mockRules`: 4 validation rules
  - `mockClusters`: 4 finding clusters
  - Helper functions: `filterFindings()`, `generateMockFindings()`

### Granskad Workflow
- `/tests/frontend/granskad/__mocks__/archon-mocks.tsx`
  - `mockArchonAPI()`: Complete Archon API mock
  - `MockStateMachine`: State transition mock
  - `generateMockChecklist()`: Dynamic checklist generator
  - `generateMockFindings()`: Finding generator
  - `generateMockComment()`: Comment generator

### Scenario Lab
- `/tests/frontend/scenario-lab/mocks/scenario-mocks.ts`
  - `mockScenarioAPI()`: Scenario API endpoints
  - `MockScenarioWebSocket`: WebSocket mock for real-time updates
  - `generateMockHeatmapData()`: Heatmap visualization data
  - Swedish number/currency formatters

### Server Mocks
- `/tests/frontend/__mocks__/simple-server.ts`
  - Global fetch mock (workaround for MSW issues)
  - Simple request/response handler

- `/tests/frontend/__mocks__/server.ts`
  - MSW server configuration (currently bypassed due to module issues)

## Backend Test Data

### Database Seeds
- Test fixtures use in-memory data generation
- No static seed files currently

## Usage in Tests
All test files import mocks from these locations for consistent test data across the suite.