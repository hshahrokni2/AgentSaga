import { z } from 'zod'
import { BaseTool, ToolContext, SwedishFormatter } from '../base/tool-server'
import crypto from 'crypto'

// Schemas for insight operations
const InsightSearchSchema = z.object({
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
})

const InsightCreateSchema = z.object({
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
})

const InsightUpdateSchema = z.object({
  id: z.string(),
  updates: z.object({
    title: z.string().max(200).optional(),
    description: z.string().optional(),
    severity: z.enum(['critical', 'warning', 'info']).optional(),
    status: z.enum(['active', 'resolved', 'dismissed']).optional()
  })
})

const InsightLinkSchema = z.object({
  insightId: z.string(),
  linkTo: z.array(z.object({
    type: z.enum(['finding', 'scenario', 'insight']),
    id: z.string(),
    relationship: z.enum(['causes', 'caused_by', 'related_to', 'duplicates'])
  }))
})

export interface Insight {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  status: 'active' | 'resolved' | 'dismissed'
  source: 'rule' | 'ml' | 'human' | 'whatif'
  supplierId?: string
  month: string
  evidence: Array<{
    type: string
    id: string
    description?: string
  }>
  links: Array<{
    type: string
    id: string
    relationship: string
  }>
  createdAt: Date
  updatedAt: Date
}

// Search tool
export class InsightSearchTool extends BaseTool<z.infer<typeof InsightSearchSchema>, Insight[]> {
  name = 'insights.search'
  description = 'Search insights with filtering and Swedish/English support'
  schema = InsightSearchSchema
  requiresConfirmation = false

  protected async run(
    params: z.infer<typeof InsightSearchSchema>,
    context: ToolContext
  ): Promise<Insight[]> {
    const { query, filters = {}, limit, language = context.language } = params
    
    // Cache key
    const cacheKey = `insights:search:${JSON.stringify({ query, filters, limit })}`
    const cached = context.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 30000) { // 30s cache
      return cached.data
    }
    
    // Simulate database search
    const results = await this.searchInsights(query, filters, limit)
    
    // Translate if needed
    const translatedResults = language === 'sv' 
      ? this.translateToSwedish(results)
      : results
    
    // Cache results
    context.cache.set(cacheKey, { data: translatedResults, timestamp: Date.now() })
    
    return translatedResults
  }

  private async searchInsights(
    query?: string,
    filters?: any,
    limit: number = 10
  ): Promise<Insight[]> {
    // Mock search implementation
    const mockInsights: Insight[] = [
      {
        id: 'INS-2025-09-001',
        title: 'Duplicate invoices detected',
        description: 'Multiple invoices with same amount within 30 minutes',
        severity: 'critical',
        status: 'active',
        source: 'rule',
        supplierId: 'SUP-001',
        month: '2025-09',
        evidence: [
          { type: 'finding', id: 'FND-001', description: 'Invoice #123' },
          { type: 'finding', id: 'FND-002', description: 'Invoice #124' }
        ],
        links: [],
        createdAt: new Date('2025-09-01'),
        updatedAt: new Date('2025-09-01')
      }
    ]
    
    // Apply filters
    let filtered = mockInsights
    if (filters.severity) {
      filtered = filtered.filter(i => i.severity === filters.severity)
    }
    if (filters.status) {
      filtered = filtered.filter(i => i.status === filters.status)
    }
    if (filters.supplierId) {
      filtered = filtered.filter(i => i.supplierId === filters.supplierId)
    }
    
    // Apply text search
    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(lowerQuery) ||
        i.description.toLowerCase().includes(lowerQuery)
      )
    }
    
    return filtered.slice(0, limit)
  }

  private translateToSwedish(insights: Insight[]): Insight[] {
    // Simple translation mapping
    const translations: Record<string, string> = {
      'Duplicate invoices detected': 'Dubbla fakturor upptäckta',
      'critical': 'kritisk',
      'warning': 'varning',
      'info': 'information',
      'active': 'aktiv',
      'resolved': 'löst',
      'dismissed': 'avvisad'
    }
    
    return insights.map(insight => ({
      ...insight,
      title: translations[insight.title] || insight.title,
      severity: translations[insight.severity] as any || insight.severity,
      status: translations[insight.status] as any || insight.status
    }))
  }
}

// Create tool
export class InsightCreateTool extends BaseTool<z.infer<typeof InsightCreateSchema>, Insight> {
  name = 'insights.create'
  description = 'Create a new insight with auto-generated ID'
  schema = InsightCreateSchema
  requiresConfirmation = true

  protected async run(
    params: z.infer<typeof InsightCreateSchema>,
    context: ToolContext
  ): Promise<Insight> {
    const { month } = params
    
    // Generate human-friendly ID
    const id = await this.generateInsightId(month)
    
    // Create insight
    const insight: Insight = {
      id,
      title: params.title,
      description: params.description,
      severity: params.severity,
      status: 'active',
      source: params.source,
      supplierId: params.supplierId,
      month: params.month,
      evidence: params.evidence || [],
      links: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Simulate database insert
    await this.saveInsight(insight)
    
    return insight
  }

  private async generateInsightId(month: string): Promise<string> {
    // Format: INS-YYYY-MM-NNN
    const [year, monthNum] = month.split('-')
    
    // Get next sequence number (mock)
    const sequence = Math.floor(Math.random() * 900) + 100
    
    return `INS-${year}-${monthNum}-${String(sequence).padStart(3, '0')}`
  }

  private async saveInsight(insight: Insight): Promise<void> {
    // Simulate database save
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// Update tool
export class InsightUpdateTool extends BaseTool<z.infer<typeof InsightUpdateSchema>, Insight> {
  name = 'insights.update'
  description = 'Update an existing insight'
  schema = InsightUpdateSchema
  requiresConfirmation = true

  protected async run(
    params: z.infer<typeof InsightUpdateSchema>,
    context: ToolContext
  ): Promise<Insight> {
    const { id, updates } = params
    
    // Get existing insight
    const existing = await this.getInsight(id)
    if (!existing) {
      throw new Error(`Insight ${id} not found`)
    }
    
    // Apply updates
    const updated: Insight = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    }
    
    // Save
    await this.saveInsight(updated)
    
    return updated
  }

  private async getInsight(id: string): Promise<Insight | null> {
    // Mock fetch
    return {
      id,
      title: 'Existing insight',
      description: 'Description',
      severity: 'warning',
      status: 'active',
      source: 'rule',
      month: '2025-09',
      evidence: [],
      links: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private async saveInsight(insight: Insight): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// Link tool
export class InsightLinkTool extends BaseTool<z.infer<typeof InsightLinkSchema>, Insight> {
  name = 'insights.link'
  description = 'Link insights to other entities'
  schema = InsightLinkSchema
  requiresConfirmation = false

  protected async run(
    params: z.infer<typeof InsightLinkSchema>,
    context: ToolContext
  ): Promise<Insight> {
    const { insightId, linkTo } = params
    
    // Get insight
    const insight = await this.getInsight(insightId)
    if (!insight) {
      throw new Error(`Insight ${insightId} not found`)
    }
    
    // Add links
    insight.links = [...insight.links, ...linkTo]
    insight.updatedAt = new Date()
    
    // Save
    await this.saveInsight(insight)
    
    return insight
  }

  private async getInsight(id: string): Promise<Insight | null> {
    return {
      id,
      title: 'Insight',
      description: 'Description',
      severity: 'warning',
      status: 'active',
      source: 'rule',
      month: '2025-09',
      evidence: [],
      links: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private async saveInsight(insight: Insight): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}