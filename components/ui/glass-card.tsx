import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const glassCardVariants = cva(
  'glass-card transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'glass',
        strong: 'glass-strong hover:glass-strong',
        subtle: 'glass-subtle hover:glass',
      },
      size: {
        default: 'p-6',
        sm: 'p-4',
        lg: 'p-8',
        xl: 'p-12',
      },
      interactive: {
        true: 'cursor-pointer hover:scale-105 active:scale-95 touch-target',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      interactive: false,
    },
  }
)

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  asChild?: boolean
  'aria-label'?: string
  role?: string
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, size, interactive, asChild = false, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : 'div'
    
    // Accessibility: Set appropriate role for interactive cards
    const role = props.role || (interactive ? 'button' : undefined)
    const tabIndex = interactive ? 0 : undefined

    return (
      <Comp
        className={cn(glassCardVariants({ variant, size, interactive, className }))}
        ref={ref}
        role={role}
        tabIndex={tabIndex}
        {...props}
      />
    )
  }
)

GlassCard.displayName = 'GlassCard'

export { GlassCard, glassCardVariants }