import { z } from 'zod'
import { BaseTool, ToolContext, SwedishFormatter } from '../base/tool-server'

// Schema for metrics query
const MetricsQuerySchema = z.object({
  metric: z.enum(['completeness', 'anomaly_burden', 'review_progress', 'data_quality']),
  supplierId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  aggregation: z.enum(['sum', 'average', 'median', 'percentile']).optional(),
  percentile: z.number().min(0).max(100).optional(),
  language: z.enum(['sv', 'en']).optional()
})

type MetricsQueryInput = z.infer<typeof MetricsQuerySchema>

export interface MetricsResult {
  metric: string
  value: number
  formatted: string
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  comparison?: {
    previous: number
    change: number
    changePercent: number
  }
  metadata: {
    supplierId?: string
    month: string
    calculatedAt: Date
  }
}

export class MetricsTool extends BaseTool<MetricsQueryInput, MetricsResult> {
  name = 'metrics.query'
  description = 'Query KPIs and metrics with Swedish number formatting'
  schema = MetricsQuerySchema
  requiresConfirmation = false

  protected async run(
    params: MetricsQueryInput,
    context: ToolContext
  ): Promise<MetricsResult> {
    const { metric, supplierId, month, aggregation = 'average', language = context.language } = params
    
    // Check cache
    const cacheKey = `metrics:${metric}:${supplierId || 'all'}:${month}:${aggregation}`
    const cached = context.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
      return cached.data
    }
    
    // Simulate metric calculation
    const value = await this.calculateMetric(metric, supplierId, month, aggregation, params.percentile)
    
    // Get previous month for comparison
    const previousMonth = this.getPreviousMonth(month)
    const previousValue = await this.calculateMetric(metric, supplierId, previousMonth, aggregation)
    
    // Calculate trend and change
    const change = value - previousValue
    const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0
    const trend = change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'stable'
    
    // Format based on language
    const formatted = language === 'sv' 
      ? this.formatSwedish(metric, value)
      : this.formatEnglish(metric, value)
    
    const result: MetricsResult = {
      metric,
      value,
      formatted,
      unit: this.getUnit(metric),
      trend,
      comparison: {
        previous: previousValue,
        change,
        changePercent
      },
      metadata: {
        supplierId,
        month,
        calculatedAt: new Date()
      }
    }
    
    // Cache result
    context.cache.set(cacheKey, { data: result, timestamp: Date.now() })
    
    return result
  }

  private async calculateMetric(
    metric: string,
    supplierId: string | undefined,
    month: string,
    aggregation: string,
    percentile?: number
  ): Promise<number> {
    // Simulated database query
    // In real implementation, this would query PostgreSQL
    
    const baseValues = {
      completeness: 0.92,
      anomaly_burden: 3.5,
      review_progress: 0.78,
      data_quality: 0.95
    }
    
    let value = baseValues[metric as keyof typeof baseValues] || 0
    
    // Add some variation based on supplier
    if (supplierId) {
      const hash = supplierId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
      value += (hash % 10) / 100 - 0.05
    }
    
    // Apply aggregation
    if (aggregation === 'percentile' && percentile !== undefined) {
      value = value * (percentile / 100)
    }
    
    return Math.max(0, Math.min(1, value))
  }

  private formatSwedish(metric: string, value: number): string {
    switch (metric) {
      case 'completeness':
      case 'review_progress':
      case 'data_quality':
        return SwedishFormatter.formatPercent(value)
      case 'anomaly_burden':
        return SwedishFormatter.formatNumber(value, 1)
      default:
        return SwedishFormatter.formatNumber(value)
    }
  }

  private formatEnglish(metric: string, value: number): string {
    switch (metric) {
      case 'completeness':
      case 'review_progress':
      case 'data_quality':
        return `${(value * 100).toFixed(1)}%`
      case 'anomaly_burden':
        return value.toFixed(1)
      default:
        return value.toFixed(2)
    }
  }

  private getUnit(metric: string): string | undefined {
    switch (metric) {
      case 'completeness':
      case 'review_progress':
      case 'data_quality':
        return '%'
      case 'anomaly_burden':
        return 'weighted score'
      default:
        return undefined
    }
  }

  private getPreviousMonth(month: string): string {
    const [year, monthNum] = month.split('-').map(Number)
    const date = new Date(year, monthNum - 1, 1)
    date.setMonth(date.getMonth() - 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
}