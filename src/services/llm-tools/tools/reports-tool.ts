import { z } from 'zod'
import { BaseTool, ToolContext, SwedishFormatter } from '../base/tool-server'

// Schema for report composition
const ReportComposeSchema = z.object({
  type: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
  title: z.string(),
  sections: z.array(z.enum([
    'summary',
    'completeness',
    'anomalies',
    'insights',
    'scenarios',
    'recommendations'
  ])),
  supplierId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  language: z.enum(['sv', 'en']),
  format: z.enum(['pdf', 'html', 'markdown']).default('pdf'),
  includeCharts: z.boolean().default(true),
  includeAppendix: z.boolean().default(false)
})

export interface Report {
  id: string
  title: string
  type: string
  language: 'sv' | 'en'
  format: 'pdf' | 'html' | 'markdown'
  sections: Array<{
    name: string
    content: string
    charts?: any[]
  }>
  metadata: {
    generatedAt: Date
    generatedBy: string
    supplierId?: string
    month: string
    fileSize?: number
    pageCount?: number
  }
  url?: string
}

export class ReportComposeTool extends BaseTool<z.infer<typeof ReportComposeSchema>, Report> {
  name = 'reports.compose'
  description = 'Generate reports with Swedish/English support'
  schema = ReportComposeSchema
  requiresConfirmation = false

  protected async run(
    params: z.infer<typeof ReportComposeSchema>,
    context: ToolContext
  ): Promise<Report> {
    const { 
      type, 
      title, 
      sections, 
      supplierId, 
      month, 
      language, 
      format,
      includeCharts,
      includeAppendix 
    } = params
    
    // Generate report ID
    const reportId = this.generateReportId()
    
    // Compose sections
    const composedSections = await this.composeSections(
      sections,
      supplierId,
      month,
      language,
      includeCharts
    )
    
    // Add appendix if requested
    if (includeAppendix) {
      composedSections.push(await this.generateAppendix(language))
    }
    
    // Generate report in requested format
    const reportUrl = await this.generateReport(
      reportId,
      title,
      composedSections,
      format,
      language
    )
    
    // Create report object
    const report: Report = {
      id: reportId,
      title,
      type,
      language,
      format,
      sections: composedSections,
      metadata: {
        generatedAt: new Date(),
        generatedBy: context.userId,
        supplierId,
        month,
        fileSize: this.estimateFileSize(composedSections, format),
        pageCount: this.estimatePageCount(composedSections)
      },
      url: reportUrl
    }
    
    return report
  }

