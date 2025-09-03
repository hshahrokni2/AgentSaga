'use client'

import React from 'react'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Percent, Clock, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScenarioParameters {
  weightThreshold: number
  reportingThreshold: number
  startHour: number
  endHour: number
  seasonalAdjustment: boolean
  excludeHolidays: boolean
}

interface ParameterControlsProps {
  parameters: ScenarioParameters
  onParameterChange: <K extends keyof ScenarioParameters>(
    key: K, 
    value: ScenarioParameters[K]
  ) => void
  className?: string
}

export function ParameterControls({
  parameters,
  onParameterChange,
  className
}: ParameterControlsProps) {
  return (
    <Card className={cn('bg-background/50', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Parametrar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Threshold Controls */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Percent className="h-3 w-3" />
            Tröskelvärden
          </Label>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="weight-threshold" className="text-xs">
                Viktavvikelse (%)
              </Label>
              <span className="text-xs font-mono">{parameters.weightThreshold}%</span>
            </div>
            <Slider
              id="weight-threshold"
              min={0}
              max={100}
              step={5}
              value={[parameters.weightThreshold]}
              onValueChange={(value) => onParameterChange('weightThreshold', value[0])}
              aria-label="Viktavvikelse procent"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="reporting-threshold" className="text-xs">
                Rapporteringsgrad (%)
              </Label>
              <span className="text-xs font-mono">{parameters.reportingThreshold}%</span>
            </div>
            <Slider
              id="reporting-threshold"
              min={0}
              max={100}
              step={5}
              value={[parameters.reportingThreshold]}
              onValueChange={(value) => onParameterChange('reportingThreshold', value[0])}
              aria-label="Rapporteringsgrad procent"
              className="w-full"
            />
          </div>
        </div>

        {/* Operating Hours */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Arbetstider
          </Label>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="start-hour" className="text-xs">Starttid</Label>
              <input
                id="start-hour"
                type="number"
                min={0}
                max={23}
                value={parameters.startHour}
                onChange={(e) => onParameterChange('startHour', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-background border rounded text-sm"
                aria-label="Arbetstid start"
              />
            </div>
            <div>
              <Label htmlFor="end-hour" className="text-xs">Sluttid</Label>
              <input
                id="end-hour"
                type="number"
                min={0}
                max={23}
                value={parameters.endHour}
                onChange={(e) => onParameterChange('endHour', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-background border rounded text-sm"
                aria-label="Arbetstid slut"
              />
            </div>
          </div>
        </div>

        {/* Adjustments */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Justeringar
          </Label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={parameters.seasonalAdjustment}
              onChange={(e) => onParameterChange('seasonalAdjustment', e.target.checked)}
              className="rounded"
              aria-label="Säsongsjustering"
            />
            <span className="text-xs">Säsongsjustering</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={parameters.excludeHolidays}
              onChange={(e) => onParameterChange('excludeHolidays', e.target.checked)}
              className="rounded"
              aria-label="Exkludera helgdagar"
            />
            <span className="text-xs">Exkludera helgdagar</span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}