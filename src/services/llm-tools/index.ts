// Export base classes and utilities
export {
  BaseTool,
  ToolOrchestrator,
  SecurityValidator,
  SwedishFormatter,
  CircuitBreaker,
  RateLimiter,
  type ToolResult,
  type ToolProposal,
  type ToolContext,
  type AuditEntry,
  type LLMProvider
} from './base/tool-server'

// Export individual tools
export { MetricsTool, type MetricsResult } from './tools/metrics-tool'
export { WarehouseSQLTool, type QueryResult } from './tools/warehouse-sql-tool'
export {
  InsightSearchTool,
  InsightCreateTool,
  InsightUpdateTool,
  InsightLinkTool,
  type Insight
} from './tools/insights-tool'
export {
  ScenarioPlanTool,
  ScenarioRunTool,
  type ScenarioResult
} from './tools/scenarios-tool'
export { ReportComposeTool, type Report } from './tools/reports-tool'
export { ExplainRuleTool, type RuleExplanation } from './tools/explain-rule-tool'

// Export orchestrator
export { createLLMToolOrchestrator, AuditLogger, ProposalHandler } from './orchestrator'

// Export convenience function to get all tool names
export function getAvailableTools(): string[] {
  return [
    'metrics.query',
    'warehouse.sql_read',
    'insights.search',
    'insights.create',
    'insights.update',
    'insights.link',
    'scenarios.plan',
    'scenarios.run',
    'reports.compose',
    'explain.rule'
  ]
}

// Export tool schemas for validation
export { getToolSchemas } from './schemas'