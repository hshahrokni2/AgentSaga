'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ClearanceSegment {
  type: 'green' | 'orange' | 'red'
  percentage: number
  count: number
  label: string
}

export interface ClearanceBarProps {
  segments: ClearanceSegment[]
  className?: string
  showTooltips?: boolean
  showLabels?: boolean
  interactive?: boolean
  onSegmentClick?: (segment: ClearanceSegment) => void
  'aria-label'?: string
  'aria-describedby'?: string
}

const ClearanceBar = React.forwardRef<HTMLDivElement, ClearanceBarProps>(
  ({
    segments,
    className,
    showTooltips = true,
    showLabels = false,
    interactive = false,
    onSegmentClick,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    ...props
  }, ref) => {
    const [hoveredSegment, setHoveredSegment] = React.useState<number | null>(null)
    
    // Calculate total for normalization
    const total = segments.reduce((sum, segment) => sum + segment.count, 0)
    
    // Colors for each clearance type with WCAG AAA compliance
    const colors = {
      green: 'bg-clearance-green hover:bg-clearance-green-dark',
      orange: 'bg-clearance-orange hover:bg-clearance-orange-dark', 
      red: 'bg-clearance-red hover:bg-clearance-red-dark',
    }

    const handleSegmentClick = (segment: ClearanceSegment, index: number) => {
      if (interactive && onSegmentClick) {
        onSegmentClick(segment)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent, segment: ClearanceSegment, index: number) => {
      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleSegmentClick(segment, index)
      }
    }

    return (
      <div className={cn('w-full', className)} ref={ref} {...props}>
        {/* Accessible description */}
        <div className="sr-only" id={ariaDescribedBy}>
          Granskningsstatus: {segments.map(s => `${s.label}: ${s.count} (${s.percentage.toFixed(1)}%)`).join(', ')}
        </div>
        
        {/* Main clearance bar */}
        <div
          className="clearance-bar flex h-4 w-full rounded-full overflow-hidden shadow-sm"
          role="progressbar"
          aria-label={ariaLabel || "Granskningsstatus fördelning"}
          aria-describedby={ariaDescribedBy}
        >
          {segments.map((segment, index) => {
            const width = total > 0 ? (segment.count / total) * 100 : 0
            
            return (
              <div
                key={`${segment.type}-${index}`}
                className={cn(
                  'transition-all duration-200 first:rounded-l-full last:rounded-r-full',
                  colors[segment.type],
                  interactive && 'cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  hoveredSegment === index && 'z-10 scale-105'
                )}
                style={{ width: `${width}%` }}
                onClick={() => handleSegmentClick(segment, index)}
                onKeyDown={(e) => handleKeyDown(e, segment, index)}
                onMouseEnter={() => setHoveredSegment(index)}
                onMouseLeave={() => setHoveredSegment(null)}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={`${segment.label}: ${segment.count} items (${segment.percentage.toFixed(1)}%)`}
                data-testid={`clearance-segment-${segment.type}`}
              />
            )
          })}
        </div>

        {/* Labels below bar */}
        {showLabels && (
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            {segments.map((segment, index) => (
              <div key={`label-${segment.type}-${index}`} className="text-center">
                <div className={cn('inline-block w-3 h-3 rounded-full mr-1', colors[segment.type].split(' ')[0])} />
                <span className="swedish-text">{segment.label}</span>
                <div className="text-xs">
                  {segment.count} ({segment.percentage.toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tooltip */}
        {showTooltips && hoveredSegment !== null && (
          <div
            className="absolute z-50 px-2 py-1 text-xs bg-popover text-popover-foreground border rounded shadow-md transform -translate-x-1/2 mt-2"
            style={{
              left: `${segments.slice(0, hoveredSegment).reduce((acc, s) => acc + (s.count / total) * 100, 0) + 
                     ((segments[hoveredSegment]?.count || 0) / total) * 50}%`
            }}
            role="tooltip"
          >
            <div className="swedish-text font-medium">{segments[hoveredSegment]?.label}</div>
            <div>{segments[hoveredSegment]?.count} objekt ({segments[hoveredSegment]?.percentage.toFixed(1)}%)</div>
          </div>
        )}
      </div>
    )
  }
)

ClearanceBar.displayName = 'ClearanceBar'

export { ClearanceBar }