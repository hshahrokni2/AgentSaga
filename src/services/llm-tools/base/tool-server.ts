import { z } from 'zod'
import crypto from 'crypto'
import { EventEmitter } from 'events'

// Tool execution result types
export interface ToolResult<T = any> {
  success: boolean
  data?: T
  error?: string
  duration: number
  toolId: string
  timestamp: Date
}

// Tool proposal for dangerous operations
export interface ToolProposal {
  id: string
  tool: string
  action: string
  parameters: Record<string, any>
  impact: string
  requiresConfirmation: boolean
  confidence: number
}

// Base tool class
export abstract class BaseTool<TInput = any, TOutput = any> {
  abstract name: string
  abstract description: string
  abstract schema: z.ZodSchema<TInput>
  abstract requiresConfirmation: boolean

  // Execute tool with validation and security checks
  async execute(params: TInput, context: ToolContext): Promise<ToolResult<TOutput>> {
    const startTime = Date.now()
    const toolId = crypto.randomUUID()

    try {
      // Validate input schema
      const validated = this.schema.parse(params)
      
      // Security validation
      await this.validateSecurity(validated, context)
      
      // Check if proposal is needed
      if (this.requiresConfirmation) {
        const proposal = await this.createProposal(validated, context)
        if (!await context.confirmProposal(proposal)) {
          throw new Error('Tool execution rejected by user')
        }
      }
      
      // Execute the tool
      const result = await this.run(validated, context)
      
      // Audit log
      await context.auditLog({
        toolId,
        tool: this.name,
        params: validated,
        result,
        duration: Date.now() - startTime,
        userId: context.userId
      })
      
      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
        toolId,
        timestamp: new Date()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Audit error
      await context.auditLog({
        toolId,
        tool: this.name,
        params,
        error: errorMessage,
        duration: Date.now() - startTime,
        userId: context.userId
      })
      
      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
        toolId,
        timestamp: new Date()
      }
    }
  }

  // Override for custom security validation
  protected async validateSecurity(params: TInput, context: ToolContext): Promise<void> {
    // Default: no additional validation
  }

  // Create proposal for confirmation
  protected async createProposal(params: TInput, context: ToolContext): Promise<ToolProposal> {
    return {
      id: crypto.randomUUID(),
      tool: this.name,
      action: this.description,
      parameters: params as any,
      impact: 'This action will modify data',
      requiresConfirmation: this.requiresConfirmation,
      confidence: 0.8
    }
  }

  // Abstract method for tool implementation
  protected abstract run(params: TInput, context: ToolContext): Promise<TOutput>
}

// Tool execution context
export interface ToolContext {
  userId: string
  language: 'sv' | 'en'
  provider: 'claude' | 'gpt4' | 'gemini'
  confirmProposal: (proposal: ToolProposal) => Promise<boolean>
  auditLog: (entry: AuditEntry) => Promise<void>
  cache: Map<string, any>
  rateLimiter: RateLimiter
}

// Audit log entry
export interface AuditEntry {
  toolId: string
  tool: string
  params: any
  result?: any
  error?: string
  duration: number
  userId: string
  timestamp?: Date
}

// Rate limiter for tool execution
export class RateLimiter {
  private counts = new Map<string, number[]>()
  
  constructor(
    private maxRequestsPerMinute: number = 10,
    private maxConcurrent: number = 5
  ) {}
  
  async checkLimit(userId: string): Promise<boolean> {
    const now = Date.now()
    const userCounts = this.counts.get(userId) || []
    
    // Remove old entries (older than 1 minute)
    const recentCounts = userCounts.filter(t => now - t < 60000)
    
    if (recentCounts.length >= this.maxRequestsPerMinute) {
      return false
    }
    
    recentCounts.push(now)
    this.counts.set(userId, recentCounts)
    return true
  }
  
  async waitForSlot(userId: string): Promise<void> {
    while (!await this.checkLimit(userId)) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

// Circuit breaker for provider failover
export class CircuitBreaker {
  private failures = new Map<string, number>()
  private lastFailTime = new Map<string, number>()
  private state = new Map<string, 'closed' | 'open' | 'half-open'>()
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}
  
  isOpen(provider: string): boolean {
    const currentState = this.state.get(provider) || 'closed'
    
    if (currentState === 'open') {
      const lastFail = this.lastFailTime.get(provider) || 0
      if (Date.now() - lastFail > this.timeout) {
        this.state.set(provider, 'half-open')
        return false
      }
      return true
    }
    
    return false
  }
  
  recordSuccess(provider: string): void {
    this.failures.delete(provider)
    this.state.set(provider, 'closed')
  }
  
  recordFailure(provider: string): void {
    const failures = (this.failures.get(provider) || 0) + 1
    this.failures.set(provider, failures)
    this.lastFailTime.set(provider, Date.now())
    
    if (failures >= this.threshold) {
      this.state.set(provider, 'open')
    }
  }
}

// Tool orchestrator with provider fallback
export class ToolOrchestrator extends EventEmitter {
  private tools = new Map<string, BaseTool>()
  private providers: LLMProvider[] = []
  private circuitBreaker = new CircuitBreaker()
  private rateLimiter = new RateLimiter()
  private cache = new Map<string, any>()
  private concurrentExecutions = new Map<string, number>()
  
