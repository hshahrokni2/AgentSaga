// Type definitions for Findings
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'
export type FindingStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed'
export type ViewMode = 'rule' | 'cluster' | 'supplier'

export interface LocalizedString {
  sv: string
  en: string
}

export interface FindingData {
  id: string
  ruleId: string
  ruleName: LocalizedString
  clusterId: string
  clusterName: string
  severity: FindingSeverity
  status: FindingStatus
  confidence: number
  description: string
  evidence: {
    transactionId?: string
    transactionIds?: string[]
    amount?: number
    totalAmount?: number
    date?: string
    dates?: string[]
    supplier?: string
    threshold?: number
    contractId?: string
    violation?: string
  }
  metadata: {
    createdAt: string
    updatedAt: string
    source: string
    tags: string[]
  }
}

export interface RuleData {
  id: string
  name: string
  description: string
  severity: FindingSeverity
  category: string
  findingsCount: number
  enabled: boolean
}

export interface ClusterData {
  id: string
  name: string
  description: string
  severity: FindingSeverity
  findingsCount: number
  commonPatterns: string[]
}

export interface FindingsApiResponse {
  data: FindingData[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface BatchActionRequest {
  findingIds: string[]
  action: string
  status?: FindingStatus
  metadata?: Record<string, any>
}

export interface ExplanationData {
  findingId: string
  explanation: string
  confidence: number
  suggestedActions: string[]
}