'use client'

import * as React from 'react'
import { NavigationShell } from '@/components/layout/navigation-shell'
import { GlassCard } from '@/components/ui/glass-card'
import { ClearanceBar } from '@/components/dashboard/clearance-bar'
import { ConfidenceChip } from '@/components/dashboard/confidence-chip'
import { InsightCard } from '@/components/dashboard/insight-card'
import { ThemeToggle } from '@/lib/theme-provider'
import type { NavigationItem } from '@/components/layout/navigation-shell'
import type { InsightData } from '@/components/dashboard/insight-card'

// Mock navigation items
const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Översikt',
    href: '/',
    active: true,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'insights',
    label: 'Insikter',
    href: '/insights',
    badge: 12,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: 'findings',
    label: 'Fynd',
    href: '/findings',
    badge: 5,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'scenarios',
    label: 'Scenarier',
    href: '/scenarios',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Rapporter',
    href: '/reports',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

// Mock clearance data
const mockClearanceSegments = [
  { type: 'green' as const, percentage: 65.4, count: 43, label: 'Godkänd' },
  { type: 'orange' as const, percentage: 23.1, count: 15, label: 'Under granskning' },
  { type: 'red' as const, percentage: 11.5, count: 8, label: 'Kräver åtgärd' },
]

// Mock insight data
const mockInsights: InsightData[] = [
  {
    id: 'INS-2025-09-001',
    title: 'Ovanligt hög avfallsmängd under helger',
    summary: 'Upptäckt avvikelse i leveransmönster under helgdagar från leverantör ACME Avfall AB. Volymökning på 340% jämfört med normalveckor.',
    severity: 'high',
    status: 'new',
    confidence: 87,
    source: 'rule',
    createdAt: new Date('2025-09-03'),
    supplier: 'ACME Avfall AB',
    evidenceCount: 23,
    affectedRows: 156,
  },
  {
    id: 'INS-2025-09-002',
    title: 'Duplicerade transporter identifierade',
    summary: 'Systemet har identifierat 12 potentiellt duplicerade transporter inom 30-minuters fönster från samma fordon.',
    severity: 'medium',
    status: 'reviewing',
    confidence: 93,
    source: 'ml',
    createdAt: new Date('2025-09-02'),
    supplier: 'Nordisk Transport',
    evidenceCount: 12,
    affectedRows: 24,
  },
  {
    id: 'INS-2025-09-003',
    title: 'Avvikande viktförhållanden för organiskt avfall',
    summary: 'Statistisk analys visar ovanligt låga vikter för organiskt avfall kategori 20 01 08, vilket kan indikera felklassificering.',
    severity: 'low',
    status: 'validated',
    confidence: 76,
    source: 'ml',
    createdAt: new Date('2025-09-01'),
    supplier: 'Grön Återvinning',
    evidenceCount: 45,
    affectedRows: 203,
  },
]

export default function HomePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  const handleInsightClick = (insight: InsightData) => {
    console.log('Insight clicked:', insight.id)
  }

  const handleInsightAction = (action: string, insight: InsightData) => {
    console.log('Insight action:', action, insight.id)
  }

  const handleNavigationClick = (item: NavigationItem) => {
    console.log('Navigation clicked:', item.id)
  }

  const mockUser = {
    name: 'Anna Andersson',
    role: 'Kvalitetsanalytiker',
    avatar: '',
  }

  return (
    <NavigationShell
      items={navigationItems}
      collapsed={sidebarCollapsed}
      onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      onItemClick={handleNavigationClick}
      user={mockUser}
      locale="sv"
    >
      <div className="container-responsive py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold swedish-text">
              Månadsöversikt
            </h1>
            <p className="text-muted-foreground swedish-text">
              Dataöversikt för september 2025
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle locale="sv" />
          </div>
        </div>

        {/* Clearance Status */}
        <GlassCard>
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-2 swedish-text">Granskningsstatus</h2>
              <p className="text-sm text-muted-foreground swedish-text">
                Fördelning av leverantörer per godkännandestatus
              </p>
            </div>
            <ClearanceBar
              segments={mockClearanceSegments}
              showLabels
              interactive
              onSegmentClick={(segment) => console.log('Clearance segment clicked:', segment.type)}
            />
          </div>
        </GlassCard>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <GlassCard>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium swedish-text">Datatäckning</h3>
                <ConfidenceChip confidence={92} showIcon size="sm" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">89.4%</div>
                <p className="text-xs text-muted-foreground swedish-text">
                  Andel levererad data vs förväntat
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium swedish-text">Kritiska fynd</h3>
                <ConfidenceChip level="high" showIcon size="sm" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-clearance-red">8 öppna</div>
                <p className="text-xs text-muted-foreground swedish-text">
                  Fynd som kräver omedelbar åtgärd
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium swedish-text">Behandlingstid</h3>
                <ConfidenceChip level="medium" showIcon size="sm" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">2.3 dagar</div>
                <p className="text-xs text-muted-foreground swedish-text">
                  Genomsnittlig tid från fynd till lösning
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Top Insights */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold swedish-text">Viktigaste insikter</h2>
            <button className="text-sm text-primary hover:underline swedish-text">
              Visa alla insikter
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {mockInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onInsightClick={handleInsightClick}
                onActionClick={handleInsightAction}
                locale="sv"
              />
            ))}
          </div>
        </div>

        {/* Ready for Review CTA */}
        <GlassCard variant="strong" className="border-clearance-green/20 bg-clearance-green/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold swedish-text text-clearance-green">
                Redo för granskning?
              </h3>
              <p className="text-sm text-muted-foreground swedish-text">
                65% av leverantörerna har grön status. Kontrollera återstående hinder innan slutgodkännande.
              </p>
            </div>
            <button className="bg-clearance-green hover:bg-clearance-green/90 text-white px-6 py-2 rounded-lg font-medium touch-target transition-colors">
              Starta granskning
            </button>
          </div>
        </GlassCard>
      </div>
    </NavigationShell>
  )
}