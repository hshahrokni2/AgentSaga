'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Play, Save, Link2, AlertCircle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatSwedishNumber, formatSwedishCurrency, formatSwedishDate } from '@/lib/utils'

// Types
interface Supplier {
  id: string
  name: string
  region: string
}

interface Insight {
  id: string
  title: string
  supplier: string
}

interface ScenarioResult {
  kpis: {
    completeness: { current: number; baseline: number; change: number }
    anomalies: { current: number; baseline: number; change: number }
    reviewProgress: { current: number; baseline: number; change: number }
  }
  flagChanges: {
    supplier: string
    added: number
    removed: number
    changed: number
  }[]
  heatmapData: {
    supplier: string
    status: 'green' | 'orange' | 'red'
    value: number
  }[]
}

interface ScenarioLabProps {
  suppliers: Supplier[]
  insights: Insight[]
  onRun: (config: any) => Promise<ScenarioResult>
  onSave: (snapshot: any) => Promise<string>
  onCreateInsight: (data: any) => Promise<string>
}

export function ScenarioLab({
  suppliers,
  insights,
  onRun,
  onSave,
  onCreateInsight
}: ScenarioLabProps) {
  // State with better initial values
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [monthRange, setMonthRange] = useState<string>('current')
  const [parameters, setParameters] = useState({
    weightThreshold: 15,
    reportingThreshold: 95,
    startTime: '06:00',
    endTime: '19:00'
  })
  const [selectedInsights, setSelectedInsights] = useState<string[]>([])
  const [insightSearch, setInsightSearch] = useState('')
  const [notes, setNotes] = useState('')
  
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<ScenarioResult | null>(null)
  const [error, setError] = useState<string>('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [progress, setProgress] = useState<number>(0)

  // Validation
  const validateForm = useCallback(() => {
    const errors: string[] = []
    
    if (selectedSuppliers.length === 0) {
      errors.push('Välj minst en leverantör')
    }
    
    if (parameters.weightThreshold < 0 || parameters.weightThreshold > 100) {
      errors.push('Viktavvikelse måste vara mellan 0-100%')
    }
    
    if (parameters.reportingThreshold < 0 || parameters.reportingThreshold > 100) {
      errors.push('Rapporteringsgrad måste vara mellan 0-100%')
    }
    
    setValidationErrors(errors)
    return errors.length === 0
  }, [selectedSuppliers, parameters])

  // Handlers
  const handleSupplierSelect = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    )
  }

  const handleParameterChange = (key: string, value: any) => {
    setParameters(prev => ({ ...prev, [key]: value }))
  }

  const handleInsightSearch = (value: string) => {
    setInsightSearch(value)
  }

  const handleInsightSelect = (insightId: string) => {
    setSelectedInsights(prev =>
      prev.includes(insightId)
        ? prev.filter(id => id !== insightId)
        : [...prev, insightId]
    )
  }

  const handleRun = async () => {
    if (!validateForm()) return
    
    setError('')
    setIsRunning(true)
    setProgress(0)
    
    try {
      const config = {
        suppliers: selectedSuppliers,
        monthRange,
        parameters,
        insights: selectedInsights,
        timestamp: new Date()
      }
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)
      
      const result = await onRun(config)
      
      clearInterval(progressInterval)
      setProgress(100)
      setResults(result)
      
      // Clear progress after a moment
      setTimeout(() => setProgress(0), 1000)
      
    } catch (err) {
      setProgress(0)
      const errorMessage = err instanceof Error ? err.message : 'Ett fel uppstod vid körning av scenario'
      setError(errorMessage)
    } finally {
      setIsRunning(false)
    }
  }

  const handleSave = async () => {
    if (!results) return
    
    try {
      const snapshot = {
        config: {
          suppliers: selectedSuppliers,
          monthRange,
          parameters,
          insights: selectedInsights
        },
        results,
        notes,
        createdAt: new Date()
      }
      
      const snapshotId = await onSave(snapshot)
      // Handle success
    } catch (err) {
      setError('Kunde inte spara snapshot')
    }
  }

  const handleCreateInsight = async () => {
    if (!results) return
    
    try {
      const insightData = {
        title: `Scenario - ${new Date().toLocaleDateString('sv-SE')}`,
        description: notes || 'Genererat från scenario',
        source: 'whatif',
        metadata: {
          config: {
            suppliers: selectedSuppliers,
            parameters
          },
          results
        }
      }
      
      const insightId = await onCreateInsight(insightData)
      // Handle success
    } catch (err) {
      setError('Kunde inte skapa insight')
    }
  }

  // Filter insights based on search
  const filteredInsights = insights.filter(insight =>
    insight.id.toLowerCase().includes(insightSearch.toLowerCase()) ||
    insight.title.toLowerCase().includes(insightSearch.toLowerCase())
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to run scenario
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!isRunning && selectedSuppliers.length > 0) {
          handleRun()
        }
      }
      
      // Cmd/Ctrl + S to save (if results available)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (results && !isRunning) {
          handleSave()
        }
      }
      
      // Escape to clear errors
      if (e.key === 'Escape') {
        setError('')
        setValidationErrors([])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isRunning, selectedSuppliers, results])

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full p-6" 
      data-testid="scenario-lab"
    >
      {/* Left Panel - Controls */}
      <GlassCard
        variant="subtle"
        className="col-span-1 md:col-span-4 space-y-6"
        data-testid="scenario-controls-panel"
        aria-label="Scenarioinställningar"
      >
        <div>
          <h2 className="text-lg font-semibold mb-4">Scenarioinställningar</h2>
          
          {/* Supplier Selection */}
          <div className="space-y-2">
            <label htmlFor="suppliers-select" className="text-sm font-medium">
              Leverantörer
            </label>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Välj leverantörer</p>
              {suppliers.map(supplier => (
                <div key={supplier.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`supplier-${supplier.id}`}
                    checked={selectedSuppliers.includes(supplier.id)}
                    onCheckedChange={() => handleSupplierSelect(supplier.id)}
                  />
                  <label
                    htmlFor={`supplier-${supplier.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {supplier.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Month Range */}
          <div className="space-y-2">
            <label htmlFor="month-range" className="text-sm font-medium">
              Månadsintervall
            </label>
            <Select value={monthRange} onValueChange={setMonthRange}>
              <SelectTrigger>
                <SelectValue placeholder="Välj period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Aktuell månad</SelectItem>
                <SelectItem value="last3">Senaste 3 månader</SelectItem>
                <SelectItem value="last6">Senaste 6 månader</SelectItem>
                <SelectItem value="last12">Senaste 12 månader</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Parameters */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Parametrar</h3>
            
            {/* Threshold Controls */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Tröskelvärden</label>
              
              <div className="space-y-2">
                <label htmlFor="weight-threshold" className="text-xs">
                  Viktavvikelse (%)
                </label>
                <div className="px-3">
                  <Slider
                    id="weight-threshold"
                    min={0}
                    max={100}
                    step={5}
                    value={[parameters.weightThreshold]}
                    onValueChange={([value]) => handleParameterChange('weightThreshold', value)}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {parameters.weightThreshold}%
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reporting-threshold" className="text-xs">
                  Rapporteringsgrad (%)
                </label>
                <div className="px-3">
                  <Slider
                    id="reporting-threshold"
                    min={0}
                    max={100}
                    step={5}
                    value={[parameters.reportingThreshold]}
                    onValueChange={([value]) => handleParameterChange('reportingThreshold', value)}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {parameters.reportingThreshold}%
                  </div>
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Arbetstider</label>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="start-time" className="text-xs">Starttid</label>
                  <Input
                    id="start-time"
                    type="time"
                    value={parameters.startTime}
                    onChange={(e) => handleParameterChange('startTime', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="end-time" className="text-xs">Sluttid</label>
                  <Input
                    id="end-time"
                    type="time"
                    value={parameters.endTime}
                    onChange={(e) => handleParameterChange('endTime', e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* INS-ID Search */}
          <div className="space-y-2">
            <label htmlFor="insight-search" className="text-sm font-medium">
              Baserat på Insights
            </label>
            <Input
              id="insight-search"
              type="text"
              placeholder="Sök INS-ID (t.ex. INS-2024-11-001)"
              value={insightSearch}
              onChange={(e) => handleInsightSearch(e.target.value)}
            />
            
            {filteredInsights.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {filteredInsights.map(insight => (
                  <div key={insight.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`insight-${insight.id}`}
                      checked={selectedInsights.includes(insight.id)}
                      onCheckedChange={() => handleInsightSelect(insight.id)}
                    />
                    <label
                      htmlFor={`insight-${insight.id}`}
                      className="text-xs cursor-pointer"
                    >
                      {insight.id} - {insight.title}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Right Panel - Results */}
      <GlassCard
        className="col-span-1 md:col-span-8 space-y-6"
        data-testid="scenario-results-panel"
        aria-label="Scenarioresultat"
      >
        {!results ? (
          <div 
            className="flex flex-col items-center justify-center h-full text-center p-12"
            data-testid="results-empty-state"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Play className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Kör ett scenario för att se resultat</h3>
            <p className="text-muted-foreground">
              Välj leverantörer och parametrar, sedan klicka Kör Scenario
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Diff KPIs */}
            <div data-testid="diff-kpis-section">
              <h3 className="text-lg font-semibold mb-4">KPI Jämförelse</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(results.kpis).map(([key, kpi]) => {
                  const isPositive = kpi.change >= 0
                  const Icon = isPositive ? TrendingUp : kpi.change < 0 ? TrendingDown : Minus
                  
                  return (
                    <Card key={key} data-testid={`kpi-card-${key}`} className="glass-strong">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm capitalize">
                          {key === 'completeness' ? 'Fullständighet' : 
                           key === 'anomalies' ? 'Anomalier' : 'Granskningsframsteg'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold">
                              {formatSwedishNumber(kpi.current, 1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              från {formatSwedishNumber(kpi.baseline, 1)}%
                            </div>
                          </div>
                          <div className={cn(
                            "flex items-center space-x-1 text-sm",
                            isPositive ? "text-green-600" : kpi.change < 0 ? "text-red-600" : "text-muted-foreground"
                          )}>
                            <Icon className="h-4 w-4" />
                            <span>{formatSwedishNumber(Math.abs(kpi.change), 1)}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Flags Change Table */}
            <div data-testid="flags-change-table">
              <h3 className="text-lg font-semibold mb-4">Förändringar i Flaggor</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-sm">Leverantör</th>
                      <th className="text-right p-2 text-sm">Tillagda</th>
                      <th className="text-right p-2 text-sm">Borttagna</th>
                      <th className="text-right p-2 text-sm">Ändrade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.flagChanges.map((change, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 text-sm">{change.supplier}</td>
                        <td className="p-2 text-sm text-right text-green-600">
                          +{change.added}
                        </td>
                        <td className="p-2 text-sm text-right text-red-600">
                          -{change.removed}
                        </td>
                        <td className="p-2 text-sm text-right text-blue-600">
                          {change.changed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Color Heatmap */}
            <div data-testid="scenario-heatmap">
              <h3 className="text-lg font-semibold mb-4">Statusöversikt per Leverantör</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {results.heatmapData.map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg text-center text-sm font-medium",
                      item.status === 'green' && 'bg-green-100 text-green-800',
                      item.status === 'orange' && 'bg-orange-100 text-orange-800',
                      item.status === 'red' && 'bg-red-100 text-red-800'
                    )}
                  >
                    <div className="truncate">{item.supplier}</div>
                    <div className="text-xs opacity-75">
                      {formatSwedishNumber(item.value, 1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Anteckningar
          </label>
          <Textarea
            id="notes"
            placeholder="Lägg till anteckningar om scenariot..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
      </GlassCard>

      {/* Footer */}
      <div 
        className="col-span-1 md:col-span-12"
        data-testid="scenario-footer"
      >
        <GlassCard className="p-4">
          {/* Status and Errors */}
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {validationErrors.length > 0 && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading status with progress */}
          {isRunning && (
            <div 
              role="status"
              aria-live="polite"
              className="mb-4 space-y-2"
            >
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Kör scenario... {progress > 0 && `${progress}%`}</span>
              </div>
              {progress > 0 && (
                <Progress value={progress} className="w-full h-2" />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center space-x-2"
                title="Kör scenario (⌘+Enter)"
              >
                <Play className="h-4 w-4" />
                <span>{isRunning ? 'Kör scenario...' : 'Kör Scenario'}</span>
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={!results}
                className="flex items-center space-x-2"
                title="Spara snapshot (⌘+S)"
              >
                <Save className="h-4 w-4" />
                <span>Spara Snapshot</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={handleCreateInsight}
                disabled={!results}
                className="flex items-center space-x-2"
              >
                <Link2 className="h-4 w-4" />
                <span>Länka till Insights</span>
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

// Mock results for development
const mockResults: ScenarioResult = {
  kpis: {
    completeness: { current: 87.3, baseline: 82.1, change: 5.2 },
    anomalies: { current: 12.7, baseline: 15.8, change: -3.1 },
    reviewProgress: { current: 94.5, baseline: 88.2, change: 6.3 }
  },
  flagChanges: [
    { supplier: 'ABC Avfallshantering', added: 3, removed: 1, changed: 2 },
    { supplier: 'DEF Återvinning', added: 0, removed: 2, changed: 1 },
    { supplier: 'GHI Miljötjänster', added: 1, removed: 0, changed: 3 }
  ],
  heatmapData: [
    { supplier: 'ABC Avfallshantering', status: 'green', value: 92.5 },
    { supplier: 'DEF Återvinning', status: 'orange', value: 78.3 },
    { supplier: 'GHI Miljötjänster', status: 'red', value: 65.1 },
    { supplier: 'JKL Sortering', status: 'green', value: 89.7 }
  ]
}