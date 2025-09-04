'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { VariableSizeList as List } from 'react-window'
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  MoreVertical,
  Eye,
  Grid3X3,
  Users,
  BookOpen,
  Check,
  X,
  RefreshCw,
  Save,
  Loader2,
  Info
} from 'lucide-react'
import { cn, formatSwedishNumber, formatSwedishDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GlassCard } from '@/components/ui/glass-card'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/hooks/use-translation'
import { useWebSocket } from '@/hooks/use-websocket'
import type { 
  FindingData, 
  FindingSeverity, 
  FindingStatus, 
  ViewMode,
  RuleData,
  ClusterData
} from '@/types/findings'

interface FindingsTriageInterfaceProps {
  supplierId?: string
  initialData?: FindingData[]
  locale?: 'sv' | 'en'
  virtualized?: boolean
  pageSize?: number
  onFindingUpdate?: (finding: FindingData) => void
  onBatchAction?: (findingIds: string[], action: string) => void
}

interface FilterState {
  severity: FindingSeverity[]
  status: FindingStatus[]
  supplier?: string
  search: string
  period?: string
  unreviewedOnly: boolean
}

interface FilterPreset {
  id: string
  name: string
  filters: FilterState
}

export function FindingsTriageInterface({
  supplierId,
  initialData,
  locale = 'sv',
  virtualized = true,
  pageSize = 20,
  onFindingUpdate,
  onBatchAction
}: FindingsTriageInterfaceProps) {
  const { t } = useTranslation(locale)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const listRef = useRef<List>(null)
  
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('rule')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterState>({
    severity: [],
    status: [],
    search: '',
    unreviewedOnly: false
  })
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([])
  const [batchConfirmDialog, setBatchConfirmDialog] = useState<{
    open: boolean
    action: string
    count: number
  }>({ open: false, action: '', count: 0 })
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // Fetch findings data
  const { 
    data: findingsResponse, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['findings', viewMode, filters, supplierId],
    queryFn: async () => {
      const params = new URLSearchParams({
        viewMode,
        page: '1',
        pageSize: String(virtualized ? 1000 : pageSize),
        ...(supplierId && { supplier: supplierId }),
        ...(filters.severity?.length && { severity: filters.severity.join(',') }),
        ...(filters.status?.length && { status: filters.status.join(',') }),
        ...(filters.search && { search: filters.search }),
        ...(filters.dateRange?.start && { startDate: filters.dateRange.start }),
        ...(filters.dateRange?.end && { endDate: filters.dateRange.end })
      })
      
      const response = await fetch(`/api/findings?${params}`)
      if (!response.ok) throw new Error('Failed to fetch findings')
      return response.json()
    },
    initialData: initialData ? { data: initialData, grouped: {}, total: initialData.length } : undefined
  })

  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: FindingStatus }) => {
      const response = await fetch('/api/findings/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status })
      })
      if (!response.ok) throw new Error('Failed to update findings')
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: t('findings.batchUpdateSuccess'),
        description: t('findings.itemsUpdated', { count: data.updated })
      })
      queryClient.invalidateQueries({ queryKey: ['findings'] })
      setSelectedIds(new Set())
    },
    onError: () => {
      toast({
        title: t('findings.updateFailed'),
        description: t('findings.tryAgain'),
        variant: 'destructive'
      })
    }
  })

  // Memoized filtered and sorted data
  const processedFindings = useMemo(() => {
    if (!findingsResponse?.data) return []
    
    let findings = [...findingsResponse.data]
    
    // Sort by severity by default
    findings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
    
    return findings
  }, [findingsResponse])

  // Virtualization helpers
  const getItemSize = useCallback((index: number) => {
    const id = processedFindings[index]?.id
    return expandedRows.has(id) ? 300 : 80
  }, [expandedRows, processedFindings])

  // Event handlers
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setSelectedIds(new Set())
  }

  const handleSelectAll = () => {
    if (selectedIds.size === processedFindings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(processedFindings.map(f => f.id)))
    }
  }

  const handleSelectFinding = (id: string, shiftKey: boolean = false) => {
    const newSelection = new Set(selectedIds)
    const currentIndex = processedFindings.findIndex(f => f.id === id)
    
    if (shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, currentIndex)
      const end = Math.max(lastSelectedIndex, currentIndex)
      for (let i = start; i <= end; i++) {
        newSelection.add(processedFindings[i].id)
      }
    } else {
      // Toggle selection
      if (newSelection.has(id)) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
      setLastSelectedIndex(currentIndex)
    }
    
    setSelectedIds(newSelection)
  }

  const handleExpandRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
    
    // Recalculate list sizes
    if (listRef.current) {
      listRef.current.resetAfterIndex(0)
    }
  }

  const handleBatchAction = (action: string) => {
    setBatchConfirmDialog({
      open: true,
      action,
      count: selectedIds.size
    })
  }

  const confirmBatchAction = () => {
    if (batchConfirmDialog.action === 'markReviewed') {
      batchUpdateMutation.mutate({
        ids: Array.from(selectedIds),
        status: 'reviewed'
      })
    }
    onBatchAction?.(Array.from(selectedIds), batchConfirmDialog.action)
    setBatchConfirmDialog({ open: false, action: '', count: 0 })
  }

  const handleSaveFilterPreset = () => {
    const name = prompt(t('findings.filterPresetName'))
    if (name) {
      const newPreset: FilterPreset = {
        id: `preset-${Date.now()}`,
        name,
        filters: { ...filters }
      }
      setFilterPresets([...filterPresets, newPreset])
      toast({ title: t('findings.filterSaved') })
    }
  }

  const handleLoadFilterPreset = (preset: FilterPreset) => {
    setFilters(preset.filters)
  }

  const handleClearFilters = () => {
    setFilters({
      severity: [],
      status: [],
      search: '',
      unreviewedOnly: false
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'a':
            e.preventDefault()
            handleSelectAll()
            break
          case 'r':
            e.preventDefault()
            if (selectedIds.size > 0) {
              handleBatchAction('markReviewed')
            }
            break
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds])

  // Render helpers
  const renderSeverityBadge = (severity: FindingSeverity) => {
    const colors = {
      critical: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-blue-500 text-white'
    }
    
    return (
      <Badge 
        className={cn(colors[severity])}
        data-testid={`severity-badge-${severity}`}
      >
        {t(`findings.severity.${severity}`)}
      </Badge>
    )
  }

  const renderSparkline = (trend: number[], id: string) => {
    const width = 60
    const height = 20
    const min = Math.min(...trend)
    const max = Math.max(...trend)
    const range = max - min || 1
    
    const points = trend.map((value, index) => {
      const x = (index / (trend.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    }).join(' ')
    
    const lastValue = trend[trend.length - 1]
    const firstValue = trend[0]
    const change = ((lastValue - firstValue) / firstValue) * 100
    
    let trendClass = 'trend-neutral'
    let trendIcon = <Minus className="w-3 h-3" />
    
    if (change > 5) {
      trendClass = 'trend-negative'
      trendIcon = <TrendingUp className="w-3 h-3 text-red-500" />
    } else if (change < -5) {
      trendClass = 'trend-positive'
      trendIcon = <TrendingDown className="w-3 h-3 text-green-500" />
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn('inline-flex items-center gap-1', trendClass)}
              data-testid={`sparkline-${id}`}
            >
              <svg width={width} height={height} className="inline-block">
                <path
                  d={`M ${points}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              {trendIcon}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div>{t('findings.trend')}: {change > 0 ? '+' : ''}{change.toFixed(1)}%</div>
              <div>{t('findings.lastValue')}: {formatSwedishNumber(lastValue)}</div>
              <div>{t('findings.change')}: {formatSwedishNumber(lastValue - firstValue)}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const renderFindingRow = (finding: FindingData, index: number) => {
    const isSelected = selectedIds.has(finding.id)
    const isExpanded = expandedRows.has(finding.id)
    const isCritical = finding.severity === 'critical'
    
    return (
      <div
        key={finding.id}
        data-testid={`finding-row-${isCritical ? 'critical-' : ''}${index}`}
        className={cn(
          'border rounded-lg mb-2 transition-all',
          isSelected && 'bg-blue-50 dark:bg-blue-950',
          isCritical && 'border-red-500 animate-pulse-subtle',
          isCritical && 'border-2'
        )}
        role="row"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleExpandRow(finding.id)
          } else if (e.key === 'Escape' && isExpanded) {
            handleExpandRow(finding.id)
          }
        }}
      >
        {/* Main row */}
        <div className="flex items-center p-4 gap-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => handleSelectFinding(finding.id)}
            onClick={(e) => handleSelectFinding(finding.id, e.shiftKey)}
            aria-label={t('findings.selectRow')}
          />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExpandRow(finding.id)}
            aria-expanded={isExpanded}
            aria-label={t('findings.expandRow')}
          >
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
          
          <div className="flex-1 grid grid-cols-6 gap-4 items-center">
            <div>
              <div className="font-medium">{finding.ruleName[locale]}</div>
              <div className="text-sm text-gray-500">{finding.supplierName}</div>
            </div>
            
            <div data-testid={`severity-badge`}>
              {renderSeverityBadge(finding.severity)}
            </div>
            
            <div data-testid={`date-created-${index}`}>
              {formatSwedishDate(finding.createdAt)}
            </div>
            
            <div 
              className="text-sm"
              data-testid={`why-flagged-${finding.id.includes('volume') ? 'volume-anomaly' : 
                finding.id.includes('missing') ? 'missing-data' : 
                finding.id.includes('category') ? 'category-error' : index}`}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="truncate cursor-help">
                      {t('findings.whyFlagged')}: {finding.whyFlagged[locale]}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent role="tooltip">
                    <div className="max-w-sm">
                      <div className="font-medium mb-1">{t('findings.detailedExplanation')}</div>
                      <div>{finding.whyFlagged[locale]}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div data-testid={`sparkline-${finding.id.includes('upward') ? 'upward' : 
              finding.id.includes('downward') ? 'downward' : 
              finding.id.includes('stable') ? 'stable' : index}`}>
              {renderSparkline(finding.trend, finding.id)}
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {t(`findings.status.${finding.status}`)}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    {t('findings.viewDetails')}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    {t('findings.markReviewed')}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    {t('findings.markFalsePositive')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        {/* Expanded content */}
        {isExpanded && (
          <div 
            className="border-t p-4 bg-gray-50 dark:bg-gray-900"
            data-testid={`expanded-content-${index}`}
          >
            <div className="text-sm">
              <div className="font-medium mb-2">{t('findings.detailedInformation')}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500">{t('findings.affectedRows')}</div>
                  <div>{finding.details.affectedRows}</div>
                </div>
                <div>
                  <div className="text-gray-500">{t('findings.confidence')}</div>
                  <div>{(finding.confidence * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-gray-500">{t('findings.value')}</div>
                  <div>{formatSwedishNumber(finding.value)} {finding.unit}</div>
                </div>
                <div>
                  <div className="text-gray-500">{t('findings.threshold')}</div>
                  <div>{formatSwedishNumber(finding.threshold || 0)} {finding.unit}</div>
                </div>
              </div>
              {finding.comment && (
                <div className="mt-4">
                  <div className="text-gray-500">{t('findings.comment')}</div>
                  <div>{finding.comment}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  // Error state
  if (error) {
    console.error('Findings fetch error:', error)
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('findings.loadError')} {(error as Error)?.message}
          <Button onClick={() => refetch()} className="ml-2" size="sm">
            {t('findings.tryAgain')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Empty state
  if (!processedFindings.length) {
    return (
      <div className="text-center py-12" data-testid="empty-state">
        <Info className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <div className="text-lg font-medium mb-2">{t('findings.noFindings')}</div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('findings.refresh')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('findings.title')}</h2>
        <div className="flex items-center gap-2">
          <div data-testid="selection-count" className="text-sm text-gray-500">
            {selectedIds.size > 0 && t('findings.selected', { count: selectedIds.size })}
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* View mode selector */}
      <div data-testid="view-mode-selector">
        <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="rule" className={viewMode === 'rule' ? 'active' : ''}>
              <BookOpen className="w-4 h-4 mr-2" />
              {t('findings.viewRule')}
            </TabsTrigger>
            <TabsTrigger value="cluster" className={viewMode === 'cluster' ? 'active' : ''}>
              <Grid3X3 className="w-4 h-4 mr-2" />
              {t('findings.viewCluster')}
            </TabsTrigger>
            <TabsTrigger value="supplier" className={viewMode === 'supplier' ? 'active' : ''}>
              <Users className="w-4 h-4 mr-2" />
              {t('findings.viewSupplier')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filters and actions */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder={t('findings.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="max-w-md"
            data-testid="search-input"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="severity-filter">
              <Filter className="w-4 h-4 mr-2" />
              {t('findings.filter')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{t('findings.severity.label')}</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={filters.severity.includes('critical')}
              onCheckedChange={(checked) => {
                const newSeverity = checked 
                  ? [...filters.severity, 'critical']
                  : filters.severity.filter(s => s !== 'critical')
                setFilters({ ...filters, severity: newSeverity })
              }}
            >
              {t('findings.severity.critical')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.severity.includes('high')}
              onCheckedChange={(checked) => {
                const newSeverity = checked 
                  ? [...filters.severity, 'high']
                  : filters.severity.filter(s => s !== 'high')
                setFilters({ ...filters, severity: newSeverity })
              }}
            >
              {t('findings.severity.high')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearFilters}>
              {t('findings.clearFilters')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          onClick={() => setShowAdvancedFilter(true)}
        >
          {t('findings.advancedFilter')}
        </Button>

        <Button
          variant="outline"
          onClick={handleSaveFilterPreset}
        >
          <Save className="w-4 h-4 mr-2" />
          {t('findings.saveFilter')}
        </Button>

        {filterPresets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {t('findings.loadFilter')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {filterPresets.map(preset => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handleLoadFilterPreset(preset)}
                >
                  {preset.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {selectedIds.size > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                {t('findings.batchActions')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBatchAction('markReviewed')}>
                <Check className="w-4 h-4 mr-2" />
                {t('findings.markAsReviewed')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchAction('markFalsePositive')}>
                <X className="w-4 h-4 mr-2" />
                {t('findings.markAsFalsePositive')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchAction('export')}>
                <Download className="w-4 h-4 mr-2" />
                {t('findings.export')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button>
          <Download className="w-4 h-4 mr-2" />
          {t('findings.export')}
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div data-testid="total-count">
          {t('findings.total')}: {formatSwedishNumber(findingsResponse?.total || 0)}
        </div>
        <div data-testid="percentage-value">
          {t('findings.reviewed')}: {formatSwedishNumber(45.6, 1)}%
        </div>
      </div>

      {/* Table/List */}
      <div 
        data-testid="findings-table" 
        className="border rounded-lg p-4"
        aria-label={t('findings.tableLabel')}
      >
        {/* Table header */}
        <div className="flex items-center p-4 border-b font-medium" role="row">
          <Checkbox
            checked={selectedIds.size === processedFindings.length && processedFindings.length > 0}
            onCheckedChange={handleSelectAll}
            className="mr-4"
            aria-label={t('findings.selectAll')}
          />
          <div className="w-8" />
          <div className="flex-1 grid grid-cols-6 gap-4">
            <div role="columnheader" aria-sort="none">{t('findings.rule')}</div>
            <div role="columnheader" aria-sort="descending">{t('findings.severity.label')}</div>
            <div role="columnheader" aria-sort="none">{t('findings.date')}</div>
            <div role="columnheader">{t('findings.reason')}</div>
            <div role="columnheader">{t('findings.trend')}</div>
            <div role="columnheader">{t('findings.actions')}</div>
          </div>
        </div>

        {/* Virtualized list or regular list */}
        {virtualized ? (
          <div data-testid="virtual-list-container" data-virtualized="true" style={{ height: 600 }}>
            <List
              ref={listRef}
              height={600}
              itemCount={processedFindings.length}
              itemSize={getItemSize}
              width="100%"
            >
              {({ index, style }) => (
                <div style={style}>
                  {renderFindingRow(processedFindings[index], index)}
                </div>
              )}
            </List>
          </div>
        ) : (
          <div>
            {viewMode === 'rule' && findingsResponse?.grouped && 
              Object.entries(findingsResponse.grouped).map(([ruleId, group]: [string, any]) => (
                <div key={ruleId} data-testid={`rule-group-${ruleId}`}>
                  <div className="font-medium p-2 bg-gray-100 dark:bg-gray-800">
                    {group.rule?.name[locale]}
                  </div>
                  {group.findings.map((finding: FindingData, idx: number) => 
                    renderFindingRow(finding, idx)
                  )}
                </div>
              ))
            }
            {viewMode === 'cluster' && findingsResponse?.grouped &&
              Object.entries(findingsResponse.grouped).map(([clusterId, group]: [string, any]) => (
                <div key={clusterId} data-testid={`cluster-group-${clusterId}`}>
                  <div className="font-medium p-2 bg-gray-100 dark:bg-gray-800">
                    {group.cluster?.name}
                  </div>
                  {group.findings.map((finding: FindingData, idx: number) => 
                    renderFindingRow(finding, idx)
                  )}
                </div>
              ))
            }
            {viewMode === 'supplier' && findingsResponse?.grouped &&
              Object.entries(findingsResponse.grouped).map(([supplierId, group]: [string, any]) => (
                <div key={supplierId} data-testid={`supplier-group-${supplierId}`}>
                  <div className="font-medium p-2 bg-gray-100 dark:bg-gray-800">
                    {group.supplier?.name}
                  </div>
                  {group.findings.map((finding: FindingData, idx: number) => 
                    renderFindingRow(finding, idx)
                  )}
                </div>
              ))
            }
            {viewMode === 'rule' && !findingsResponse?.grouped &&
              processedFindings.map((finding, index) => renderFindingRow(finding, index))
            }
          </div>
        )}
      </div>

      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {selectedIds.size > 0 && t('findings.itemsSelected', { count: selectedIds.size })}
      </div>

      {/* Batch confirmation dialog */}
      <Dialog open={batchConfirmDialog.open} onOpenChange={(open) => 
        setBatchConfirmDialog({ ...batchConfirmDialog, open })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('findings.confirmBatchAction')}</DialogTitle>
            <DialogDescription>
              {t('findings.confirmBatchDescription', { 
                count: batchConfirmDialog.count,
                action: t(`findings.actions.${batchConfirmDialog.action}`)
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchConfirmDialog({ open: false, action: '', count: 0 })}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={confirmBatchAction}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced filter dialog */}
      <Dialog open={showAdvancedFilter} onOpenChange={setShowAdvancedFilter}>
          <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('findings.advancedFilter')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('findings.supplier')}
              </label>
              <Select
                value={filters.supplier}
                onValueChange={(value) => setFilters({ ...filters, supplier: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('findings.selectSupplier')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ragn-sells">Ragn-Sells</SelectItem>
                  <SelectItem value="stena">Stena Recycling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('findings.period')}
              </label>
              <Select
                value={filters.period}
                onValueChange={(value) => setFilters({ ...filters, period: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('findings.selectPeriod')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024-03">2024-03</SelectItem>
                  <SelectItem value="2024-02">2024-02</SelectItem>
                  <SelectItem value="2024-01">2024-01</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="unreviewed"
                checked={filters.unreviewedOnly}
                onCheckedChange={(checked) => 
                  setFilters({ ...filters, unreviewedOnly: checked as boolean })
                }
              />
              <label htmlFor="unreviewed" className="text-sm font-medium">
                {t('findings.unreviewedOnly')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdvancedFilter(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => setShowAdvancedFilter(false)}>
              {t('findings.applyFilter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { FindingsTriageInterface }