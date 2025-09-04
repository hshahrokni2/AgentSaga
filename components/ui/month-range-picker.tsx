'use client'

import * as React from 'react'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface MonthRange {
  start: string
  end: string
}

interface MonthRangePickerProps {
  value?: MonthRange | null
  onChange?: (range: MonthRange | null) => void
  className?: string
  placeholder?: string
  'data-testid'?: string
}

export function MonthRangePicker({
  value,
  onChange,
  className,
  placeholder = 'Select month range',
  'data-testid': dataTestId
}: MonthRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [startMonth, setStartMonth] = React.useState(value?.start || '')
  const [endMonth, setEndMonth] = React.useState(value?.end || '')

  const handleApply = () => {
    if (startMonth && endMonth) {
      onChange?.({ start: startMonth, end: endMonth })
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setStartMonth('')
    setEndMonth('')
    onChange?.(null)
    setIsOpen(false)
  }

  const formatDisplay = () => {
    if (value?.start && value?.end) {
      return `${value.start} - ${value.end}`
    }
    return placeholder
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          data-testid={dataTestId}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {formatDisplay()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Month</label>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Month</label>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              min={startMonth}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClear}>
              Clear
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}