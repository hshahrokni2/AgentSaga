'use client'

import React, { useState } from 'react'
import { SnapshotDialogProps } from './types/workflow-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield,
  Lock,
  CheckCircle,
  AlertTriangle,
  FileText,
  MessageCircle,
  Clock,
  Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function SnapshotDialog({
  checklistItems,
  findings,
  comments,
  supplierId,
  month,
  onConfirm,
  onCancel
}: SnapshotDialogProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const requiredItems = checklistItems.filter(item => item.required)
  const completedRequired = requiredItems.filter(item => item.completed)
  const allItemsComplete = completedRequired.length === requiredItems.length

  const criticalFindings = findings.filter(f => f.severity === 'critical' && f.status !== 'resolved')
  const unresolvedFindings = findings.filter(f => f.status === 'new')

  const handleConfirm = async () => {
    setIsCreating(true)
    
    try {
      // Simulate snapshot creation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Generate snapshot ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const snapshotId = `SNAP-${supplierId}-${month}-${timestamp.substring(0, 19)}`
      
      onConfirm(snapshotId)
    } catch (error) {
      console.error('Failed to create snapshot:', error)
      setIsCreating(false)
    }
  }

  const generateDataHash = () => {
    // Simplified hash generation for display
    const data = JSON.stringify({
      checklistItems: checklistItems.map(item => ({
        id: item.id,
        completed: item.completed,
        completedAt: item.completedAt
      })),
      findings: findings.map(f => ({ id: f.id, status: f.status })),
      comments: comments.map(c => ({ id: c.id, content: c.content }))
    })
    
    // Simple hash for display purposes (in real implementation, use crypto.subtle)
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && !isCreating && onCancel()}>
      <DialogContent className="max-w-2xl" data-testid="snapshot-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="text-blue-600" size={24} />
            Slutför granskning - Skapa ögonblicksbild
          </DialogTitle>
          <DialogDescription>
            Du håller på att slutföra granskningen för <strong>{supplierId}</strong> för månaden{' '}
            <strong>{month}</strong>. Detta skapar en låst, oföränderlig ögonblicksbild av alla data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="mx-auto mb-2 text-green-600" size={24} />
              <div className="font-semibold text-green-900">{completedRequired.length}</div>
              <div className="text-xs text-green-700">Slutförda punkter</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <FileText className="mx-auto mb-2 text-blue-600" size={24} />
              <div className="font-semibold text-blue-900">{findings.length}</div>
              <div className="text-xs text-blue-700">Totala fynd</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <MessageCircle className="mx-auto mb-2 text-purple-600" size={24} />
              <div className="font-semibold text-purple-900">{comments.length}</div>
              <div className="text-xs text-purple-700">Kommentarer</div>
            </div>
          </div>

          {/* Warnings */}
          <div className="space-y-3">
            {!allItemsComplete && (
              <Alert variant="destructive">
                <AlertTriangle size={16} />
                <AlertDescription>
                  <strong>Varning:</strong> {requiredItems.length - completedRequired.length} obligatoriska 
                  punkter är inte slutförda. Du kan inte slutföra granskningen utan att först 
                  slutföra alla obligatoriska punkter.
                </AlertDescription>
              </Alert>
            )}

            {criticalFindings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle size={16} />
                <AlertDescription>
                  <strong>Kritiska fynd:</strong> {criticalFindings.length} kritiska fynd är ännu inte lösta. 
                  Överväg att lösa dessa innan du slutför granskningen.
                </AlertDescription>
              </Alert>
            )}

            {unresolvedFindings.length > 0 && (
              <Alert>
                <AlertTriangle size={16} />
                <AlertDescription>
                  <strong>Olösta fynd:</strong> {unresolvedFindings.length} fynd har status "Ny" och 
                  har inte triagerats ännu.
                </AlertDescription>
              </Alert>
            )}

            {comments.length === 0 && (
              <Alert>
                <MessageCircle size={16} />
                <AlertDescription>
                  <strong>Inga kommentarer:</strong> Inga kommentarer har lagts till. Överväg att 
                  lägga till en sammanfattande kommentar före slutförande.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Snapshot Details */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <Lock size={16} />
                Ögonblicksbild information
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs"
              >
                {showDetails ? 'Dölj detaljer' : 'Visa detaljer'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Leverantör:</div>
                <div className="font-medium">{supplierId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Månad:</div>
                <div className="font-medium">{month}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Tidsstämpel:</div>
                <div className="font-medium flex items-center gap-1">
                  <Clock size={14} />
                  {new Date().toLocaleString('sv-SE')}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Data hash:</div>
                <div className="font-medium font-mono text-xs flex items-center gap-1">
                  <Hash size={14} />
                  {generateDataHash()}
                </div>
              </div>
            </div>

            {showDetails && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium mb-1">Checklist-punkter ({checklistItems.length}):</div>
                    <div className="text-muted-foreground">
                      {completedRequired.length}/{requiredItems.length} obligatoriska slutförda
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium mb-1">Fynd ({findings.length}):</div>
                    <div className="flex gap-2 flex-wrap">
                      {['critical', 'high', 'medium', 'low', 'info'].map(severity => {
                        const count = findings.filter(f => f.severity === severity).length
                        if (count === 0) return null
                        
                        return (
                          <Badge
                            key={severity}
                            variant="outline"
                            className={cn(
                              "text-xs",
                              severity === 'critical' && "border-red-300 text-red-700",
                              severity === 'high' && "border-orange-300 text-orange-700",
                              severity === 'medium' && "border-yellow-300 text-yellow-700",
                              severity === 'low' && "border-blue-300 text-blue-700",
                              severity === 'info' && "border-gray-300 text-gray-700"
                            )}
                          >
                            {count} {severity}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium mb-1">Kommentarer:</div>
                    <div className="text-muted-foreground">
                      {comments.length} kommentarer från {new Set(comments.map(c => c.author)).size} användare
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Immutability Warning */}
          <Alert>
            <Shield size={16} />
            <AlertDescription>
              <strong>Viktigt:</strong> När ögonblicksbilden är skapad kan den inte ändras eller tas bort. 
              Alla data blir låsta och oföränderliga för regulatorisk efterlevnad och revisionsspår.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isCreating}
            data-testid="cancel-snapshot-button"
          >
            Avbryt
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allItemsComplete || isCreating}
            className="bg-green-600 hover:bg-green-700"
            data-testid="confirm-snapshot-button"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Skapar ögonblicksbild...
              </>
            ) : (
              <>
                <Shield size={16} className="mr-2" />
                Skapa ögonblicksbild och slutför
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}