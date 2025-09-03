'use client'

import React, { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Link2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Insight {
  id: string
  title: string
  supplier: string
  severity?: 'low' | 'medium' | 'high'
  month?: string
}

interface InsightSearchProps {
  insights: Insight[]
  selectedInsightIds: string[]
  onInsightSelect: (insightId: string, checked: boolean) => void
  onSearchChange?: (query: string) => void
  className?: string
}

export function InsightSearch({
  insights,
  selectedInsightIds,
  onInsightSelect,
  onSearchChange,
  className
}: InsightSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const filteredInsights = useMemo(() => {
    const query = searchQuery.toLowerCase()
    if (!query) return insights
    
    return insights.filter(insight => 
      insight.id.toLowerCase().includes(query) ||
      insight.title.toLowerCase().includes(query) ||
      insight.supplier.toLowerCase().includes(query)
    )
  }, [insights, searchQuery])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    onSearchChange?.(value)
  }

  const handleInsightToggle = (insightId: string, checked: boolean) => {
    onInsightSelect(insightId, checked)
  }

  const clearSelection = () => {
    selectedInsightIds.forEach(id => {
      onInsightSelect(id, false)
    })
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'default'
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-2">
        <Label htmlFor="insight-search" className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Baserat på Insights
        </Label>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="insight-search"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Sök INS-ID (t.ex. INS-2024-11-001)"
            className="pl-9 pr-3"
            aria-label="Sök insights"
            onFocus={() => setIsExpanded(true)}
          />
        </div>
      </div>

      {/* Selected Insights */}
      {selectedInsightIds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedInsightIds.length} valda
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              aria-label="Rensa val"
            >
              <X className="h-3 w-3" />
              Rensa
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedInsightIds.map(id => {
              const insight = insights.find(i => i.id === id)
              if (!insight) return null
              return (
                <Badge
                  key={id}
                  variant={getSeverityColor(insight.severity)}
                  className="text-xs cursor-pointer"
                  onClick={() => handleInsightToggle(id, false)}
                >
                  {id}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* Search Results */}
      {(isExpanded || searchQuery) && (
        <div 
          className="max-h-48 overflow-y-auto space-y-1 p-2 border rounded-lg bg-background/50"
          role="listbox"
          aria-label="Insight resultat"
        >
          {filteredInsights.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Inga insights hittades
            </div>
          ) : (
            filteredInsights.map(insight => (
              <label
                key={insight.id}
                className={cn(
                  "flex items-start space-x-2 p-2 rounded cursor-pointer",
                  "hover:bg-muted/50 transition-colors"
                )}
              >
                <Checkbox
                  id={`insight-${insight.id}`}
                  checked={selectedInsightIds.includes(insight.id)}
                  onCheckedChange={(checked) => 
                    handleInsightToggle(insight.id, checked as boolean)
                  }
                  aria-label={`Välj ${insight.id}`}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">{insight.id}</span>
                    {insight.severity && (
                      <Badge 
                        variant={getSeverityColor(insight.severity)}
                        className="text-xs h-4"
                      >
                        {insight.severity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {insight.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{insight.supplier}</span>
                    {insight.month && (
                      <>
                        <span>•</span>
                        <span>{insight.month}</span>
                      </>
                    )}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}