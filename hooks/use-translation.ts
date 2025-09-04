'use client'

import { useCallback, useMemo } from 'react'

const translations = {
  sv: {
    // Common
    'common.loading': 'Laddar...',
    'common.error': 'Ett fel uppstod',
    'common.copied': 'Kopierat!',
    'common.showing': 'Visar',
    'common.of': 'av',
    'common.previous': 'Föregående',
    'common.next': 'Nästa',

    // Insights
    'insights.title': 'Insikter',
    'insights.search': 'Sök insikter...',
    'insights.noResults': 'Inga insikter hittades',
    'insights.loadError': 'Kunde inte ladda insikter',
    'insights.selected': 'valda',
    'insights.selectAll': 'Välj alla',
    
    // Severity
    'insights.severity': 'Allvarlighetsgrad',
    'insights.severity.critical': 'Kritisk',
    'insights.severity.high': 'Hög',
    'insights.severity.medium': 'Medel',
    'insights.severity.low': 'Låg',
    'insights.severity.info': 'Info',
    
    // Status
    'insights.status': 'Status',
    'insights.status.new': 'Ny',
    'insights.status.reviewing': 'Granskas',
    'insights.status.validated': 'Validerad',
    'insights.status.resolved': 'Löst',
    'insights.status.false_positive': 'Falskt larm',
    
    // Actions
    'insights.id': 'ID',
    'insights.supplier': 'Leverantör',
    'insights.evidence': 'Bevis',
    'insights.actions': 'Åtgärder',
    'insights.merge': 'Slå samman',
    'insights.merged': 'Insikter sammanslagna',
    'insights.mergeFailed': 'Kunde inte slå samman insikter',
    'insights.changeStatus': 'Ändra status',
    'insights.updateFailed': 'Kunde inte uppdatera status',
    'insights.explain': 'Förklara',
    
    // Findings
    'findings.title': 'Granskningsfynd',
    'findings.search': 'Sök fynd...',
    'findings.noResults': 'Inga fynd hittades',
    'findings.loadError': 'Kunde inte ladda fynd',
    'findings.tryAgain': 'Försök igen',
    'findings.emptyState': 'Inga fynd att granska',
    'findings.refresh': 'Uppdatera',
    'findings.selected': 'valda',
    'findings.selectAll': 'Välj alla',
    'findings.viewMode': 'Vyläge',
    'findings.ruleView': 'Regelbaserad vy',
    'findings.clusterView': 'Klustervy',
    'findings.severity': 'Allvarlighetsgrad',
    'findings.status': 'Status',
    'findings.rule': 'Regel',
    'findings.cluster': 'Kluster',
    'findings.actions': 'Åtgärder',
    'insights.createScenario': 'Skapa scenario',
    'insights.pin': 'Fäst',
    'insights.unpin': 'Lossa',
    
    // Evidence
    'insights.evidence.rows': 'Rader',
    'insights.evidence.files': 'Filer',
    'insights.evidence.charts': 'Diagram',
    'insights.evidence.noRows': 'Inga länkade rader',
    'insights.evidence.noFiles': 'Inga länkade filer',
    'insights.evidence.noCharts': 'Inga diagram tillgängliga',
  },
  
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.copied': 'Copied!',
    'common.showing': 'Showing',
    'common.of': 'of',
    'common.previous': 'Previous',
    'common.next': 'Next',

    // Insights
    'insights.title': 'Insights',
    'insights.search': 'Search insights...',
    'insights.noResults': 'No insights found',
    'insights.loadError': 'Failed to load insights',
    'insights.selected': 'selected',
    'insights.selectAll': 'Select all',
    
    // Severity
    'insights.severity': 'Severity',
    'insights.severity.critical': 'Critical',
    'insights.severity.high': 'High',
    'insights.severity.medium': 'Medium',
    'insights.severity.low': 'Low',
    'insights.severity.info': 'Info',
    
    // Status
    'insights.status': 'Status',
    'insights.status.new': 'New',
    'insights.status.reviewing': 'Reviewing',
    'insights.status.validated': 'Validated',
    'insights.status.resolved': 'Resolved',
    'insights.status.false_positive': 'False Positive',
    
    // Actions
    'insights.id': 'ID',
    'insights.supplier': 'Supplier',
    'insights.evidence': 'Evidence',
    'insights.actions': 'Actions',
    'insights.merge': 'Merge',
    'insights.merged': 'Insights merged',
    'insights.mergeFailed': 'Failed to merge insights',
    'insights.changeStatus': 'Change Status',
    'insights.updateFailed': 'Failed to update status',
    'insights.explain': 'Explain',
    'insights.createScenario': 'Create Scenario',
    'insights.pin': 'Pin',
    
    // Findings
    'findings.title': 'Review Findings',
    'findings.search': 'Search findings...',
    'findings.noResults': 'No findings found',
    'findings.loadError': 'Failed to load findings',
    'findings.tryAgain': 'Try again',
    'findings.emptyState': 'No findings to review',
    'findings.refresh': 'Refresh',
    'findings.selected': 'selected',
    'findings.selectAll': 'Select all',
    'findings.viewMode': 'View Mode',
    'findings.ruleView': 'Rule-based view',
    'findings.clusterView': 'Cluster view',
    'findings.severity': 'Severity',
    'findings.status': 'Status',
    'findings.rule': 'Rule',
    'findings.cluster': 'Cluster',
    'findings.actions': 'Actions',
    'insights.unpin': 'Unpin',
    
    // Evidence
    'insights.evidence.rows': 'Rows',
    'insights.evidence.files': 'Files',
    'insights.evidence.charts': 'Charts',
    'insights.evidence.noRows': 'No linked rows',
    'insights.evidence.noFiles': 'No linked files',
    'insights.evidence.noCharts': 'No charts available',
  }
}

export function useTranslation(locale: 'sv' | 'en' = 'sv') {
  const t = useCallback((key: string): string => {
    const translation = translations[locale]?.[key as keyof typeof translations['sv']]
    return translation || key
  }, [locale])

  const tArray = useCallback((keys: string[]): string[] => {
    return keys.map(key => t(key))
  }, [t])

  const tPlural = useCallback((key: string, count: number, ...args: any[]): string => {
    const baseKey = count === 1 ? `${key}.singular` : `${key}.plural`
    let translation = t(baseKey) || t(key)
    
    // Replace placeholders
    args.forEach((arg, index) => {
      translation = translation.replace(`{${index}}`, arg.toString())
    })
    
    return translation
  }, [t])

  return useMemo(() => ({ t, tArray, tPlural }), [t, tArray, tPlural])
}