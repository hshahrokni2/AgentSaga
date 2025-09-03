'use client'

import React from 'react'
import { ChecklistPanelProps, ChecklistItem, ChecklistCategory } from './types/workflow-types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChecklistPanel({
  items,
  progress,
  onItemToggle,
  currentState,
  isTransitioning
}: ChecklistPanelProps) {
  
  const getCategoryIcon = (category: ChecklistCategory) => {
    const iconProps = { size: 16, className: "text-muted-foreground" }
    
    switch (category) {
      case 'data-quality':
        return <CheckCircle {...iconProps} />
      case 'anomalies':
        return <AlertCircle {...iconProps} />
      case 'quality':
        return <CheckCircle {...iconProps} />
      case 'compliance':
        return <Circle {...iconProps} />
      case 'review':
        return <Clock {...iconProps} />
      default:
        return <Circle {...iconProps} />
    }
  }

  const getCategoryLabel = (category: ChecklistCategory): string => {
    const labels = {
      'data-quality': 'Datakvalitet',
      'anomalies': 'Anomalier',
      'quality': 'Kvalitet',
      'compliance': 'Regelefterlevnad',
      'review': 'Granskning'
    }
    return labels[category] || category
  }

  const getCategoryColor = (category: ChecklistCategory): string => {
    const colors = {
      'data-quality': 'bg-blue-100 text-blue-800',
      'anomalies': 'bg-red-100 text-red-800',
      'quality': 'bg-green-100 text-green-800',
      'compliance': 'bg-purple-100 text-purple-800',
      'review': 'bg-orange-100 text-orange-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  const groupedItems = items.reduce((groups, item) => {
    const category = item.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(item)
    return groups
  }, {} as Record<ChecklistCategory, ChecklistItem[]>)

  const isReadOnly = currentState === 'fully_reviewed' || isTransitioning

  return (
    <GlassCard 
      className="checklist-panel p-6" 
      data-testid="checklist-panel"
      role="complementary"
      aria-label="Granskning checklista"
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Granskningschecklista</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Framsteg</span>
              <span>{progress.completed} av {progress.total} obligatoriska</span>
            </div>
            <Progress 
              value={progress.percentage} 
              className="h-2"
              data-testid="checklist-progress"
            />
            <div className="text-xs text-muted-foreground">
              {progress.percentage === 100 ? (
                <span className="text-green-600 font-medium">✓ Alla obligatoriska punkter slutförda</span>
              ) : (
                <span>{Math.round(progress.percentage)}% slutfört</span>
              )}
            </div>
          </div>
        </div>

        {/* Checklist Items by Category */}
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="checklist-category">
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-3">
                {getCategoryIcon(category as ChecklistCategory)}
                <h3 className="font-medium text-sm">
                  {getCategoryLabel(category as ChecklistCategory)}
                </h3>
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs", getCategoryColor(category as ChecklistCategory))}
                >
                  {categoryItems.filter(item => item.completed).length}/{categoryItems.length}
                </Badge>
              </div>

              {/* Category Items */}
              <div className="space-y-2 ml-6">
                {categoryItems.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    onToggle={onItemToggle}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Status Summary */}
        <div className="pt-4 border-t border-border/50">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">
                {getStateDisplayName(currentState)}
              </span>
            </div>
            
            {currentState === 'in_progress' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Klar för slutförande:</span>
                <span className={cn(
                  "font-medium",
                  progress.percentage === 100 ? "text-green-600" : "text-orange-600"
                )}>
                  {progress.percentage === 100 ? "Ja" : "Nej"}
                </span>
              </div>
            )}

            {currentState === 'fully_reviewed' && (
              <div className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded">
                ✓ Granskning slutförd och låst
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {currentState !== 'fully_reviewed' && (
          <div className="pt-4 border-t border-border/50">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
              disabled={isTransitioning}
            >
              Uppdatera status
            </Button>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

interface ChecklistItemRowProps {
  item: ChecklistItem
  onToggle: (itemId: string, completed: boolean) => void
  isReadOnly: boolean
}

function ChecklistItemRow({ item, onToggle, isReadOnly }: ChecklistItemRowProps) {
  const handleToggle = () => {
    if (!isReadOnly) {
      onToggle(item.id, !item.completed)
    }
  }

  return (
    <div 
      className={cn(
        "checklist-item group rounded-lg p-3 border border-border/50 transition-all",
        item.completed && "bg-green-50/50 border-green-200",
        !isReadOnly && "hover:bg-accent/50 cursor-pointer"
      )}
      data-testid={`checklist-item-${item.id}`}
      onClick={handleToggle}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Checkbox
            checked={item.completed}
            disabled={isReadOnly}
            className={cn(
              item.completed && "border-green-500 bg-green-500"
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              "text-sm font-medium",
              item.completed && "line-through text-muted-foreground"
            )}>
              {item.title}
            </h4>
            
            {item.required && (
              <Badge variant="destructive" className="text-xs px-1 py-0">
                Obligatorisk
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.description}
          </p>

          {item.completed && item.completedAt && (
            <div className="mt-2 text-xs text-green-600">
              ✓ Slutförd {new Date(item.completedAt).toLocaleString('sv-SE')}
              {item.completedBy && (
                <span className="ml-1">av {item.completedBy}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getStateDisplayName(state: string): string {
  const stateNames = {
    unreviewed: 'Ej granskad',
    in_progress: 'Pågående',
    fully_reviewed: 'Slutförd'
  }
  return stateNames[state as keyof typeof stateNames] || state
}