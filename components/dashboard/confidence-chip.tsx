'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const confidenceChipVariants = cva(
  'confidence-chip touch-target',
  {
    variants: {
      level: {
        high: 'bg-clearance-green text-clearance-green-foreground border-clearance-green/20',
        medium: 'bg-clearance-orange text-clearance-orange-foreground border-clearance-orange/20',
        low: 'bg-clearance-red text-clearance-red-foreground border-clearance-red/20',
        unknown: 'bg-muted text-muted-foreground border-border',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
      },
      variant: {
        default: 'border',
        solid: 'border-transparent',
        outline: 'bg-transparent border-2',
      },
    },
    defaultVariants: {
      level: 'unknown',
      size: 'md',
      variant: 'default',
    },
  }
)

export interface ConfidenceChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof confidenceChipVariants> {
  confidence?: number // 0-100
  showPercentage?: boolean
  showIcon?: boolean
  interactive?: boolean
  onConfidenceClick?: (confidence: number) => void
}

// Swedish confidence level translations
const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' | 'unknown' => {
  if (confidence >= 80) return 'high'
  if (confidence >= 60) return 'medium'
  if (confidence >= 30) return 'low'
  return 'unknown'
}

const getSwedishConfidenceText = (level: 'high' | 'medium' | 'low' | 'unknown'): string => {
  switch (level) {
    case 'high': return 'Hög'
    case 'medium': return 'Medel'  
    case 'low': return 'Låg'
    case 'unknown': return 'Okänd'
  }
}

const getEnglishConfidenceText = (level: 'high' | 'medium' | 'low' | 'unknown'): string => {
  switch (level) {
    case 'high': return 'High'
    case 'medium': return 'Medium'
    case 'low': return 'Low' 
    case 'unknown': return 'Unknown'
  }
}

// Confidence icons
const ConfidenceIcon = ({ level }: { level: 'high' | 'medium' | 'low' | 'unknown' }) => {
  const iconProps = { className: 'w-3 h-3 mr-1', 'aria-hidden': true }
  
  switch (level) {
    case 'high':
      return <span {...iconProps}>✓</span>
    case 'medium':
      return <span {...iconProps}>~</span>
    case 'low':
      return <span {...iconProps}>!</span>
    case 'unknown':
    default:
      return <span {...iconProps}>?</span>
  }
}

const ConfidenceChip = React.forwardRef<HTMLSpanElement, ConfidenceChipProps>(
  ({
    className,
    level: levelProp,
    size,
    variant,
    confidence = 0,
    showPercentage = false,
    showIcon = true,
    interactive = false,
    onConfidenceClick,
    children,
    ...props
  }, ref) => {
    const [locale] = React.useState<'sv' | 'en'>('sv') // TODO: Get from context
    
    const calculatedLevel = levelProp || getConfidenceLevel(confidence)
    const confidenceText = locale === 'sv' 
      ? getSwedishConfidenceText(calculatedLevel)
      : getEnglishConfidenceText(calculatedLevel)

    const handleClick = () => {
      if (interactive && onConfidenceClick) {
        onConfidenceClick(confidence)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleClick()
      }
    }

    const displayText = children || (
      <>
        {confidenceText}
        {showPercentage && ` (${confidence}%)`}
      </>
    )

    return (
      <span
        ref={ref}
        className={cn(
          confidenceChipVariants({ level: calculatedLevel, size, variant }),
          interactive && 'cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive 
            ? `${locale === 'sv' ? 'Konfidensgrad' : 'Confidence level'}: ${confidenceText}${showPercentage ? ` ${confidence}%` : ''}`
            : undefined
        }
        data-testid={`confidence-chip-${calculatedLevel}`}
        data-confidence={confidence}
        {...props}
      >
        <div className="flex items-center justify-center">
          {showIcon && <ConfidenceIcon level={calculatedLevel} />}
          <span className="swedish-text font-medium">
            {displayText}
          </span>
        </div>
      </span>
    )
  }
)

ConfidenceChip.displayName = 'ConfidenceChip'

export { ConfidenceChip, confidenceChipVariants }