  private generateReportId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `RPT-${timestamp}-${random}`.toUpperCase()
  }

  private async composeSections(
    sections: string[],
    supplierId: string | undefined,
    month: string,
    language: 'sv' | 'en',
    includeCharts: boolean
  ): Promise<Array<{ name: string; content: string; charts?: any[] }>> {
    const composed = []
    
    for (const section of sections) {
      const content = await this.generateSectionContent(
        section,
        supplierId,
        month,
        language
      )
      
      const charts = includeCharts 
        ? await this.generateCharts(section, supplierId, month)
        : undefined
      
      composed.push({
        name: this.getSectionName(section, language),
        content,
        charts
      })
    }
    
    return composed
  }

  private async generateSectionContent(
    section: string,
    supplierId: string | undefined,
    month: string,
    language: 'sv' | 'en'
  ): Promise<string> {
    // Generate section content based on type
    const templates = {
      summary: {
        sv: `# Sammanfattning\n\nUnder ${month} har ${supplierId || 'alla leverantörer'} visat följande resultat:\n\n- Datatäckning: 92%\n- Antal avvikelser: 15 (3 kritiska)\n- Granskningsstatus: Pågående`,
        en: `# Summary\n\nDuring ${month}, ${supplierId || 'all suppliers'} showed the following results:\n\n- Data coverage: 92%\n- Number of anomalies: 15 (3 critical)\n- Review status: In progress`
      },
      completeness: {
        sv: `## Datatäckning\n\nTotal datatäckning för perioden: **${SwedishFormatter.formatPercent(0.92)}**\n\nDetaljer per anläggning finns i bilagan.`,
        en: `## Data Coverage\n\nTotal data coverage for the period: **92.0%**\n\nDetails per facility are available in the appendix.`
      },
      anomalies: {
        sv: `## Avvikelser\n\n### Kritiska\n- Dubbletter upptäckta (3 st)\n- Saknad data för helg\n\n### Varningar\n- Ovanligt hög vikt tisdag kl 14:00`,
        en: `## Anomalies\n\n### Critical\n- Duplicates detected (3)\n- Missing weekend data\n\n### Warnings\n- Unusually high weight Tuesday at 14:00`
      },
      insights: {
        sv: `## Insikter\n\nFöljande mönster har identifierats:\n1. Ökad volym under vecka 38\n2. Säsongsmässig variation jämfört med föregående år`,
        en: `## Insights\n\nThe following patterns have been identified:\n1. Increased volume during week 38\n2. Seasonal variation compared to previous year`
      },
      scenarios: {
        sv: `## Scenarioanalys\n\nVad händer om vi justerar tröskelvärden?\n- Scenario 1: Minska anomalitröskeln → +5 flaggningar\n- Scenario 2: Öka tolerans → -2 kritiska`,
        en: `## Scenario Analysis\n\nWhat happens if we adjust thresholds?\n- Scenario 1: Lower anomaly threshold → +5 flags\n- Scenario 2: Increase tolerance → -2 critical`
      },
      recommendations: {
        sv: `## Rekommendationer\n\n1. Granska dubbletter omgående\n2. Kontakta leverantör angående helgdata\n3. Överväg justering av tröskelvärden`,
        en: `## Recommendations\n\n1. Review duplicates immediately\n2. Contact supplier regarding weekend data\n3. Consider threshold adjustments`
      }
    }
    
    return templates[section as keyof typeof templates]?.[language] || ''
  }

  private getSectionName(section: string, language: 'sv' | 'en'): string {
    const names = {
      summary: { sv: 'Sammanfattning', en: 'Summary' },
      completeness: { sv: 'Datatäckning', en: 'Data Coverage' },
      anomalies: { sv: 'Avvikelser', en: 'Anomalies' },
      insights: { sv: 'Insikter', en: 'Insights' },
      scenarios: { sv: 'Scenarioanalys', en: 'Scenario Analysis' },
      recommendations: { sv: 'Rekommendationer', en: 'Recommendations' }
    }
    
    return names[section as keyof typeof names]?.[language] || section
  }

  private async generateCharts(
    section: string,
    supplierId: string | undefined,
    month: string
  ): Promise<any[]> {
    // Mock chart generation
    if (section === 'completeness') {
      return [{
        type: 'gauge',
        title: 'Data Completeness',
        value: 0.92,
        target: 0.95
      }]
    }
    
    if (section === 'anomalies') {
      return [{
        type: 'bar',
        title: 'Anomalies by Type',
        data: {
          critical: 3,
          warning: 8,
          info: 4
        }
      }]
    }
    
    return []
  }

  private async generateAppendix(language: 'sv' | 'en'): Promise<any> {
    return {
      name: language === 'sv' ? 'Bilaga' : 'Appendix',
      content: language === 'sv' 
        ? '## Bilaga\n\nDetaljerad data och definitioner'
        : '## Appendix\n\nDetailed data and definitions'
    }
  }

  private async generateReport(
    reportId: string,
    title: string,
    sections: any[],
    format: string,
    language: 'sv' | 'en'
  ): Promise<string> {
    // Mock report generation
    // In real implementation, this would use Playwright for PDF or similar
    return `/api/reports/${reportId}.${format}`
  }

  private estimateFileSize(sections: any[], format: string): number {
    // Estimate based on content length
    const contentLength = sections.reduce((sum, s) => sum + s.content.length, 0)
    
    const multipliers = {
      pdf: 2.5,
      html: 1.2,
      markdown: 1.0
    }
    
    return Math.round(contentLength * (multipliers[format as keyof typeof multipliers] || 1))
  }

  private estimatePageCount(sections: any[]): number {
    // Rough estimate: 3000 characters per page
    const contentLength = sections.reduce((sum, s) => sum + s.content.length, 0)
    return Math.ceil(contentLength / 3000)
  }
}