'use client'

import * as React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  systemTheme: 'dark' | 'light'
}

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
  toggleTheme: () => null,
  systemTheme: 'light',
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'svoa-lea-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('light')
  const [mounted, setMounted] = useState(false)

  // Determine resolved theme
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    setMounted(true)

    // Get theme from localStorage or use default
    const savedTheme = localStorage.getItem(storageKey) as Theme
    if (savedTheme && ['dark', 'light', 'system'].includes(savedTheme)) {
      setTheme(savedTheme)
    }

    // Detect system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

    // Listen for system theme changes
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [storageKey])

  // Apply theme to document root
  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light'
    
    // Remove previous theme classes
    root.classList.remove('light', 'dark')
    
    // Add new theme class
    root.classList.add(resolvedTheme)
    
    // Announce theme change to screen readers
    if (previousTheme !== resolvedTheme) {
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', 'polite')
      announcement.setAttribute('aria-atomic', 'true')
      announcement.className = 'sr-only'
      announcement.textContent = `Theme changed to ${resolvedTheme === 'dark' ? 'mörkt tema' : 'ljust tema'}`
      
      document.body.appendChild(announcement)
      setTimeout(() => document.body.removeChild(announcement), 1000)
    }

    // Save theme preference
    localStorage.setItem(storageKey, theme)

    // Update meta theme-color for mobile browsers
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        'content',
        resolvedTheme === 'dark' ? '#0f172a' : '#ffffff'
      )
    } else {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = resolvedTheme === 'dark' ? '#0f172a' : '#ffffff'
      document.head.appendChild(meta)
    }

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('theme-change', { 
      detail: { theme, resolvedTheme, systemTheme }
    }))
  }, [theme, resolvedTheme, systemTheme, mounted, storageKey])

  const handleSetTheme = React.useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [])

  const toggleTheme = React.useCallback(() => {
    if (theme === 'system') {
      setTheme(systemTheme === 'dark' ? 'light' : 'dark')
    } else if (theme === 'dark') {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }, [theme, systemTheme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: handleSetTheme,
    toggleTheme,
    systemTheme,
  }

  // Prevent flash of wrong theme
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}

/**
 * Theme toggle button component
 */
export function ThemeToggle({ 
  className, 
  locale = 'sv',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { locale?: 'sv' | 'en' }) {
  const { theme, resolvedTheme, toggleTheme } = useTheme()
  
  const getAriaLabel = () => {
    const current = resolvedTheme === 'dark' 
      ? (locale === 'sv' ? 'mörkt tema' : 'dark theme')
      : (locale === 'sv' ? 'ljust tema' : 'light theme')
    
    const action = locale === 'sv' ? 'Växla från' : 'Switch from'
    return `${action} ${current}`
  }

  return (
    <button
      className={`touch-target inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
      onClick={toggleTheme}
      aria-label={getAriaLabel()}
      data-testid="theme-toggle"
      {...props}
    >
      <span className="sr-only">
        {locale === 'sv' ? 'Växla tema' : 'Toggle theme'}
      </span>
      {resolvedTheme === 'dark' ? (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  )
}