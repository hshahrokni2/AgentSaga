import { z } from 'zod'
import { BaseTool, ToolContext } from '../base/tool-server'

// Schema for rule explanation
const ExplainRuleSchema = z.object({
  ruleId: z.string(),
  targetAudience: z.enum(['technical', 'business', 'enduser']).default('business'),
  language: z.enum(['sv', 'en']),
  includeExamples: z.boolean().default(true),
  format: z.enum(['text', 'markdown', 'flowchart']).default('markdown')
})

export interface RuleExplanation {
  ruleId: string
  name: string
  explanation: string
  rationale: string
  examples?: Array<{
    input: string
    output: string
    explanation: string
  }>
  flowchart?: string
  metadata: {
    complexity: 'simple' | 'medium' | 'complex'
    category: string
    lastUpdated: Date
  }
}

export class ExplainRuleTool extends BaseTool<z.infer<typeof ExplainRuleSchema>, RuleExplanation> {
  name = 'explain.rule'
  description = 'Explain anomaly detection rules in human-readable format'
  schema = ExplainRuleSchema
  requiresConfirmation = false

  protected async run(
    params: z.infer<typeof ExplainRuleSchema>,
    context: ToolContext
  ): Promise<RuleExplanation> {
    const { ruleId, targetAudience, language, includeExamples, format } = params
    
    // Get rule details
    const rule = await this.getRule(ruleId)
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`)
    }
    
    // Generate explanation based on audience
    const explanation = this.generateExplanation(rule, targetAudience, language)
    const rationale = this.generateRationale(rule, targetAudience, language)
    
    // Generate examples if requested
    const examples = includeExamples 
      ? this.generateExamples(rule, language)
      : undefined
    
    // Generate flowchart if requested
    const flowchart = format === 'flowchart'
      ? this.generateFlowchart(rule)
      : undefined
    
    return {
      ruleId: rule.id,
      name: rule.name,
      explanation,
      rationale,
      examples,
      flowchart,
      metadata: {
        complexity: this.determineComplexity(rule),
        category: rule.category,
        lastUpdated: new Date()
      }
    }
  }

  private async getRule(ruleId: string): Promise<any> {
    // Mock rule data
    const rules: Record<string, any> = {
      'duplicate_detection': {
        id: 'duplicate_detection',
        name: 'Duplicate Invoice Detection',
        category: 'data_quality',
        logic: 'amount_match AND time_window < 30min AND weight_tolerance < 25kg',
        threshold: 0.95,
        params: {
          time_window: 30,
          weight_tolerance: 25
        }
      },
      'weekend_spike': {
        id: 'weekend_spike',
        name: 'Weekend Volume Spike',
        category: 'pattern_anomaly',
        logic: 'is_weekend AND volume > baseline * 1.15',
        threshold: 0.15,
        params: {
          spike_threshold: 1.15
        }
      },
      'operating_hours': {
        id: 'operating_hours',
        name: 'Outside Operating Hours',
        category: 'compliance',
        logic: 'time < 06:00 OR time > 19:00',
        threshold: null,
        params: {
          start_hour: 6,
          end_hour: 19
        }
      }
    }
    
    return rules[ruleId]
  }

  private generateExplanation(
    rule: any,
    audience: string,
    language: 'sv' | 'en'
  ): string {
    const explanations = {
      duplicate_detection: {
        technical: {
          sv: 'Regeln jämför SHA-256 hash av (belopp, vikt±25kg, leverantör) inom 30 minuters tidsfönster. Triggrar vid exact match med Jaro-Winkler likhet > 0.95.',
          en: 'Rule compares SHA-256 hash of (amount, weight±25kg, supplier) within 30-minute window. Triggers on exact match with Jaro-Winkler similarity > 0.95.'
        },
        business: {
          sv: 'Denna regel upptäcker när samma faktura kan ha skickats flera gånger av misstag. Den kontrollerar om två fakturor har samma belopp och vikt (inom 25 kg) inom 30 minuter.',
          en: 'This rule detects when the same invoice might have been sent multiple times by mistake. It checks if two invoices have the same amount and weight (within 25 kg) within 30 minutes.'
        },
        enduser: {
          sv: 'Systemet varnar om det verkar som att du skickat samma faktura två gånger inom en halvtimme.',
          en: 'The system warns if it seems you\'ve sent the same invoice twice within half an hour.'
        }
      },
      weekend_spike: {
        technical: {
          sv: 'Beräknar z-score för helgvolym mot 12 månaders rullande medelvärde. Flaggar om volym > μ + 0.15σ.',
          en: 'Calculates z-score for weekend volume against 12-month rolling average. Flags if volume > μ + 0.15σ.'
        },
        business: {
          sv: 'Regeln identifierar ovanligt höga volymer under helger jämfört med normala helgmönster. En ökning på mer än 15% från genomsnittet flaggas.',
          en: 'The rule identifies unusually high volumes during weekends compared to normal weekend patterns. An increase of more than 15% from average is flagged.'
        },
        enduser: {
          sv: 'Vi har upptäckt mer avfall än vanligt denna helg.',
          en: 'We\'ve detected more waste than usual this weekend.'
        }
      },
      operating_hours: {
        technical: {
          sv: 'Timestamp-validering mot CET/CEST tidzon. Kontrollerar om datetime.hour ∉ [6, 19].',
          en: 'Timestamp validation against CET/CEST timezone. Checks if datetime.hour ∉ [6, 19].'
        },
        business: {
          sv: 'Kontrollerar att leveranser sker under normal arbetstid (06:00-19:00). Aktivitet utanför dessa tider flaggas för granskning.',
          en: 'Verifies that deliveries occur during normal operating hours (06:00-19:00). Activity outside these hours is flagged for review.'
        },
        enduser: {
          sv: 'Leverans registrerad utanför normal arbetstid.',
          en: 'Delivery registered outside normal working hours.'
        }
      }
    }
    
    return explanations[rule.id]?.[audience]?.[language] || 'No explanation available'
  }

  private generateRationale(
    rule: any,
    audience: string,
    language: 'sv' | 'en'
  ): string {
    const rationales = {
      duplicate_detection: {
        sv: 'Dubbla fakturor kan leda till felaktiga betalningar och budgetavvikelser. Tidig upptäckt sparar tid och pengar.',
        en: 'Duplicate invoices can lead to incorrect payments and budget deviations. Early detection saves time and money.'
      },
      weekend_spike: {
        sv: 'Helgavvikelser kan indikera felaktig rapportering eller oauktoriserad aktivitet som kräver utredning.',
        en: 'Weekend deviations may indicate incorrect reporting or unauthorized activity requiring investigation.'
      },
      operating_hours: {
        sv: 'Säkerställer efterlevnad av arbetstidsregler och hjälper identifiera potentiella säkerhetsrisker.',
        en: 'Ensures compliance with working hour regulations and helps identify potential security risks.'
      }
    }
    
    return rationales[rule.id]?.[language] || 'Rationale not available'
  }

  private generateExamples(rule: any, language: 'sv' | 'en'): any[] {
    const examples = {
      duplicate_detection: [
        {
          input: language === 'sv' 
            ? 'Faktura #123: 10 000 kr, 1500 kg, kl 14:00\nFaktura #124: 10 000 kr, 1480 kg, kl 14:20'
            : 'Invoice #123: 10,000 SEK, 1500 kg, at 14:00\nInvoice #124: 10,000 SEK, 1480 kg, at 14:20',
          output: language === 'sv' ? '🚨 Dubblett upptäckt' : '🚨 Duplicate detected',
          explanation: language === 'sv' 
            ? 'Samma belopp, vikt inom 25 kg tolerans, inom 30 minuter'
            : 'Same amount, weight within 25 kg tolerance, within 30 minutes'
        }
      ],
      weekend_spike: [
        {
          input: language === 'sv'
            ? 'Lördag: 5000 kg (normalt: 4000 kg)'
            : 'Saturday: 5000 kg (normal: 4000 kg)',
          output: language === 'sv' ? '⚠️ Helgökning 25%' : '⚠️ Weekend increase 25%',
          explanation: language === 'sv'
            ? 'Volymen överskrider 15% tröskelvärdet'
            : 'Volume exceeds 15% threshold'
        }
      ],
      operating_hours: [
        {
          input: language === 'sv'
            ? 'Leverans registrerad kl 22:30'
            : 'Delivery registered at 22:30',
          output: language === 'sv' ? '⚠️ Utanför arbetstid' : '⚠️ Outside working hours',
          explanation: language === 'sv'
            ? 'Efter 19:00 gränsen'
            : 'After 19:00 limit'
        }
      ]
    }
    
    return examples[rule.id] || []
  }

  private generateFlowchart(rule: any): string {
    // Simple mermaid flowchart
    const charts: Record<string, string> = {
      duplicate_detection: `
graph TD
    A[New Invoice] --> B{Same Amount?}
    B -->|Yes| C{Within 30 min?}
    B -->|No| D[Pass]
    C -->|Yes| E{Weight ±25kg?}
    C -->|No| D
    E -->|Yes| F[Flag Duplicate]
    E -->|No| D
`,
      weekend_spike: `
graph TD
    A[Weekend Data] --> B[Calculate Average]
    B --> C{Volume > Avg + 15%?}
    C -->|Yes| D[Flag Spike]
    C -->|No| E[Normal]
`,
      operating_hours: `
graph TD
    A[Timestamp] --> B{06:00 - 19:00?}
    B -->|Yes| C[Valid]
    B -->|No| D[Flag Outside Hours]
`
    }
    
    return charts[rule.id] || ''
  }

  private determineComplexity(rule: any): 'simple' | 'medium' | 'complex' {
    const paramCount = Object.keys(rule.params || {}).length
    
    if (paramCount <= 1) return 'simple'
    if (paramCount <= 3) return 'medium'
    return 'complex'
  }
}