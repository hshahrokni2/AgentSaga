'use client'

import React, { useState, useEffect } from 'react'
import { ChecklistPanel } from './checklist-panel'
import { FindingsTable } from './findings-table'
import { CommentDrawer } from './comment-drawer'
import { SnapshotDialog } from './snapshot-dialog'
import { useGranskadState } from './hooks/use-granskad-state'
import { useAuditLogger } from './hooks/use-audit-logger'
import { GranskadState, ChecklistItem, FindingItem, Comment } from './types/workflow-types'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GlassCard } from '@/components/ui/glass-card'

interface GranskadWorkflowProps {
  supplierId: string
  month: string
  initialState?: GranskadState
  onStateChange?: (state: GranskadState) => void
  onComplete?: (snapshotId: string) => void
}

export function GranskadWorkflow({
  supplierId,
  month,
  initialState = 'unreviewed',
  onStateChange,
  onComplete
}: GranskadWorkflowProps) {
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false)
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [findings, setFindings] = useState<FindingItem[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const {
    currentState,
    canTransitionTo,
    transitionTo,
    isTransitioning
  } = useGranskadState(initialState, supplierId, month)

  const { logAuditEvent } = useAuditLogger()

  // Load initial data
  useEffect(() => {
    loadWorkflowData()
  }, [supplierId, month])

  const loadWorkflowData = async () => {
    try {
      setIsLoading(true)
      
      // Mock data loading - replace with actual API calls
      const mockChecklistItems: ChecklistItem[] = [
        {
          id: 'completeness-check',
          title: 'Kontrollera datatäckning',
          description: 'Verifiera att alla leverantörer har rapporterat för månaden',
          category: 'data-quality',
          required: true,
          completed: false,
          completedAt: null,
          completedBy: null
        },
        {
          id: 'anomaly-review',
          title: 'Granska anomalier',
          description: 'Kontrollera alla flaggade avvikelser och förklaringar',
          category: 'anomalies',
          required: true,
          completed: false,
          completedAt: null,
          completedBy: null
        },
        {
          id: 'quality-validation',
          title: 'Validera datakvalitet',
          description: 'Säkerställ att data möter kvalitetskrav',
          category: 'quality',
          required: true,
          completed: false,
          completedAt: null,
          completedBy: null
        },
        {
          id: 'compliance-check',
          title: 'Kontrollera regelefterlevnad',
          description: 'Verifiera att alla regler följs korrekt',
          category: 'compliance',
          required: false,
          completed: false,
          completedAt: null,
          completedBy: null
        }
      ]

      const mockFindings: FindingItem[] = [
        {
          id: 'F-2024-11-001',
          title: 'Ovanligt hög viktökning',
          description: 'Leverantör ABC har rapporterat 150% ökning jämfört med föregående månad',
          severity: 'critical',
          status: 'new',
          source: 'rule',
          supplierId: 'ABC-001',
          supplierName: 'ABC Avfallshantering',
          assignee: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'F-2024-11-002',
          title: 'Saknad viktangivelse',
          description: 'Flera rader saknar viktdata för återvinningsbart material',
          severity: 'medium',
          status: 'triaged',
          source: 'validation',
          supplierId: 'DEF-002',
          supplierName: 'DEF Återvinning',
          assignee: 'analyst@example.com',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      setChecklistItems(mockChecklistItems)
      setFindings(mockFindings)
      setComments([])

    } catch (err) {
      setError('Kunde inte ladda data för granskningen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChecklistItemToggle = async (itemId: string, completed: boolean) => {
    try {
      const updatedItems = checklistItems.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            completed,
            completedAt: completed ? new Date() : null,
            completedBy: completed ? 'current-user@example.com' : null
          }
        }
        return item
      })
      
      setChecklistItems(updatedItems)
      
      await logAuditEvent({
        action: completed ? 'checklist_item_completed' : 'checklist_item_uncompleted',
        itemId,
        supplierId,
        month,
        details: `Checklist item "${itemId}" ${completed ? 'completed' : 'uncompleted'}`
      })

    } catch (err) {
      setError('Kunde inte uppdatera checklist-punkt')
    }
  }

  const handleFindingUpdate = async (findingId: string, updates: Partial<FindingItem>) => {
    try {
      const updatedFindings = findings.map(finding => {
        if (finding.id === findingId) {
          return { ...finding, ...updates, updatedAt: new Date() }
        }
        return finding
      })
      
      setFindings(updatedFindings)
      
      await logAuditEvent({
        action: 'finding_updated',
        findingId,
        supplierId,
        month,
        details: `Finding "${findingId}" updated`,
        metadata: updates
      })

    } catch (err) {
      setError('Kunde inte uppdatera finding')
    }
  }

  const handleCommentAdd = async (content: string, findingIds?: string[]) => {
    try {
      const newComment: Comment = {
        id: `C-${Date.now()}`,
        content,
        author: 'current-user@example.com',
        authorName: 'Aktuell Användare',
        createdAt: new Date(),
        updatedAt: new Date(),
        findingIds: findingIds || [],
        metadata: {}
      }
      
      setComments([...comments, newComment])
      
      await logAuditEvent({
        action: 'comment_added',
        commentId: newComment.id,
        supplierId,
        month,
        details: `Comment added${findingIds?.length ? ` for findings: ${findingIds.join(', ')}` : ''}`,
        metadata: { findingIds }
      })

    } catch (err) {
      setError('Kunde inte lägga till kommentar')
    }
  }

  const handleStateTransition = async (targetState: GranskadState) => {
    try {
      if (!canTransitionTo(targetState)) {
        setError(`Ogiltig övergång från ${currentState} till ${targetState}`)
        return
      }

      if (targetState === 'fully_reviewed') {
        // Check prerequisites before showing snapshot dialog
        const requiredItems = checklistItems.filter(item => item.required)
        const completedRequired = requiredItems.filter(item => item.completed)
        
        if (completedRequired.length < requiredItems.length) {
          setError('Alla obligatoriska checklist-punkter måste vara slutförda innan granskningen kan markeras som klar')
          return
        }

        if (comments.length === 0) {
          setError('Minst en kommentar krävs innan granskningen kan slutföras')
          return
        }

        // Show snapshot confirmation dialog
        setShowSnapshotDialog(true)
        return
      }

      await transitionTo(targetState)
      onStateChange?.(targetState)

    } catch (err) {
      setError('Kunde inte ändra status')
    }
  }

  const handleSnapshotConfirm = async (snapshotId: string) => {
    try {
      await transitionTo('fully_reviewed')
      setShowSnapshotDialog(false)
      onStateChange?.('fully_reviewed')
      onComplete?.(snapshotId)

      await logAuditEvent({
        action: 'workflow_completed',
        snapshotId,
        supplierId,
        month,
        details: `Granskad workflow completed with snapshot ${snapshotId}`
      })

    } catch (err) {
      setError('Kunde inte slutföra granskningen')
    }
  }

  const getChecklistProgress = () => {
    const requiredItems = checklistItems.filter(item => item.required)
    const completedRequired = requiredItems.filter(item => item.completed)
    return {
      completed: completedRequired.length,
      total: requiredItems.length,
      percentage: requiredItems.length > 0 ? (completedRequired.length / requiredItems.length) * 100 : 0
    }
  }

  const canMarkAsReviewed = () => {
    const progress = getChecklistProgress()
    return progress.percentage === 100 && comments.length > 0 && currentState === 'in_progress'
  }

  if (isLoading) {
    return (
      <GlassCard className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3">Laddar granskning...</span>
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="granskad-workflow h-full" data-testid="granskad-workflow">
      {error && (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex h-full gap-6">
        {/* Checklist Panel - Sticky */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-6">
            <ChecklistPanel
              items={checklistItems}
              progress={getChecklistProgress()}
              onItemToggle={handleChecklistItemToggle}
              currentState={currentState}
              isTransitioning={isTransitioning}
            />
          </div>
        </div>

        {/* Main Content - Findings Table */}
        <div className="flex-1 min-w-0">
          <FindingsTable
            findings={findings}
            selectedIds={selectedFindingIds}
            onSelectionChange={setSelectedFindingIds}
            onFindingUpdate={handleFindingUpdate}
            currentState={currentState}
          />
        </div>

        {/* Comment Drawer - Right Panel */}
        <div className="w-96 flex-shrink-0">
          <CommentDrawer
            comments={comments}
            findings={findings}
            selectedFindingIds={selectedFindingIds}
            onCommentAdd={handleCommentAdd}
            currentState={currentState}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-6 p-4 bg-background/50 backdrop-blur-sm rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Status: <span className="font-medium">{getStateDisplayName(currentState)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Framsteg: {getChecklistProgress().completed}/{getChecklistProgress().total} obligatoriska punkter
            </span>
          </div>

          <div className="flex gap-2">
            {currentState === 'unreviewed' && (
              <Button
                onClick={() => handleStateTransition('in_progress')}
                disabled={isTransitioning}
              >
                Påbörja granskning
              </Button>
            )}

            {currentState === 'in_progress' && (
              <Button
                onClick={() => handleStateTransition('fully_reviewed')}
                disabled={!canMarkAsReviewed() || isTransitioning}
                className="bg-green-600 hover:bg-green-700"
              >
                Markera som granskad
              </Button>
            )}

            {currentState === 'fully_reviewed' && (
              <div className="text-sm text-green-600 font-medium">
                ✓ Granskning slutförd
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Snapshot Confirmation Dialog */}
      {showSnapshotDialog && (
        <SnapshotDialog
          checklistItems={checklistItems}
          findings={findings}
          comments={comments}
          supplierId={supplierId}
          month={month}
          onConfirm={handleSnapshotConfirm}
          onCancel={() => setShowSnapshotDialog(false)}
        />
      )}
    </div>
  )
}

function getStateDisplayName(state: GranskadState): string {
  const stateNames = {
    unreviewed: 'Ej granskad',
    in_progress: 'Pågår',
    fully_reviewed: 'Granskad'
  }
  return stateNames[state] || state
}