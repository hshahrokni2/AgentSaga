export interface Supplier {
  id: string
  name: string
  region: string
}

export interface Insight {
  id: string
  title: string
  supplier: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  status?: 'new' | 'triaged' | 'explained' | 'resolved'
  source?: 'rule' | 'ml' | 'human' | 'whatif'
}

export interface ScenarioConfig {
  suppliers: string[]
  monthRange: string
  parameters: {
    weightThreshold: number
    reportingThreshold: number
    startTime: string
    endTime: string
  }
  insights: string[]
}

export interface ScenarioKPI {
  current: number
  baseline: number
  change: number
  unit?: string
  description?: string
}

export interface ScenarioResult {
  id?: string
  name?: string
  createdAt?: Date
  kpis: {
    completeness: ScenarioKPI
    anomalies: ScenarioKPI
    reviewProgress: ScenarioKPI
    [key: string]: ScenarioKPI
  }
  flagChanges: {
    supplier: string
    supplierName?: string
    added: number
    removed: number
    changed: number
    details?: {
      addedFlags: string[]
      removedFlags: string[]
      changedFlags: { from: string; to: string }[]
    }
  }[]
  heatmapData: {
    supplier: string
    supplierName?: string
    status: 'green' | 'orange' | 'red'
    value: number
    trend?: 'up' | 'down' | 'stable'
    details?: {
      completeness: number
      anomalies: number
      reviewProgress: number
    }
  }[]
  metadata?: {
    executionTime: number
    dataPointsAnalyzed: number
    rulesApplied: string[]
  }
}

export interface ScenarioSnapshot {
  id: string
  name: string
  description?: string
  config: ScenarioConfig
  results: ScenarioResult
  notes: string
  createdAt: Date
  createdBy: string
  tags?: string[]
}

export interface ScenarioValidationError {
  field: string
  message: string
  code: string
}