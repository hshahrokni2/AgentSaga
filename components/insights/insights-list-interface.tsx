'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/use-websocket'
import { useTranslation } from '@/hooks/use-translation'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MonthRangePicker } from '@/components/ui/month-range-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Copy,
  Sparkles,
  PlayCircle,
  Merge,
  Pin,
  PinOff,
  MoreVertical,
  FileText,
  BarChart3,
  Database,
  AlertOctagon,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export interface InsightData {
  id: string // INS-YYYY-MM-NNN
  title: string
  summary: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'new' | 'reviewing' | 'validated' | 'resolved' | 'false_positive'
  confidence: number
  source: 'rule' | 'ml' | 'human' | 'scenario'
  createdAt: Date
  updatedAt: Date
  supplier?: string
  month?: string
  isPinned?: boolean
  evidenceCount?: number
  affectedRows?: number
  linkedRows?: any[]
  linkedFiles?: any[]
  charts?: any[]
}

export interface InsightsListInterfaceProps {
  supplierId?: string
  initialFilters?: {
    severity?: string[]
    status?: string[]
    source?: string[]
    supplier?: string
    monthRange?: { start: string; end: string }
  }
  locale?: 'sv' | 'en'
  onInsightExplain?: (insight: InsightData) => void
  onCreateScenario?: (insight: InsightData) => void
}

interface FilterState {
  severity: string[]
  status: string[]
  source: string[]
  supplier: string
  monthRange: { start: string; end: string } | null
}

