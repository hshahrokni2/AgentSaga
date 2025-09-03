'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import { cn, formatSwedishNumber } from '@/lib/utils'

interface KPIChange {
  current: number
  baseline: number
  change: number
}

interface FlagChange {
  supplier: string
  added: number
  removed: number
  changed: number
}

interface HeatmapCell {
  supplier: string
  status: 'green' | 'orange' | 'red'
  value: number
}

interface ScenarioResult {
  kpis: {
    completeness: KPIChange
    anomalies: KPIChange
    reviewProgress: KPIChange
  }
  flagChanges: FlagChange[]
  heatmapData: HeatmapCell[]
}

interface DiffVisualizationProps {
  result: ScenarioResult | null
  isLoading?: boolean
  className?: string
}

export function DiffVisualization({ 
  result, 
  isLoading = false,
  className 
}: DiffVisualizationProps) {
  const getTrendIcon = (change: number) => {
    if (Math.abs(change) < 0.01) return <Minus className="h-4 w-4" />
    return change > 0 ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const getChangeColor = (change: number, inverse = false) => {
    const isPositive = inverse ? change < 0 : change > 0
    if (Math.abs(change) < 0.01) return 'text-muted-foreground'
    return isPositive ? 'text-green-600' : 'text-red-600'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-500'
      case 'orange': return 'bg-orange-500'
      case 'red': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  if (!result && !isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8 text-muted-foreground', className)}>
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 mx-auto opacity-50" />
          <p>Kör ett scenario för att se resultat</p>
          <p className="text-sm">Välj leverantörer och parametrar, sedan klicka Kör Scenario</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Loading skeletons */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!result) return null

  return (
    <div className={cn('space-y-4', className)}>
      {/* KPI Cards */}
      <div 
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
        role="region"
        aria-label="KPI jämförelse"
      >
        <Card className="bg-background/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Datakomplethet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatSwedishNumber(result.kpis.completeness.current)}%
                </span>
                {getTrendIcon(result.kpis.completeness.change)}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Från:</span>
                <span>{formatSwedishNumber(result.kpis.completeness.baseline)}%</span>
                <span className={getChangeColor(result.kpis.completeness.change)}>
                  ({result.kpis.completeness.change > 0 ? '+' : ''}{formatSwedishNumber(result.kpis.completeness.change)}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Anomalier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatSwedishNumber(result.kpis.anomalies.current)}
                </span>
                {getTrendIcon(result.kpis.anomalies.change)}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Från:</span>
                <span>{formatSwedishNumber(result.kpis.anomalies.baseline)}</span>
                <span className={getChangeColor(result.kpis.anomalies.change, true)}>
                  ({result.kpis.anomalies.change > 0 ? '+' : ''}{formatSwedishNumber(result.kpis.anomalies.change)})
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Granskningsframsteg</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatSwedishNumber(result.kpis.reviewProgress.current)}%
                </span>
                {getTrendIcon(result.kpis.reviewProgress.change)}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Från:</span>
                <span>{formatSwedishNumber(result.kpis.reviewProgress.baseline)}%</span>
                <span className={getChangeColor(result.kpis.reviewProgress.change)}>
                  ({result.kpis.reviewProgress.change > 0 ? '+' : ''}{formatSwedishNumber(result.kpis.reviewProgress.change)}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flag Changes Table */}
      <Card className="bg-background/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Förändringar i Flaggor</CardTitle>
          <CardDescription className="text-xs">
            Ändringar per leverantör jämfört med baseline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Leverantör</th>
                  <th className="text-center py-2">
                    <span className="text-green-600">+ Nya</span>
                  </th>
                  <th className="text-center py-2">
                    <span className="text-red-600">- Borttagna</span>
                  </th>
                  <th className="text-center py-2">
                    <span className="text-orange-600">≈ Ändrade</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.flagChanges.map((change, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2">{change.supplier}</td>
                    <td className="text-center py-2">
                      {change.added > 0 && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          +{change.added}
                        </Badge>
                      )}
                    </td>
                    <td className="text-center py-2">
                      {change.removed > 0 && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          -{change.removed}
                        </Badge>
                      )}
                    </td>
                    <td className="text-center py-2">
                      {change.changed > 0 && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700">
                          {change.changed}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Status Heatmap */}
      <Card className="bg-background/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Statusöversikt per Leverantör</CardTitle>
          <CardDescription className="text-xs">
            Klicka på en cell för detaljer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-1">
            {result.heatmapData.map((cell, idx) => (
              <button
                key={idx}
                className={cn(
                  'p-2 rounded text-white text-xs font-medium transition-transform hover:scale-105',
                  getStatusColor(cell.status)
                )}
                title={`${cell.supplier}: ${formatSwedishNumber(cell.value)}`}
                aria-label={`${cell.supplier} status ${cell.status} värde ${cell.value}`}
              >
                <div className="truncate">{cell.supplier}</div>
                <div className="font-mono">{formatSwedishNumber(cell.value)}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}