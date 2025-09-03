'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { ConfidenceChip } from './confidence-chip'

export interface InsightData {
  id: string // Format: INS-YYYY-MM-NNN
  title: string
  summary: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'new' | 'reviewing' | 'validated' | 'resolved' | 'false_positive'
  confidence: number
  source: 'rule' | 'ml' | 'human' | 'scenario'
  createdAt: Date
  supplier?: string
  evidenceCount?: number
  affectedRows?: number
}

export interface InsightCardProps {
  insight: InsightData
  className?: string
  interactive?: boolean
  showEvidence?: boolean
  showActions?: boolean
  onInsightClick?: (insight: InsightData) => void
  onActionClick?: (action: string, insight: InsightData) => void
  locale?: 'sv' | 'en'
}

// Swedish translations for insight properties
const getSeverityText = (severity: string, locale: 'sv' | 'en'): string => {
  const translations = {
    critical: { sv: 'Kritisk', en: 'Critical' },
    high: { sv: 'Hög', en: 'High' },
    medium: { sv: 'Medel', en: 'Medium' },
    low: { sv: 'Låg', en: 'Low' },
    info: { sv: 'Info', en: 'Info' },
  }
  return translations[severity as keyof typeof translations]?.[locale] || severity
}

const getStatusText = (status: string, locale: 'sv' | 'en'): string => {
  const translations = {
    new: { sv: 'Ny', en: 'New' },
    reviewing: { sv: 'Granskas', en: 'Reviewing' },
    validated: { sv: 'Validerad', en: 'Validated' },
    resolved: { sv: 'Löst', en: 'Resolved' },
    false_positive: { sv: 'Falskt larm', en: 'False Positive' },
  }
  return translations[status as keyof typeof translations]?.[locale] || status
}

const getSourceText = (source: string, locale: 'sv' | 'en'): string => {
  const translations = {
    rule: { sv: 'Regel', en: 'Rule' },
    ml: { sv: 'ML', en: 'ML' },
    human: { sv: 'Manuell', en: 'Manual' },
    scenario: { sv: 'Scenario', en: 'Scenario' },
  }
  return translations[source as keyof typeof translations]?.[locale] || source
}

// Severity colors with WCAG AAA compliance
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'text-clearance-red border-clearance-red/20 bg-clearance-red/10'
    case 'high': return 'text-clearance-orange border-clearance-orange/20 bg-clearance-orange/10'
    case 'medium': return 'text-yellow-600 border-yellow-200 bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:bg-yellow-900/20'
    case 'low': return 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-900/20'
    case 'info': return 'text-muted-foreground border-border bg-muted/50'
    default: return 'text-muted-foreground border-border bg-muted/50'
  }
}

const InsightCard = React.forwardRef<HTMLDivElement, InsightCardProps>(
  ({
    insight,
    className,
    interactive = true,
    showEvidence = true,
    showActions = true,
    onInsightClick,
    onActionClick,
    locale = 'sv',
    ...props
  }, ref) => {
    const handleCardClick = () => {
      if (interactive && onInsightClick) {
        onInsightClick(insight)
      }
    }

    const handleActionClick = (action: string, e: React.MouseEvent) => {
      e.stopPropagation() // Prevent card click
      if (onActionClick) {
        onActionClick(action, insight)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleCardClick()
      }
    }

    const formattedDate = insight.createdAt.toLocaleDateString(locale === 'sv' ? 'sv-SE' : 'en-US', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
    })

    return (
      <GlassCard
        ref={ref}
        className={cn('insight-card group', className)}
        interactive={interactive}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        aria-label={`${locale === 'sv' ? 'Insikt' : 'Insight'} ${insight.id}: ${insight.title}`}
        data-testid="insight-card"
        {...props}
      >
        {/* Header with ID and severity */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground" data-testid="insight-id">
              {insight.id}
            </span>
            <div className={cn('px-2 py-1 rounded text-xs font-medium border', getSeverityColor(insight.severity))}>
              {getSeverityText(insight.severity, locale)}
            </div>
          </div>
          <ConfidenceChip
            confidence={insight.confidence}
            showIcon
            size="sm"
            interactive={interactive}
            onConfidenceClick={() => handleActionClick('view-confidence', {} as React.MouseEvent)}
          />
        </div>

        {/* Title and summary */}
        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-2 swedish-text group-hover:text-primary transition-colors">
            {insight.title}
          </h3>
          <p className="text-sm text-muted-foreground swedish-text line-clamp-3">
            {insight.summary}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-current opacity-50" />
            <span className="swedish-text">{getSourceText(insight.source, locale)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-current opacity-50" />
            <span className="swedish-text">{getStatusText(insight.status, locale)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-current opacity-50" />
            <time dateTime={insight.createdAt.toISOString()}>
              {formattedDate}
            </time>
          </div>
        </div>

        {/* Evidence and supplier info */}
        {showEvidence && (insight.evidenceCount || insight.supplier) && (
          <div className="flex items-center justify-between mb-4 text-sm">
            {insight.supplier && (
              <div className="text-muted-foreground">
                <span className="swedish-text">
                  {locale === 'sv' ? 'Leverantör' : 'Supplier'}: {insight.supplier}
                </span>
              </div>
            )}
            {insight.evidenceCount && (
              <div className="text-muted-foreground">
                <span className="swedish-text">
                  {insight.evidenceCount} {locale === 'sv' ? 'bevis' : 'evidence'}
                  {insight.affectedRows && `, ${insight.affectedRows} ${locale === 'sv' ? 'rader' : 'rows'}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && interactive && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="px-3 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded touch-target transition-colors"
              onClick={(e) => handleActionClick('explain', e)}
              aria-label={`${locale === 'sv' ? 'Förklara insikt' : 'Explain insight'} ${insight.id}`}
            >
              {locale === 'sv' ? 'Förklara' : 'Explain'}
            </button>
            <button
              className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded touch-target transition-colors"
              onClick={(e) => handleActionClick('create-scenario', e)}
              aria-label={`${locale === 'sv' ? 'Skapa scenario för' : 'Create scenario for'} ${insight.id}`}
            >
              {locale === 'sv' ? 'Scenario' : 'Scenario'}
            </button>
            <button
              className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded touch-target transition-colors"
              onClick={(e) => handleActionClick('copy-id', e)}
              aria-label={`${locale === 'sv' ? 'Kopiera ID' : 'Copy ID'} ${insight.id}`}
            >
              {locale === 'sv' ? 'Kopiera ID' : 'Copy ID'}
            </button>
          </div>
        )}
      </GlassCard>
    )
  }
)

InsightCard.displayName = 'InsightCard'

export { InsightCard }