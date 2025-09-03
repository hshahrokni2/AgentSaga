import { z } from 'zod'

// Tool schemas for runtime validation and documentation
export const ToolSchemas = {
  'metrics.query': z.object({
    metric: z.enum(['completeness', 'anomaly_burden', 'review_progress', 'data_quality']),
    supplierId: z.string().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    aggregation: z.enum(['sum', 'average', 'median', 'percentile']).optional(),
    percentile: z.number().min(0).max(100).optional(),
    language: z.enum(['sv', 'en']).optional()
  }),
  
  'warehouse.sql_read': z.object({
    query: z.string().max(5000),
    params: z.array(z.any()).optional(),
    limit: z.number().min(1).max(1000).default(100),
    timeout: z.number().min(1000).max(30000).default(5000),
    format: z.enum(['json', 'csv']).default('json')
  }),
  
  'insights.search': z.object({
    query: z.string().optional(),
    filters: z.object({
      severity: z.enum(['critical', 'warning', 'info']).optional(),
      status: z.enum(['active', 'resolved', 'dismissed']).optional(),
      source: z.enum(['rule', 'ml', 'human', 'whatif']).optional(),
      supplierId: z.string().optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional()
    }).optional(),
    limit: z.number().min(1).max(100).default(10),
    language: z.enum(['sv', 'en']).optional()
  }),
  
  'insights.create': z.object({
    title: z.string().max(200),
    description: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    source: z.enum(['rule', 'ml', 'human', 'whatif']),
    supplierId: z.string().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    evidence: z.array(z.object({
      type: z.enum(['finding', 'row', 'chart', 'file']),
      id: z.string(),
      description: z.string().optional()
    })).optional(),
    language: z.enum(['sv', 'en']).optional()
  }),
  
  'insights.update': z.object({
    id: z.string(),
    updates: z.object({
      title: z.string().max(200).optional(),
      description: z.string().optional(),
      severity: z.enum(['critical', 'warning', 'info']).optional(),
      status: z.enum(['active', 'resolved', 'dismissed']).optional()
    })
  }),
  
  'insights.link': z.object({
    insightId: z.string(),
    linkTo: z.array(z.object({
      type: z.enum(['finding', 'scenario', 'insight']),
      id: z.string(),
      relationship: z.enum(['causes', 'caused_by', 'related_to', 'duplicates'])
    }))
  }),
  
  'scenarios.plan': z.object({
    title: z.string().max(200),
    description: z.string(),
    cohort: z.array(z.string()),
    changes: z.array(z.object({
      type: z.enum(['parameter', 'threshold', 'rule']),
      target: z.string(),
      value: z.any()
    })),
    basedOnInsights: z.array(z.string()).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    language: z.enum(['sv', 'en']).optional()
  }),
  
  'scenarios.run': z.object({
    scenarioId: z.string(),
    execute: z.boolean().default(true),
    compareToBaseline: z.boolean().default(true)
  }),
  
  'reports.compose': z.object({
    type: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
    title: z.string(),
    sections: z.array(z.enum([
      'summary',
      'completeness',
      'anomalies',
      'insights',
      'scenarios',
      'recommendations'
    ])),
    supplierId: z.string().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    language: z.enum(['sv', 'en']),
    format: z.enum(['pdf', 'html', 'markdown']).default('pdf'),
    includeCharts: z.boolean().default(true),
    includeAppendix: z.boolean().default(false)
  }),
  
  'explain.rule': z.object({
    ruleId: z.string(),
    targetAudience: z.enum(['technical', 'business', 'enduser']).default('business'),
    language: z.enum(['sv', 'en']),
    includeExamples: z.boolean().default(true),
    format: z.enum(['text', 'markdown', 'flowchart']).default('markdown')
  })
}

// Get all tool schemas for documentation
export function getToolSchemas(): typeof ToolSchemas {
  return ToolSchemas
}

// Validate tool input
export function validateToolInput(toolName: string, input: any): any {
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas]
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`)
  }
  
  return schema.parse(input)
}

// Generate JSON Schema from Zod schemas (for OpenAPI/documentation)
export function generateJSONSchemas(): Record<string, any> {
  const jsonSchemas: Record<string, any> = {}
  
  for (const [name, schema] of Object.entries(ToolSchemas)) {
    // This would use zod-to-json-schema in real implementation
    jsonSchemas[name] = {
      name,
      description: `Schema for ${name} tool`,
      // ... convert zod schema to JSON Schema
    }
  }
  
  return jsonSchemas
}