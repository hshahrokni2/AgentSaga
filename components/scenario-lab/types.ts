// Scenario Lab Types

export interface Supplier {
  id: string
  name: string
  region: string
  type?: 'municipal' | 'commercial'
  capacity?: number
}

export interface Insight {
  id: string
  title: string
  description?: string
  supplier: string
  severity?: 'low' | 'medium' | 'high'
  month?: string
  status?: 'active' | 'resolved' | 'pending'
  relatedInsights?: string[]
}

export interface ScenarioParameters {
  weightThreshold: number
  reportingThreshold: number
  startHour: number
  endHour: number
  seasonalAdjustment: boolean
  excludeHolidays: boolean
  confidenceLevel?: number
  maxAnomalies?: number
}

export interface ScenarioConfig {
  suppliers: string[]
  monthRange: {
    start: string
    end: string
  }
  parameters: ScenarioParameters
  insightIds: string[]
  notes?: string
  createdAt?: string
  modifiedAt?: string
}

export interface KPIChange {
  current: number
  baseline: number
  change: number
  percentageChange?: number
  trend?: 'up' | 'down' | 'stable'
}

export interface FlagChange {
  supplier: string
  supplierId?: string
  added: number
  removed: number
  changed: number
  total?: number
}

export interface HeatmapCell {
  supplier: string
  supplierId?: string
  status: 'green' | 'orange' | 'red'
  value: number
  details?: {
    anomalies?: number
    completeness?: number
    reportingGap?: number
  }
}

export interface ScenarioResult {
  id?: string
  configHash?: string
  executionTime?: number
  timestamp?: string
  kpis: {
    completeness: KPIChange
    anomalies: KPIChange
    reviewProgress: KPIChange
    dataQuality?: KPIChange
  }
  flagChanges: FlagChange[]
  heatmapData: HeatmapCell[]
  metadata?: {
    totalSuppliers?: number
    totalMonths?: number
    totalDataPoints?: number
    cloudProvider?: string
  }
}

export interface ScenarioSnapshot {
  id: string
  name: string
  config: ScenarioConfig
  result: ScenarioResult
  createdAt: string
  createdBy?: string
  tags?: string[]
  linkedInsights?: string[]
}

export interface ScenarioLabProps {
  suppliers: Supplier[]
  insights: Insight[]
  onRun: (config: ScenarioConfig) => Promise<ScenarioResult>
  onSave?: (snapshot: ScenarioSnapshot) => Promise<void>
  onCreateInsight?: (data: {
    title: string
    description: string
    supplierId: string
    scenarioId?: string
  }) => Promise<Insight>
  initialConfig?: Partial<ScenarioConfig>
  readOnly?: boolean
}

export interface ScenarioLabState {
  config: ScenarioConfig
  result: ScenarioResult | null
  isRunning: boolean
  isSaving: boolean
  progress: number
  error: string | null
  validationErrors: Record<string, string>
  snapshots: ScenarioSnapshot[]
}