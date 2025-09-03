export type GranskadState = 'unreviewed' | 'in_progress' | 'fully_reviewed'

export type ChecklistCategory = 'data-quality' | 'anomalies' | 'quality' | 'compliance' | 'review'

export interface ChecklistItem {
  id: string
  title: string
  description: string
  category: ChecklistCategory
  required: boolean
  completed: boolean
  completedAt: Date | null
  completedBy: string | null
  metadata?: Record<string, any>
}

export interface ChecklistProgress {
  completed: number
  total: number
  percentage: number
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type FindingStatus = 'new' | 'triaged' | 'explained' | 'false_positive' | 'resolved'
export type FindingSource = 'rule' | 'ml' | 'human' | 'whatif' | 'validation'

export interface FindingItem {
  id: string
  title: string
  description: string
  severity: FindingSeverity
  status: FindingStatus
  source: FindingSource
  supplierId: string
  supplierName: string
  assignee: string | null
  createdAt: Date
  updatedAt: Date
  evidenceLinks?: string[]
  metadata?: Record<string, any>
}

export interface Comment {
  id: string
  content: string
  author: string
  authorName: string
  createdAt: Date
  updatedAt: Date
  findingIds: string[]
  metadata: Record<string, any>
}

export interface AuditEvent {
  id?: string
  action: string
  timestamp?: Date
  userId?: string
  supplierId: string
  month: string
  details: string
  metadata?: Record<string, any>
  itemId?: string
  findingId?: string
  commentId?: string
  snapshotId?: string
}

export interface WorkflowSnapshot {
  id: string
  supplierId: string
  month: string
  timestamp: Date
  checklistItems: ChecklistItem[]
  findings: FindingItem[]
  comments: Comment[]
  state: GranskadState
  hash: string
  immutable: boolean
  createdBy: string
}

export interface GranskadWorkflowState {
  currentState: GranskadState
  canTransitionTo: (targetState: GranskadState) => boolean
  transitionTo: (targetState: GranskadState) => Promise<void>
  isTransitioning: boolean
  history: StateTransition[]
}

export interface StateTransition {
  id: string
  fromState: GranskadState
  toState: GranskadState
  timestamp: Date
  userId: string
  reason?: string
  metadata?: Record<string, any>
}

export interface ClearanceStatus {
  status: 'green' | 'orange' | 'red'
  score: number
  blockers: string[]
  lastUpdated: Date
}

export interface WorkflowConfig {
  requiredChecklistItems: string[]
  requireCommentForCompletion: boolean
  allowSkipValidation: boolean
  autoSaveInterval: number
  sessionTimeout: number
}

// Swedish localization types
export interface SwedishLabels {
  states: {
    [key in GranskadState]: string
  }
  severities: {
    [key in FindingSeverity]: string
  }
  statuses: {
    [key in FindingStatus]: string
  }
  categories: {
    [key in ChecklistCategory]: string
  }
}

// Component prop types
export interface ChecklistPanelProps {
  items: ChecklistItem[]
  progress: ChecklistProgress
  onItemToggle: (itemId: string, completed: boolean) => void
  currentState: GranskadState
  isTransitioning: boolean
}

export interface FindingsTableProps {
  findings: FindingItem[]
  selectedIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
  onFindingUpdate: (findingId: string, updates: Partial<FindingItem>) => void
  currentState: GranskadState
}

export interface CommentDrawerProps {
  comments: Comment[]
  findings: FindingItem[]
  selectedFindingIds: string[]
  onCommentAdd: (content: string, findingIds?: string[]) => void
  currentState: GranskadState
}

export interface SnapshotDialogProps {
  checklistItems: ChecklistItem[]
  findings: FindingItem[]
  comments: Comment[]
  supplierId: string
  month: string
  onConfirm: (snapshotId: string) => void
  onCancel: () => void
}

// Hook return types
export interface UseGranskadStateReturn {
  currentState: GranskadState
  canTransitionTo: (targetState: GranskadState) => boolean
  transitionTo: (targetState: GranskadState) => Promise<void>
  isTransitioning: boolean
  history: StateTransition[]
  clearanceStatus: ClearanceStatus | null
}

export interface UseAuditLoggerReturn {
  logAuditEvent: (event: AuditEvent) => Promise<void>
  getAuditTrail: (supplierId: string, month: string) => Promise<AuditEvent[]>
  exportAuditTrail: (supplierId: string, month: string, format: 'json' | 'csv') => Promise<string>
}

// API response types
export interface WorkflowApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
}

export interface WorkflowValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface SnapshotValidationResult extends WorkflowValidationResult {
  hash: string
  checksum: string
}