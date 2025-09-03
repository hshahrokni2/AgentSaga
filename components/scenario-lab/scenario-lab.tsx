'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { CohortPicker } from './CohortPicker'
import { ParameterControls } from './ParameterControls'
import { InsightSearch } from './InsightSearch'
import { DiffVisualization } from './DiffVisualization'
import type { 
  ScenarioLabProps, 
  ScenarioConfig, 
  ScenarioResult,
  ScenarioParameters 
} from './types'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Play, Save, Link2, AlertCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ScenarioLab({ 
  suppliers, 
  insights, 
  onRun, 
  onSave, 
  onCreateInsight,
  initialConfig,
  readOnly = false
}: ScenarioLabProps) {
  // State management with proper types
  const [config, setConfig] = useState<ScenarioConfig>({
    suppliers: initialConfig?.suppliers || [],
    monthRange: initialConfig?.monthRange || { 
      start: new Date().toISOString().slice(0, 7), 
      end: new Date().toISOString().slice(0, 7) 
    },
    parameters: initialConfig?.parameters || {
      weightThreshold: 15,
      reportingThreshold: 80,
      startHour: 6,
      endHour: 18,
      seasonalAdjustment: true,
      excludeHolidays: true,
      confidenceLevel: 95,
      maxAnomalies: 100
    },
    insightIds: initialConfig?.insightIds || [],
    notes: initialConfig?.notes || ''
  })
  
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState(0)

  // Handlers with proper types
  const handleSupplierChange = useCallback((supplierId: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      suppliers: checked 
        ? [...prev.suppliers, supplierId]
        : prev.suppliers.filter(id => id !== supplierId)
    }))
  }, [])

  const handleMonthRangeChange = useCallback((range: { start: string; end: string }) => {
    setConfig(prev => ({
      ...prev,
      monthRange: range
    }))
  }, [])

  const handleParameterChange = useCallback(<K extends keyof ScenarioParameters>(
    key: K, 
    value: ScenarioParameters[K]
  ) => {
    setConfig(prev => ({
      ...prev,
      parameters: { ...prev.parameters, [key]: value }
    }))
  }, [])

  const handleInsightSelect = useCallback((insightId: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      insightIds: checked
        ? [...prev.insightIds, insightId]
        : prev.insightIds.filter(id => id !== insightId)
    }))
  }, [])

  const handleNotesChange = useCallback((notes: string) => {
    setConfig(prev => ({
      ...prev,
      notes
    }))
  }, [])

  // Validation
  const validateConfig = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {}
    
    if (config.suppliers.length === 0) {
      errors.suppliers = 'Välj minst en leverantör'
    }
    
    if (config.parameters.weightThreshold > 100 || config.parameters.weightThreshold < 0) {
      errors.weightThreshold = 'Viktavvikelse måste vara mellan 0-100%'
    }
    
    if (config.parameters.reportingThreshold > 100 || config.parameters.reportingThreshold < 0) {
      errors.reportingThreshold = 'Rapporteringsgrad måste vara mellan 0-100%'
    }
    
    if (config.parameters.startHour >= config.parameters.endHour) {
      errors.hours = 'Sluttid måste vara efter starttid'
    }
    
    const startDate = new Date(config.monthRange.start)
    const endDate = new Date(config.monthRange.end)
    if (startDate > endDate) {
      errors.monthRange = 'Slutmånad måste vara efter startmånad'
    }
    
    return errors
  }, [config])

  // Run scenario
  const handleRun = useCallback(async () => {
    if (readOnly) return
    
    const errors = validateConfig()
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    
    setValidationErrors({})
    setError(null)
    setIsRunning(true)
    setProgress(0)
    
    // Progressive loading with actual progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90))
    }, 200)
    
    try {
      const scenarioResult = await onRun(config)
      setResult(scenarioResult)
      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod vid körning av scenario')
    } finally {
      clearInterval(progressInterval)
      setIsRunning(false)
      setTimeout(() => setProgress(0), 500)
    }
  }, [config, onRun, readOnly, validateConfig])

  // Save snapshot
  const handleSave = useCallback(async () => {
    if (!result || !onSave || readOnly) return
    
    setIsSaving(true)
    try {
      await onSave({
        id: `SCN-${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
        name: `Scenario ${new Date().toISOString().slice(0, 10)}`,
        config,
        result,
        createdAt: new Date().toISOString()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara snapshot')
    } finally {
      setIsSaving(false)
    }
  }, [config, result, onSave, readOnly])

  // Create insight
  const handleCreateInsight = useCallback(async () => {
    if (!result || !onCreateInsight || readOnly) return
    
    try {
      for (const supplierId of config.suppliers) {
        await onCreateInsight({
          title: 'Ny insight från scenario',
          description: config.notes || '',
          supplierId,
          scenarioId: result.id
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte skapa insight')
    }
  }, [config, result, onCreateInsight, readOnly])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return
      
      // Cmd/Ctrl + Enter to run
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleRun()
      }
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Escape to clear errors
      if (e.key === 'Escape') {
        setError(null)
        setValidationErrors({})
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRun, handleSave, readOnly])

  // Check if can save/link
  const canSave = useMemo(() => result !== null && !isRunning, [result, isRunning])
  const canCreateInsight = useMemo(() => result !== null && !isRunning, [result, isRunning])

  return (
    <div 
      data-testid="scenario-lab" 
      className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full"
      role="main"
      aria-label="Scenario Lab"
    >
      {/* Left Panel - Controls */}
      <aside 
        data-testid="scenario-controls-panel"
        className="col-span-1 md:col-span-4 space-y-6"
        aria-label="Scenarioinställningar"
      >
        <GlassCard variant="subtle" className="p-6">
          <h2 className="text-lg font-semibold mb-4">Scenarioinställningar</h2>
          
          {/* Cohort Picker */}
          <CohortPicker
            suppliers={suppliers}
            selectedSuppliers={config.suppliers}
            onSupplierChange={handleSupplierChange}
            monthRange={config.monthRange}
            onMonthRangeChange={handleMonthRangeChange}
            className="mb-6"
          />
          
          {/* Parameter Controls */}
          <ParameterControls
            parameters={config.parameters}
            onParameterChange={handleParameterChange}
            className="mb-6"
          />
          
          {/* Insight Search */}
          <InsightSearch
            insights={insights}
            selectedInsightIds={config.insightIds}
            onInsightSelect={handleInsightSelect}
            className="mb-6"
          />
        </GlassCard>
      </aside>

      {/* Right Panel - Results */}
      <section 
        data-testid="scenario-results-panel"
        className="col-span-1 md:col-span-8 space-y-6"
        aria-label="Scenarioresultat"
      >
        {/* Progress bar */}
        {isRunning && (
          <GlassCard className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span role="status">Kör scenario...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </GlassCard>
        )}

        {/* Error display */}
        {(error || Object.keys(validationErrors).length > 0) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || Object.values(validationErrors).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Results visualization */}
        {result ? (
          <>
            <DiffVisualization 
              result={result} 
              isLoading={isRunning}
              data-testid="diff-kpis-section"
            />
            
            {/* Notes section */}
            <GlassCard className="p-4">
              <Label htmlFor="scenario-notes" className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" />
                Anteckningar
              </Label>
              <Textarea
                id="scenario-notes"
                value={config.notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Lägg till anteckningar om scenariot..."
                className="min-h-[100px]"
                disabled={readOnly}
              />
            </GlassCard>
          </>
        ) : (
          <div data-testid="results-empty-state" className="flex items-center justify-center h-96">
            <div className="text-center space-y-2 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto opacity-50" />
              <p className="text-lg">Kör ett scenario för att se resultat</p>
              <p className="text-sm">Välj leverantörer och parametrar, sedan klicka Kör Scenario</p>
            </div>
          </div>
        )}
      </section>

      {/* Footer - Action Buttons */}
      <footer 
        data-testid="scenario-footer"
        className="col-span-1 md:col-span-12"
      >
        <GlassCard variant="strong" className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button 
                onClick={handleRun}
                disabled={isRunning || readOnly}
                size="lg"
                className="min-w-[140px]"
                aria-label="Kör scenario"
              >
                <Play className="mr-2 h-4 w-4" />
                {isRunning ? 'Kör scenario...' : 'Kör Scenario'}
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={!canSave || isSaving || readOnly}
                variant="outline"
                size="lg"
                aria-label="Spara snapshot"
              >
                <Save className="mr-2 h-4 w-4" />
                Spara Snapshot
              </Button>
              
              <Button
                onClick={handleCreateInsight}
                disabled={!canCreateInsight || readOnly}
                variant="outline"
                size="lg"
                aria-label="Länka till Insights"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Länka till Insights
              </Button>
            </div>
            
            {/* Keyboard shortcuts hint */}
            <div className="text-xs text-muted-foreground hidden md:block">
              <span className="mr-3">⌘+Enter för att köra</span>
              <span className="mr-3">⌘+S för att spara</span>
              <span>Esc för att rensa fel</span>
            </div>
          </div>
        </GlassCard>
      </footer>
    </div>
  )
}