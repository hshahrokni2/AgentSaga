import { ToolOrchestrator, LLMProvider } from './base/tool-server'
import { MetricsTool } from './tools/metrics-tool'
import { WarehouseSQLTool } from './tools/warehouse-sql-tool'
import { 
  InsightSearchTool, 
  InsightCreateTool, 
  InsightUpdateTool, 
  InsightLinkTool 
} from './tools/insights-tool'
import { ScenarioPlanTool, ScenarioRunTool } from './tools/scenarios-tool'
import { ReportComposeTool } from './tools/reports-tool'
import { ExplainRuleTool } from './tools/explain-rule-tool'

// Claude provider
class ClaudeProvider implements LLMProvider {
  name = 'claude'
  
  async execute(prompt: string, params: any): Promise<any> {
    // Mock Claude API call
    // In real implementation, this would use Anthropic SDK
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate occasional failures for testing
        if (Math.random() < 0.1) {
          reject(new Error('Claude API timeout'))
        } else {
          resolve({ response: 'Claude response', confidence: 0.95 })
        }
      }, 100)
    })
  }
  
  async isAvailable(): Promise<boolean> {
    // Check if Claude is available
    try {
      await this.execute('test', {})
      return true
    } catch {
      return false
    }
  }
}

// GPT-4 provider
class GPT4Provider implements LLMProvider {
  name = 'gpt4'
  
  async execute(prompt: string, params: any): Promise<any> {
    // Mock OpenAI API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.05) {
          reject(new Error('GPT-4 rate limit'))
        } else {
          resolve({ response: 'GPT-4 response', confidence: 0.92 })
        }
      }, 150)
    })
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      await this.execute('test', {})
      return true
    } catch {
      return false
    }
  }
}

// Gemini provider
class GeminiProvider implements LLMProvider {
  name = 'gemini'
  
  async execute(prompt: string, params: any): Promise<any> {
    // Mock Google API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ response: 'Gemini response', confidence: 0.88 })
      }, 80)
    })
  }
  
  async isAvailable(): Promise<boolean> {
    return true // Gemini as fallback is always available
  }
}

// Audit logger implementation
class AuditLogger {
  private logs: any[] = []
  
  async log(entry: any): Promise<void> {
    this.logs.push({
      ...entry,
      timestamp: entry.timestamp || new Date()
    })
    
    // In real implementation, persist to database
    console.log('[AUDIT]', entry)
  }
  
  getLogs(): any[] {
    return this.logs
  }
}

// Proposal handler implementation  
class ProposalHandler {
  private pendingProposals = new Map<string, any>()
  
  async handle(proposal: any): Promise<boolean> {
    // Store proposal
    this.pendingProposals.set(proposal.id, proposal)
    
    // In real implementation, this would:
    // 1. Send proposal to UI
    // 2. Wait for user confirmation
    // 3. Return true/false based on user action
    
    // For testing, auto-approve non-critical proposals
    if (proposal.confidence > 0.7) {
      return true
    }
    
    // Simulate user thinking time
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Random approval for testing
    return Math.random() > 0.3
  }
  
  getPendingProposals(): any[] {
    return Array.from(this.pendingProposals.values())
  }
}

// Main orchestrator factory
export function createLLMToolOrchestrator(): ToolOrchestrator {
  // Create dependencies
  const auditLogger = new AuditLogger()
  const proposalHandler = new ProposalHandler()
  
  // Create orchestrator
  const orchestrator = new ToolOrchestrator(
    (entry) => auditLogger.log(entry),
    (proposal) => proposalHandler.handle(proposal)
  )
  
  // Register all tools
  orchestrator.registerTool(new MetricsTool())
  orchestrator.registerTool(new WarehouseSQLTool())
  orchestrator.registerTool(new InsightSearchTool())
  orchestrator.registerTool(new InsightCreateTool())
  orchestrator.registerTool(new InsightUpdateTool())
  orchestrator.registerTool(new InsightLinkTool())
  orchestrator.registerTool(new ScenarioPlanTool())
  orchestrator.registerTool(new ScenarioRunTool())
  orchestrator.registerTool(new ReportComposeTool())
  orchestrator.registerTool(new ExplainRuleTool())
  
  // Register providers in fallback order
  orchestrator.registerProvider(new ClaudeProvider())
  orchestrator.registerProvider(new GPT4Provider())
  orchestrator.registerProvider(new GeminiProvider())
  
  // Set up error handling
  orchestrator.on('provider-error', ({ provider, error }) => {
    console.error(`Provider ${provider} failed:`, error)
  })
  
  return orchestrator
}

// Export types for testing
export { AuditLogger, ProposalHandler }