'use client'

import React, { useState, useMemo } from 'react'
import { FindingsTableProps, FindingItem, FindingSeverity, FindingStatus, GranskadState } from './types/workflow-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { GlassCard } from '@/components/ui/glass-card'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  Clock, 
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function FindingsTable({
  findings,
  selectedIds,
  onSelectionChange,
  onFindingUpdate,
  currentState
}: FindingsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FindingStatus | 'all'>('all')
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'severity'>('created')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const isReadOnly = currentState === 'fully_reviewed'

  const filteredAndSortedFindings = useMemo(() => {
    let filtered = findings.filter(finding => {
      const matchesSearch = searchQuery === '' || 
        finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        finding.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        finding.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesSeverity = severityFilter === 'all' || finding.severity === severityFilter
      const matchesStatus = statusFilter === 'all' || finding.status === statusFilter
      
      return matchesSearch && matchesSeverity && matchesStatus
    })

    // Sort findings
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'severity':
          const severityOrder = { 'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'info': 1 }
          comparison = severityOrder[a.severity] - severityOrder[b.severity]
          break
      }
      
      return sortDirection === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [findings, searchQuery, severityFilter, statusFilter, sortBy, sortDirection])

  const getSeverityIcon = (severity: FindingSeverity) => {
    const props = { size: 16 }
    
    switch (severity) {
      case 'critical':
        return <AlertTriangle {...props} className="text-red-600" />
      case 'high':
        return <AlertTriangle {...props} className="text-orange-600" />
      case 'medium':
        return <AlertCircle {...props} className="text-yellow-600" />
      case 'low':
        return <Info {...props} className="text-blue-600" />
      case 'info':
        return <Info {...props} className="text-gray-600" />
      default:
        return <Info {...props} className="text-gray-600" />
    }
  }

  const getSeverityColor = (severity: FindingSeverity): string => {
    const colors = {
      'critical': 'bg-red-100 text-red-800 border-red-200',
      'high': 'bg-orange-100 text-orange-800 border-orange-200',
      'medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'low': 'bg-blue-100 text-blue-800 border-blue-200',
      'info': 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[severity] || colors.info
  }

  const getStatusColor = (status: FindingStatus): string => {
    const colors = {
      'new': 'bg-red-100 text-red-800',
      'triaged': 'bg-yellow-100 text-yellow-800',
      'explained': 'bg-blue-100 text-blue-800',
      'false_positive': 'bg-gray-100 text-gray-800',
      'resolved': 'bg-green-100 text-green-800'
    }
    return colors[status] || colors.new
  }

  const getStatusText = (status: FindingStatus): string => {
    const labels = {
      'new': 'Ny',
      'triaged': 'Triagerad',
      'explained': 'Förklarad',
      'false_positive': 'Falskt larm',
      'resolved': 'Löst'
    }
    return labels[status] || status
  }

  const getSeverityText = (severity: FindingSeverity): string => {
    const labels = {
      'critical': 'Kritisk',
      'high': 'Hög',
      'medium': 'Medium',
      'low': 'Låg',
      'info': 'Information'
    }
    return labels[severity] || severity
  }

  const getSourceText = (source: string): string => {
    const labels = {
      'rule': 'Regel',
      'ml': 'AI-modell',
      'human': 'Manuell',
      'whatif': 'Scenarioanalys',
      'validation': 'Validering'
    }
    return labels[source as keyof typeof labels] || source
  }

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedFindings.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(filteredAndSortedFindings.map(f => f.id))
    }
  }

  const handleSelectFinding = (findingId: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedIds, findingId])
    } else {
      onSelectionChange(selectedIds.filter(id => id !== findingId))
    }
  }

  const handleStatusChange = (findingId: string, newStatus: FindingStatus) => {
    onFindingUpdate(findingId, { status: newStatus })
  }

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortDirection('desc')
    }
  }

  return (
    <GlassCard className="findings-table h-full flex flex-col" data-testid="findings-table">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Fynd och observationer</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {filteredAndSortedFindings.length} av {findings.length}
            </Badge>
            {selectedIds.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {selectedIds.length} valda
              </Badge>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Sök efter titel, beskrivning eller leverantör..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="findings-search"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as any)}>
              <SelectTrigger className="w-40">
                <Filter size={16} />
                <SelectValue placeholder="Allvarlighetsgrad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="critical">Kritisk</SelectItem>
                <SelectItem value="high">Hög</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Låg</SelectItem>
                <SelectItem value="info">Information</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="new">Ny</SelectItem>
                <SelectItem value="triaged">Triagerad</SelectItem>
                <SelectItem value="explained">Förklarad</SelectItem>
                <SelectItem value="false_positive">Falskt larm</SelectItem>
                <SelectItem value="resolved">Löst</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="px-6 py-3 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-4">
          <div className="w-8 flex items-center justify-center">
            <Checkbox
              checked={selectedIds.length === filteredAndSortedFindings.length && filteredAndSortedFindings.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={isReadOnly}
              data-testid="select-all-findings"
            />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-xs font-medium"
            onClick={() => handleSort('severity')}
          >
            Allvarligt
            <ArrowUpDown size={12} />
          </Button>

          <div className="flex-1 text-xs font-medium text-muted-foreground">
            Titel och beskrivning
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-xs font-medium w-24"
            onClick={() => handleSort('updated')}
          >
            Uppdaterad
            <ArrowUpDown size={12} />
          </Button>

          <div className="w-32 text-xs font-medium text-muted-foreground">
            Status
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        {filteredAndSortedFindings.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Eye size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">Inga fynd matchar de valda kriterierna</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredAndSortedFindings.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                isSelected={selectedIds.includes(finding.id)}
                onSelect={handleSelectFinding}
                onStatusChange={handleStatusChange}
                isReadOnly={isReadOnly}
                getSeverityIcon={getSeverityIcon}
                getSeverityColor={getSeverityColor}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                getSeverityText={getSeverityText}
                getSourceText={getSourceText}
              />
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  )
}