  constructor(
    private auditLogger: (entry: AuditEntry) => Promise<void>,
    private proposalHandler: (proposal: ToolProposal) => Promise<boolean>
  ) {
    super()
  }
  
  // Register a tool
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool)
  }
  
  // Register LLM provider
  registerProvider(provider: LLMProvider): void {
    this.providers.push(provider)
  }
  
  // Execute tool with fallback
  async executeTool(
    toolName: string,
    params: any,
    userId: string,
    language: 'sv' | 'en' = 'sv'
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`)
    }
    
    // Check rate limit
    await this.rateLimiter.waitForSlot(userId)
    
    // Check concurrent executions
    const userConcurrent = this.concurrentExecutions.get(userId) || 0
    if (userConcurrent >= 5) {
      throw new Error('Too many concurrent tool executions')
    }
    
    this.concurrentExecutions.set(userId, userConcurrent + 1)
    
    try {
      // Try each provider with circuit breaker
      for (const provider of this.providers) {
        if (this.circuitBreaker.isOpen(provider.name)) {
          continue
        }
        
        try {
          const context: ToolContext = {
            userId,
            language,
            provider: provider.name as any,
            confirmProposal: this.proposalHandler,
            auditLog: this.auditLogger,
            cache: this.cache,
            rateLimiter: this.rateLimiter
          }
          
          const result = await tool.execute(params, context)
          
          if (result.success) {
            this.circuitBreaker.recordSuccess(provider.name)
            return result
          }
        } catch (error) {
          this.circuitBreaker.recordFailure(provider.name)
          this.emit('provider-error', { provider: provider.name, error })
        }
      }
      
      throw new Error('All providers failed')
    } finally {
      const current = this.concurrentExecutions.get(userId) || 1
      this.concurrentExecutions.set(userId, Math.max(0, current - 1))
    }
  }
  
  // Execute multiple tools in parallel
  async executeParallel(
    executions: Array<{ tool: string; params: any }>,
    userId: string,
    language: 'sv' | 'en' = 'sv'
  ): Promise<ToolResult[]> {
    return Promise.all(
      executions.map(exec => 
        this.executeTool(exec.tool, exec.params, userId, language)
      )
    )
  }
  
  // Get available tools
  getAvailableTools(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description
    }))
  }
}

// LLM Provider interface
export interface LLMProvider {
  name: string
  execute(prompt: string, params: any): Promise<any>
  isAvailable(): Promise<boolean>
}

// Swedish formatter utility
export class SwedishFormatter {
  static formatNumber(value: number, decimals: number = 2): string {
    return value.toLocaleString('sv-SE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }
  
  static formatCurrency(value: number, currency: string = 'SEK'): string {
    return value.toLocaleString('sv-SE', {
      style: 'currency',
      currency
    })
  }
  
  static formatDate(date: Date): string {
    return date.toLocaleDateString('sv-SE')
  }
  
  static formatPercent(value: number): string {
    return value.toLocaleString('sv-SE', {
      style: 'percent',
      minimumFractionDigits: 1
    })
  }
}

// Security validator
export class SecurityValidator {
  private static SQL_INJECTION_PATTERNS = [
    /(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b|\bCREATE\b|\bALTER\b)/i,
    /(\bEXEC\b|\bEXECUTE\b)/i,
    /(\bunion\b.*\bselect\b)/i,
    /(;|--|\*|\/\*|\*\/)/,
    /(\bxp_\w+|\bsp_\w+)/i
  ]
  
  private static PII_PATTERNS = [
    /\b\d{6}[-\s]?\d{4}\b/, // Swedish personnummer
    /\b\d{10}\b/, // Compact personnummer
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ // Email
  ]
  
  static validateSQL(query: string): void {
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(query)) {
        throw new Error('SQL injection detected')
      }
    }
  }
  
  static detectPII(text: string): boolean {
    for (const pattern of this.PII_PATTERNS) {
      if (pattern.test(text)) {
        return true
      }
    }
    return false
  }
  
  static isReadOnlySQL(query: string): boolean {
    const upperQuery = query.toUpperCase().trim()
    return upperQuery.startsWith('SELECT') || 
           upperQuery.startsWith('WITH') ||
           upperQuery.startsWith('SHOW') ||
           upperQuery.startsWith('DESCRIBE')
  }
}

export { BaseTool, ToolOrchestrator, SecurityValidator, SwedishFormatter }