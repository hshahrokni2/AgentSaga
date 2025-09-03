import { z } from 'zod'
import { BaseTool, ToolContext, SwedishFormatter } from '../base/tool-server'
import crypto from 'crypto'

// Schemas for scenario operations
const ScenarioPlanSchema = z.object({
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
})

const ScenarioRunSchema = z.object({
  scenarioId: z.string(),
  execute: z.boolean().default(true),
  compareToBaseline: z.boolean().default(true)
})

export interface ScenarioResult {
  id: string
  title: string
  description: string
  status: 'planned' | 'running' | 'completed' | 'failed'
  cohort: string[]
  changes: any[]
  results?: {
    kpis: {
      completeness: number
      anomalyBurden: number
      reviewProgress: number
    }
    diff?: {
      completeness: number
      anomalyBurden: number
      reviewProgress: number
    }
    impact: {
      affectedSuppliers: number
      estimatedSavings: number
      riskScore: number
    }
  }
  snapshot?: string
  createdAt: Date
  executedAt?: Date
  executionTime?: number
}

// Plan tool
export class ScenarioPlanTool extends BaseTool<z.infer<typeof ScenarioPlanSchema>, ScenarioResult> {
  name = 'scenarios.plan'
  description = 'Plan a what-if scenario'
  schema = ScenarioPlanSchema
  requiresConfirmation = false

  protected async run(
    params: z.infer<typeof ScenarioPlanSchema>,
    context: ToolContext
  ): Promise<ScenarioResult> {
    const { month, language = context.language } = params
    
    // Generate scenario ID
    const id = await this.generateScenarioId(month)
    
    // Create scenario plan
    const scenario: ScenarioResult = {
      id,
      title: params.title,
      description: params.description,
      status: 'planned',
      cohort: params.cohort,
      changes: params.changes,
      createdAt: new Date()
    }
    
    // Save scenario
    await this.saveScenario(scenario)
    
    return scenario
  }

  private async generateScenarioId(month: string): Promise<string> {
    // Format: SCN-YYYY-MM-NNN
    const [year, monthNum] = month.split('-')
    const sequence = Math.floor(Math.random() * 900) + 100
    return `SCN-${year}-${monthNum}-${String(sequence).padStart(3, '0')}`
  }

  private async saveScenario(scenario: ScenarioResult): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// Run tool
export class ScenarioRunTool extends BaseTool<z.infer<typeof ScenarioRunSchema>, ScenarioResult> {
  name = 'scenarios.run'
  description = 'Execute a planned scenario'
  schema = ScenarioRunSchema
  requiresConfirmation = true

  protected async run(
    params: z.infer<typeof ScenarioRunSchema>,
    context: ToolContext
  ): Promise<ScenarioResult> {
    const { scenarioId, execute, compareToBaseline } = params
    
    // Get scenario
    const scenario = await this.getScenario(scenarioId)
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`)
    }
    
    // Check if already running
    if (scenario.status === 'running') {
      throw new Error('Scenario is already running')
    }
    
    // Update status
    scenario.status = 'running'
    await this.saveScenario(scenario)
    
    try {
      // Execute scenario (deterministic calculation)
      const startTime = Date.now()
      
      // Calculate KPIs
      const kpis = await this.calculateKPIs(scenario.cohort, scenario.changes)
      
      // Get baseline if requested
      let diff = undefined
      if (compareToBaseline) {
        const baseline = await this.getBaselineKPIs(scenario.cohort)
        diff = {
          completeness: kpis.completeness - baseline.completeness,
          anomalyBurden: kpis.anomalyBurden - baseline.anomalyBurden,
          reviewProgress: kpis.reviewProgress - baseline.reviewProgress
        }
      }
      
      // Calculate impact
      const impact = await this.calculateImpact(scenario, kpis, diff)
      
      // Create immutable snapshot
      const snapshot = this.createSnapshot(scenario, kpis, diff, impact)
      
      // Update scenario
      scenario.status = 'completed'
      scenario.results = { kpis, diff, impact }
      scenario.snapshot = snapshot
      scenario.executedAt = new Date()
      scenario.executionTime = Date.now() - startTime
      
      await this.saveScenario(scenario)
      
      return scenario
    } catch (error) {
      scenario.status = 'failed'
      await this.saveScenario(scenario)
      throw error
    }
  }

  private async getScenario(id: string): Promise<ScenarioResult | null> {
    // Mock fetch
    return {
      id,
      title: 'Test Scenario',
      description: 'Testing impact of threshold changes',
      status: 'planned',
      cohort: ['SUP-001', 'SUP-002'],
      changes: [
        { type: 'threshold', target: 'anomaly_detection', value: 0.15 }
      ],
      createdAt: new Date()
    }
  }

  private async saveScenario(scenario: ScenarioResult): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async calculateKPIs(cohort: string[], changes: any[]): Promise<any> {
    // Deterministic calculation based on cohort and changes
    const hash = this.hashInput({ cohort, changes })
    
    // Use hash to generate consistent results
    const seed = parseInt(hash.slice(0, 8), 16) / 0xffffffff
    
    return {
      completeness: 0.85 + seed * 0.1,
      anomalyBurden: 2.5 + seed * 2,
      reviewProgress: 0.7 + seed * 0.2
    }
  }

  private async getBaselineKPIs(cohort: string[]): Promise<any> {
    return {
      completeness: 0.88,
      anomalyBurden: 3.2,
      reviewProgress: 0.75
    }
  }

  private async calculateImpact(
    scenario: ScenarioResult,
    kpis: any,
    diff?: any
  ): Promise<any> {
    return {
      affectedSuppliers: scenario.cohort.length,
      estimatedSavings: diff ? Math.abs(diff.anomalyBurden) * 10000 : 0,
      riskScore: kpis.anomalyBurden > 4 ? 0.8 : 0.3
    }
  }

  private createSnapshot(
    scenario: ScenarioResult,
    kpis: any,
    diff: any,
    impact: any
  ): string {
    const data = {
      scenario,
      kpis,
      diff,
      impact,
      timestamp: new Date().toISOString()
    }
    
    // Create immutable hash
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
  }

  private hashInput(data: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
  }
}