interface FindingRowProps {
  finding: FindingItem
  isSelected: boolean
  onSelect: (findingId: string, selected: boolean) => void
  onStatusChange: (findingId: string, status: FindingStatus) => void
  isReadOnly: boolean
  getSeverityIcon: (severity: FindingSeverity) => React.ReactNode
  getSeverityColor: (severity: FindingSeverity) => string
  getStatusColor: (status: FindingStatus) => string
  getStatusText: (status: FindingStatus) => string
  getSeverityText: (severity: FindingSeverity) => string
  getSourceText: (source: string) => string
}

function FindingRow({
  finding,
  isSelected,
  onSelect,
  onStatusChange,
  isReadOnly,
  getSeverityIcon,
  getSeverityColor,
  getStatusColor,
  getStatusText,
  getSeverityText,
  getSourceText
}: FindingRowProps) {
  const handleRowClick = () => {
    if (!isReadOnly) {
      onSelect(finding.id, !isSelected)
    }
  }

  return (
    <div 
      className={cn(
        "finding-row p-4 transition-all cursor-pointer",
        isSelected && "bg-blue-50/50 border-l-4 border-l-blue-500",
        !isReadOnly && "hover:bg-accent/20"
      )}
      data-testid={`finding-row-${finding.id}`}
      onClick={handleRowClick}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="flex-shrink-0 mt-1">
          <Checkbox
            checked={isSelected}
            disabled={isReadOnly}
            onChange={(e) => e.stopPropagation()}
          />
        </div>

        {/* Severity */}
        <div className="flex-shrink-0 mt-1">
          <div className="flex items-center gap-2">
            {getSeverityIcon(finding.severity)}
            <Badge 
              variant="outline" 
              className={cn("text-xs", getSeverityColor(finding.severity))}
            >
              {getSeverityText(finding.severity)}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="font-medium text-sm leading-tight">
              {finding.title}
            </h3>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(finding.updatedAt).toLocaleDateString('sv-SE')}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            {finding.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User size={12} />
                {finding.supplierName}
              </span>
              <span>•</span>
              <span>{getSourceText(finding.source)}</span>
              {finding.assignee && (
                <>
                  <span>•</span>
                  <span>Tilldelad: {finding.assignee}</span>
                </>
              )}
            </div>

            {/* Status Selector */}
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={finding.status}
                onValueChange={(value) => onStatusChange(finding.id, value as FindingStatus)}
                disabled={isReadOnly}
              >
                <SelectTrigger className={cn("w-32 h-6 text-xs", getStatusColor(finding.status))}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Ny</SelectItem>
                  <SelectItem value="triaged">Triagerad</SelectItem>
                  <SelectItem value="explained">Förklarad</SelectItem>
                  <SelectItem value="false_positive">Falskt larm</SelectItem>
                  <SelectItem value="resolved">Löst</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}