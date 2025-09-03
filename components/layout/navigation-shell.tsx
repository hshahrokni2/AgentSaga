'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'

export interface NavigationItem {
  id: string
  label: string
  href: string
  icon?: React.ReactNode
  badge?: number
  active?: boolean
  disabled?: boolean
}

export interface NavigationShellProps {
  items: NavigationItem[]
  children: React.ReactNode
  className?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
  onItemClick?: (item: NavigationItem) => void
  locale?: 'sv' | 'en'
  user?: {
    name: string
    role: string
    avatar?: string
  }
}

const NavigationShell = React.forwardRef<HTMLDivElement, NavigationShellProps>(
  ({
    items,
    children,
    className,
    collapsed = false,
    onToggleCollapse,
    onItemClick,
    locale = 'sv',
    user,
    ...props
  }, ref) => {
    const [isMobileOpen, setIsMobileOpen] = React.useState(false)
    const [focusedIndex, setFocusedIndex] = React.useState<number>(-1)

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => (prev + 1) % items.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case 'Home':
          e.preventDefault()
          setFocusedIndex(0)
          break
        case 'End':
          e.preventDefault()
          setFocusedIndex(items.length - 1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (items[index] && !items[index].disabled) {
            handleItemClick(items[index])
          }
          break
        case 'Escape':
          setIsMobileOpen(false)
          break
      }
    }

    const handleItemClick = (item: NavigationItem) => {
      if (!item.disabled && onItemClick) {
        onItemClick(item)
      }
      setIsMobileOpen(false) // Close mobile menu
    }

    // Focus management
    React.useEffect(() => {
      if (focusedIndex >= 0) {
        const element = document.querySelector(`[data-nav-index="${focusedIndex}"]`) as HTMLElement
        element?.focus()
      }
    }, [focusedIndex])

    const navigationContent = (
      <div className="flex flex-col h-full">
        {/* Brand/Logo */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">LEA</span>
            </div>
            {!collapsed && (
              <div>
                <div className="font-semibold text-sm">SVOA Lea</div>
                <div className="text-xs text-muted-foreground swedish-text">
                  {locale === 'sv' ? 'Datakvalitetssystem' : 'Data Quality System'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation items */}
        <nav 
          className="flex-1 p-2 overflow-y-auto" 
          role="navigation"
          aria-label={locale === 'sv' ? 'Huvudnavigering' : 'Main navigation'}
        >
          <ul className="space-y-1" role="menu">
            {items.map((item, index) => (
              <li key={item.id} role="none">
                <button
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all touch-target',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                    item.active && 'bg-primary/10 text-primary font-medium',
                    item.disabled && 'opacity-50 cursor-not-allowed',
                    collapsed && 'justify-center'
                  )}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  disabled={item.disabled}
                  aria-current={item.active ? 'page' : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  data-nav-index={index}
                  role="menuitem"
                >
                  {item.icon && (
                    <span className="w-5 h-5 flex-shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  {!collapsed && (
                    <>
                      <span className="swedish-text flex-1">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span 
                          className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center"
                          aria-label={`${item.badge} ${locale === 'sv' ? 'nya objekt' : 'new items'}`}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info */}
        {user && !collapsed && (
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate swedish-text">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate swedish-text">{user.role}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    )

    return (
      <div 
        ref={ref}
        className={cn('flex h-screen bg-background', className)}
        {...props}
      >
        {/* Skip link for accessibility */}
        <a
          href="#main-content"
          className="skip-link"
        >
          {locale === 'sv' ? 'Hoppa till huvudinnehåll' : 'Skip to main content'}
        </a>

        {/* Mobile overlay */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto',
            'bg-card border-r border-border',
            'transition-all duration-300 ease-in-out',
            collapsed ? 'w-16' : 'w-64',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
          aria-label={locale === 'sv' ? 'Sidopanel' : 'Sidebar'}
        >
          <GlassCard variant="subtle" className="h-full rounded-none border-0">
            {navigationContent}
          </GlassCard>
        </aside>

        {/* Mobile menu button */}
        <button
          className={cn(
            'fixed top-4 left-4 z-50 lg:hidden',
            'w-10 h-10 rounded-lg bg-card border border-border',
            'flex items-center justify-center',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-expanded={isMobileOpen}
          aria-controls="navigation-menu"
          aria-label={
            isMobileOpen 
              ? (locale === 'sv' ? 'Stäng meny' : 'Close menu')
              : (locale === 'sv' ? 'Öppna meny' : 'Open menu')
          }
        >
          <span className="sr-only">
            {isMobileOpen 
              ? (locale === 'sv' ? 'Stäng navigering' : 'Close navigation')
              : (locale === 'sv' ? 'Öppna navigering' : 'Open navigation')
            }
          </span>
          <svg
            className="w-5 h-5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ transform: isMobileOpen ? 'rotate(90deg)' : 'none' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isMobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>

        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            className={cn(
              'hidden lg:block fixed z-50 w-6 h-6 rounded-full',
              'bg-card border border-border shadow-md',
              'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
              'transition-all duration-300',
              collapsed ? 'left-[52px]' : 'left-[244px]'
            )}
            style={{ top: '50%', transform: 'translateY(-50%)' }}
            onClick={onToggleCollapse}
            aria-label={
              collapsed
                ? (locale === 'sv' ? 'Expandera sidopanel' : 'Expand sidebar')
                : (locale === 'sv' ? 'Kollapsa sidopanel' : 'Collapse sidebar')
            }
          >
            <svg
              className={cn('w-3 h-3 mx-auto transition-transform', collapsed ? 'rotate-180' : '')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Main content */}
        <main
          id="main-content"
          className={cn(
            'flex-1 overflow-hidden transition-all duration-300',
            'lg:ml-0', // Sidebar is positioned relative on large screens
            collapsed ? 'lg:pl-2' : 'lg:pl-2'
          )}
          role="main"
          aria-label={locale === 'sv' ? 'Huvudinnehåll' : 'Main content'}
        >
          {children}
        </main>
      </div>
    )
  }
)

NavigationShell.displayName = 'NavigationShell'

export { NavigationShell }