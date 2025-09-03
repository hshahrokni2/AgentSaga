'use client'

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  region: string
}

interface CohortPickerProps {
  suppliers: Supplier[]
  selectedSuppliers: string[]
  onSupplierChange: (supplierId: string, checked: boolean) => void
  monthRange: { start: string; end: string }
  onMonthRangeChange: (range: { start: string; end: string }) => void
  className?: string
}

export function CohortPicker({
  suppliers,
  selectedSuppliers,
  onSupplierChange,
  monthRange,
  onMonthRangeChange,
  className
}: CohortPickerProps) {
  const handleSupplierToggle = (supplierId: string, checked: boolean) => {
    onSupplierChange(supplierId, checked)
  }

  const handleMonthChange = (type: 'start' | 'end', value: string) => {
    onMonthRangeChange({
      ...monthRange,
      [type]: value
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Supplier Selection */}
      <div className="space-y-2">
        <Label htmlFor="suppliers" className="text-sm font-medium">
          Leverantörer
        </Label>
        <div 
          className="max-h-40 overflow-y-auto space-y-2 p-3 border rounded-lg bg-background/50"
          role="group"
          aria-labelledby="suppliers-label"
        >
          <span id="suppliers-label" className="sr-only">Välj leverantörer</span>
          {suppliers.map((supplier) => (
            <label
              key={supplier.id}
              className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
            >
              <Checkbox
                id={`supplier-${supplier.id}`}
                checked={selectedSuppliers.includes(supplier.id)}
                onCheckedChange={(checked) => 
                  handleSupplierToggle(supplier.id, checked as boolean)
                }
                aria-label={`Välj ${supplier.name}`}
              />
              <span className="text-sm flex-1">{supplier.name}</span>
              <span className="text-xs text-muted-foreground">{supplier.region}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Month Range Selection */}
      <div className="space-y-2">
        <Label htmlFor="month-range" className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Månadsintervall
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="month-start" className="text-xs text-muted-foreground">
              Från
            </Label>
            <input
              id="month-start"
              type="month"
              value={monthRange.start}
              onChange={(e) => handleMonthChange('start', e.target.value)}
              className="w-full px-3 py-2 bg-background/50 border rounded-md text-sm"
              aria-label="Startmånad"
            />
          </div>
          <div>
            <Label htmlFor="month-end" className="text-xs text-muted-foreground">
              Till
            </Label>
            <input
              id="month-end"
              type="month"
              value={monthRange.end}
              onChange={(e) => handleMonthChange('end', e.target.value)}
              className="w-full px-3 py-2 bg-background/50 border rounded-md text-sm"
              aria-label="Slutmånad"
            />
          </div>
        </div>
      </div>
    </div>
  )
}