export function InsightsListInterface({
  supplierId,
  initialFilters = {},
  locale = 'sv',
  onInsightExplain,
  onCreateScenario
}: InsightsListInterfaceProps) {
  const { t } = useTranslation(locale)
  const queryClient = useQueryClient()
  const { messages, isConnected } = useWebSocket('/ws/insights')
  
  // State management
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    severity: initialFilters.severity || [],
    status: initialFilters.status || [],
    source: initialFilters.source || [],
    supplier: initialFilters.supplier || supplierId || '',
    monthRange: initialFilters.monthRange || null
  })

  // Fetch insights data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['insights', currentPage, pageSize, filters, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: searchQuery,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v && (Array.isArray(v) ? v.length > 0 : true))
        )
      })
      const response = await fetch(`/api/insights?${params}`)
      if (!response.ok) throw new Error('Failed to fetch insights')
      return response.json()
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000
  })

  // Mutations
  const mergeInsights = useMutation({
    mutationFn: async (insightIds: string[]) => {
      const response = await fetch('/api/insights/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: insightIds })
      })
      if (!response.ok) throw new Error('Failed to merge insights')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setSelectedIds(new Set())
      toast({ title: t('insights.merged') })
    },
    onError: () => {
      toast({ title: t('insights.mergeFailed'), variant: 'destructive' })
    }
  })

  const updateInsightStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const response = await fetch('/api/insights/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status })
      })
      if (!response.ok) throw new Error('Failed to update status')
      return response.json()
    },
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: ['insights'] })
      const previousData = queryClient.getQueryData(['insights'])
      
      queryClient.setQueryData(['insights'], (old: any) => ({
        ...old,
        items: old.items.map((item: InsightData) =>
          ids.includes(item.id) ? { ...item, status } : item
        )
      }))
      
      return { previousData }
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['insights'], context.previousData)
      }
      toast({ title: t('insights.updateFailed'), variant: 'destructive' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setSelectedIds(new Set())
    }
  })

  const togglePin = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      const response = await fetch(`/api/insights/${id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned })
      })
      if (!response.ok) throw new Error('Failed to toggle pin')
      return response.json()
    },
    onMutate: async ({ id, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: ['insights'] })
      const previousData = queryClient.getQueryData(['insights'])
      
      queryClient.setQueryData(['insights'], (old: any) => ({
        ...old,
        items: old.items.map((item: InsightData) =>
          item.id === id ? { ...item, isPinned } : item
        )
      }))
      
      return { previousData }
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['insights'], context.previousData)
      }
    }
  })

  // WebSocket message handling
  useEffect(() => {
    messages.forEach(message => {
      if (message.type === 'insight.created' || message.type === 'insight.updated') {
        queryClient.invalidateQueries({ queryKey: ['insights'] })
      }
    })
  }, [messages, queryClient])

  // Helper functions
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
    if (!activeTab[id]) {
      setActiveTab(prev => ({ ...prev, [id]: 'rows' }))
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === data?.items?.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data?.items?.map((item: InsightData) => item.id)))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: t('common.copied') })
  }

  const getSeverityIcon = (severity: string) => {
    const icons = {
      critical: <AlertOctagon className="w-4 h-4 text-red-600" />,
      high: <AlertTriangle className="w-4 h-4 text-orange-600" />,
      medium: <AlertCircle className="w-4 h-4 text-yellow-600" />,
      low: <Info className="w-4 h-4 text-blue-600" />,
      info: <Info className="w-4 h-4 text-gray-600" />
    }
    return icons[severity as keyof typeof icons] || icons.info
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      new: 'default',
      reviewing: 'secondary',
      validated: 'success',
      resolved: 'outline',
      false_positive: 'destructive'
    } as const
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {t(`insights.status.${status}`)}
      </Badge>
    )
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="insights-loading">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <Alert variant="destructive" data-testid="insights-error">
        <AlertDescription>{t('insights.loadError')}</AlertDescription>
      </Alert>
    )
  }

  // Render empty state
  if (!data?.items?.length) {
    return (
      <GlassCard className="p-8 text-center" data-testid="insights-empty">
        <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">{t('insights.noResults')}</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4" data-testid="insights-list-interface">
      {/* Filter Bar */}
      <GlassCard className="p-4" data-testid="filter-bar">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('insights.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="search-input"
              />
            </div>
          </div>

          {/* Severity Filter */}
          <Select
            value={filters.severity.join(',')}
            onValueChange={(value) => setFilters(prev => ({ 
              ...prev, 
              severity: value ? value.split(',') : [] 
            }))}
          >
            <SelectTrigger className="w-[150px]" data-testid="severity-filter">
              <SelectValue placeholder={t('insights.severity')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="critical">{t('insights.severity.critical')}</SelectItem>
              <SelectItem value="high">{t('insights.severity.high')}</SelectItem>
              <SelectItem value="medium">{t('insights.severity.medium')}</SelectItem>
              <SelectItem value="low">{t('insights.severity.low')}</SelectItem>
              <SelectItem value="info">{t('insights.severity.info')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={filters.status.join(',')}
            onValueChange={(value) => setFilters(prev => ({ 
              ...prev, 
              status: value ? value.split(',') : [] 
            }))}
          >
            <SelectTrigger className="w-[150px]" data-testid="status-filter">
              <SelectValue placeholder={t('insights.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="new">{t('insights.status.new')}</SelectItem>
              <SelectItem value="reviewing">{t('insights.status.reviewing')}</SelectItem>
              <SelectItem value="validated">{t('insights.status.validated')}</SelectItem>
              <SelectItem value="resolved">{t('insights.status.resolved')}</SelectItem>
              <SelectItem value="false_positive">{t('insights.status.false_positive')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Month Range */}
          <MonthRangePicker
            value={filters.monthRange}
            onChange={(range) => setFilters(prev => ({ ...prev, monthRange: range }))}
            data-testid="month-range-filter"
          />
        </div>
      </GlassCard>

      {/* Batch Operations */}
      {selectedIds.size > 0 && (
        <GlassCard className="p-2" data-testid="batch-operations">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} {t('insights.selected')}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => mergeInsights.mutate(Array.from(selectedIds))}
              data-testid="merge-button"
            >
              <Merge className="w-4 h-4 mr-1" />
              {t('insights.merge')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" data-testid="batch-status-button">
                  {t('insights.changeStatus')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem 
                  onClick={() => updateInsightStatus.mutate({ 
                    ids: Array.from(selectedIds), 
                    status: 'reviewing' 
                  })}
                >
                  {t('insights.status.reviewing')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => updateInsightStatus.mutate({ 
                    ids: Array.from(selectedIds), 
                    status: 'validated' 
                  })}
                >
                  {t('insights.status.validated')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => updateInsightStatus.mutate({ 
                    ids: Array.from(selectedIds), 
                    status: 'resolved' 
                  })}
                >
                  {t('insights.status.resolved')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </GlassCard>
      )}

      {/* Main Table */}
      <GlassCard className="overflow-hidden" data-testid="insights-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 w-10">
                  <Checkbox
                    checked={selectedIds.size === data?.items?.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label={t('insights.selectAll')}
                    data-testid="select-all-checkbox"
                  />
                </th>
                <th className="p-2 w-10"></th>
                <th className="p-2 text-left">{t('insights.id')}</th>
                <th className="p-2 text-left">{t('insights.title')}</th>
                <th className="p-2 text-left">{t('insights.severity')}</th>
                <th className="p-2 text-left">{t('insights.status')}</th>
                <th className="p-2 text-left">{t('insights.supplier')}</th>
                <th className="p-2 text-left">{t('insights.evidence')}</th>
                <th className="p-2 w-20">{t('insights.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((insight: InsightData) => (
                <React.Fragment key={insight.id}>
                  <tr 
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    data-testid={`insight-row-${insight.id}`}
                  >
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.has(insight.id)}
                        onCheckedChange={() => toggleSelection(insight.id)}
                        aria-label={`Select ${insight.id}`}
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(insight.id)}
                        aria-label={expandedRows.has(insight.id) ? 'Collapse' : 'Expand'}
                        data-testid={`expand-button-${insight.id}`}
                      >
                        {expandedRows.has(insight.id) ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {insight.isPinned && <Pin className="w-3 h-3 text-primary" />}
                        <code className="text-xs">{insight.id}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(insight.id)}
                          aria-label="Copy ID"
                          className="opacity-0 hover:opacity-100"
                          data-testid={`copy-id-${insight.id}`}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(insight.severity)}
                        <span className="font-medium">{insight.title}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">
                        {t(`insights.severity.${insight.severity}`)}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {getStatusBadge(insight.status)}
                    </td>
                    <td className="p-2">{insight.supplier}</td>
                    <td className="p-2">
                      <span className="text-sm text-muted-foreground">
                        {insight.evidenceCount || 0} items
                      </span>
                    </td>
                    <td className="p-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`actions-button-${insight.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onInsightExplain?.(insight)}
                            data-testid={`explain-button-${insight.id}`}
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            {t('insights.explain')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onCreateScenario?.(insight)}
                            data-testid={`scenario-button-${insight.id}`}
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            {t('insights.createScenario')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => togglePin.mutate({ 
                              id: insight.id, 
                              isPinned: !insight.isPinned 
                            })}
                          >
                            {insight.isPinned ? 
                              <PinOff className="w-4 h-4 mr-2" /> : 
                              <Pin className="w-4 h-4 mr-2" />
                            }
                            {insight.isPinned ? t('insights.unpin') : t('insights.pin')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  
                  {/* Expanded Evidence Panel */}
                  {expandedRows.has(insight.id) && (
                    <tr data-testid={`evidence-panel-${insight.id}`}>
                      <td colSpan={9} className="p-0">
                        <div className="p-4 bg-muted/20">
                          <Tabs
                            value={activeTab[insight.id] || 'rows'}
                            onValueChange={(value) => setActiveTab(prev => ({ 
                              ...prev, 
                              [insight.id]: value 
                            }))}
                          >
                            <TabsList>
                              <TabsTrigger value="rows" data-testid={`tab-rows-${insight.id}`}>
                                <Database className="w-4 h-4 mr-1" />
                                {t('insights.evidence.rows')} ({insight.linkedRows?.length || 0})
                              </TabsTrigger>
                              <TabsTrigger value="files" data-testid={`tab-files-${insight.id}`}>
                                <FileText className="w-4 h-4 mr-1" />
                                {t('insights.evidence.files')} ({insight.linkedFiles?.length || 0})
                              </TabsTrigger>
                              <TabsTrigger value="charts" data-testid={`tab-charts-${insight.id}`}>
                                <BarChart3 className="w-4 h-4 mr-1" />
                                {t('insights.evidence.charts')} ({insight.charts?.length || 0})
                              </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="rows" className="mt-4">
                              {insight.linkedRows?.length ? (
                                <div className="space-y-2">
                                  {insight.linkedRows.map((row, idx) => (
                                    <div key={idx} className="p-2 bg-background rounded">
                                      <pre className="text-xs">{JSON.stringify(row, null, 2)}</pre>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {t('insights.evidence.noRows')}
                                </p>
                              )}
                            </TabsContent>
                            
                            <TabsContent value="files" className="mt-4">
                              {insight.linkedFiles?.length ? (
                                <div className="grid gap-2">
                                  {insight.linkedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded">
                                      <FileText className="w-4 h-4" />
                                      <span className="text-sm">{file.name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {t('insights.evidence.noFiles')}
                                </p>
                              )}
                            </TabsContent>
                            
                            <TabsContent value="charts" className="mt-4">
                              {insight.charts?.length ? (
                                <div className="grid gap-4">
                                  {insight.charts.map((chart, idx) => (
                                    <div key={idx} className="p-4 bg-background rounded">
                                      {/* Chart would be rendered here */}
                                      <div className="h-32 bg-muted rounded flex items-center justify-center">
                                        <BarChart3 className="w-8 h-8 text-muted-foreground" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {t('insights.evidence.noCharts')}
                                </p>
                              )}
                            </TabsContent>
                          </Tabs>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Pagination */}
      <GlassCard className="p-4" data-testid="pagination-controls">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('common.showing')} {((currentPage - 1) * pageSize) + 1}-
              {Math.min(currentPage * pageSize, data.total)} {t('common.of')} {data.total}
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => setPageSize(parseInt(value))}
            >
              <SelectTrigger className="w-[70px]" data-testid="page-size-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              data-testid="prev-page-button"
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage * pageSize >= data.total}
              data-testid="next-page-button"
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}