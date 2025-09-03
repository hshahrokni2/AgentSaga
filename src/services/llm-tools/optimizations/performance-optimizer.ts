import { EventEmitter } from 'events'
import { LRUCache } from 'lru-cache'
import pLimit from 'p-limit'
import { ToolResult, AuditEntry } from '../base/tool-server'

// Performance metrics collector
export class MetricsCollector extends EventEmitter {
  private metrics = new Map<string, any[]>()
  private startTimes = new Map<string, number>()
  
  startTimer(operationId: string): void {
    this.startTimes.set(operationId, Date.now())
  }
  
  endTimer(operationId: string, metadata?: any): number {
    const startTime = this.startTimes.get(operationId)
    if (!startTime) return 0
    
    const duration = Date.now() - startTime
    this.startTimes.delete(operationId)
    
    const metric = {
      operationId,
      duration,
      timestamp: new Date(),
      ...metadata
    }
    
    const key = metadata?.tool || 'general'
    const existing = this.metrics.get(key) || []
    existing.push(metric)
    this.metrics.set(key, existing)
    
    this.emit('metric', metric)
    return duration
  }
  
  getMetrics(tool?: string): any[] {
    if (tool) {
      return this.metrics.get(tool) || []
    }
    
    const allMetrics: any[] = []
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics)
    }
    return allMetrics
  }
  
  getAverageTime(tool: string): number {
    const metrics = this.metrics.get(tool) || []
    if (metrics.length === 0) return 0
    
    const total = metrics.reduce((sum, m) => sum + m.duration, 0)
    return total / metrics.length
  }
  
  getPercentile(tool: string, percentile: number): number {
    const metrics = this.metrics.get(tool) || []
    if (metrics.length === 0) return 0
    
    const sorted = metrics.map(m => m.duration).sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }
  
  reset(): void {
    this.metrics.clear()
    this.startTimes.clear()
  }
}

// Advanced caching with TTL and size limits
export class CacheManager {
  private cache: LRUCache<string, any>
  private hitCount = 0
  private missCount = 0
  
  constructor(options: {
    maxSize?: number
    ttl?: number
    updateAgeOnGet?: boolean
  } = {}) {
    this.cache = new LRUCache({
      max: options.maxSize || 500,
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      fetchMethod: async (key: string) => {
        // Async fetch if not in cache
        this.missCount++
        return null
      }
    })
  }
  
  async get(key: string): Promise<any | null> {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.hitCount++
      return value
    }
    this.missCount++
    return null
  }
  
  set(key: string, value: any, ttl?: number): void {
    this.cache.set(key, value, { ttl })
  }
  
  delete(key: string): void {
    this.cache.delete(key)
  }
  
  clear(): void {
    this.cache.clear()
    this.hitCount = 0
    this.missCount = 0
  }
  
  getStats(): {
    size: number
    hitRate: number
    hits: number
    misses: number
  } {
    const total = this.hitCount + this.missCount
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.hitCount / total : 0,
      hits: this.hitCount,
      misses: this.missCount
    }
  }
  
  // Preload cache with common queries
  async preload(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttl)
    }
  }
}

// Batch processor for aggregating requests
export class BatchProcessor<T, R> {
  private queue: Array<{
    item: T
    resolve: (value: R) => void
    reject: (error: any) => void
  }> = []
  
  private timer: NodeJS.Timeout | null = null
  
  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: {
      maxBatchSize?: number
      maxWaitTime?: number
      concurrency?: number
    } = {}
  ) {
    this.options.maxBatchSize = options.maxBatchSize || 10
    this.options.maxWaitTime = options.maxWaitTime || 100
    this.options.concurrency = options.concurrency || 3
  }
  
  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject })
      
      if (this.queue.length >= this.options.maxBatchSize!) {
        this.flush()
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.options.maxWaitTime!)
      }
    })
  }
  
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    
    if (this.queue.length === 0) return
    
    const batch = this.queue.splice(0, this.options.maxBatchSize!)
    const items = batch.map(b => b.item)
    
    try {
      const results = await this.processor(items)
      batch.forEach((b, i) => b.resolve(results[i]))
    } catch (error) {
      batch.forEach(b => b.reject(error))
    }
  }
}

// Query optimizer for database operations
export class QueryOptimizer {
  private queryPlans = new Map<string, any>()
  private queryStats = new Map<string, { count: number; totalTime: number }>()
  
  async optimize(query: string, params?: any[]): Promise<{
    optimized: string
    plan: any
  }> {
    // Generate query fingerprint
    const fingerprint = this.generateFingerprint(query)
    
    // Check if we have a cached plan
    let plan = this.queryPlans.get(fingerprint)
    
    if (!plan) {
      // Analyze query and generate optimization plan
      plan = await this.analyzeQuery(query)
      this.queryPlans.set(fingerprint, plan)
    }
    
    // Apply optimizations
    const optimized = this.applyOptimizations(query, plan)
    
    return { optimized, plan }
  }
  
  private generateFingerprint(query: string): string {
    // Remove values and normalize whitespace
    return query
      .replace(/\s+/g, ' ')
      .replace(/=\s*'[^']*'/g, '=?')
      .replace(/=\s*\d+/g, '=?')
      .toLowerCase()
      .trim()
  }
  
  private async analyzeQuery(query: string): Promise<any> {
    // Simple query analysis
    const plan = {
      hasJoin: /\bjoin\b/i.test(query),
      hasSubquery: /\bselect\b.*\bfrom\b.*\bselect\b/i.test(query),
      hasGroupBy: /\bgroup by\b/i.test(query),
      hasOrderBy: /\border by\b/i.test(query),
      estimatedCost: 1
    }
    
    // Estimate cost
    if (plan.hasJoin) plan.estimatedCost *= 2
    if (plan.hasSubquery) plan.estimatedCost *= 3
    if (plan.hasGroupBy) plan.estimatedCost *= 1.5
    
    return plan
  }
  
  private applyOptimizations(query: string, plan: any): string {
    let optimized = query
    
    // Add hints for parallel execution if beneficial
    if (plan.estimatedCost > 5 && !query.includes('/*+')) {
      optimized = `/*+ PARALLEL(4) */ ${optimized}`
    }
    
    // Ensure LIMIT clause for safety
    if (!optimized.toUpperCase().includes('LIMIT')) {
      optimized = `${optimized} LIMIT 1000`
    }
    
    return optimized
  }
  
  recordExecution(query: string, duration: number): void {
    const fingerprint = this.generateFingerprint(query)
    const stats = this.queryStats.get(fingerprint) || { count: 0, totalTime: 0 }
    
    stats.count++
    stats.totalTime += duration
    
    this.queryStats.set(fingerprint, stats)
  }
  
  getSlowQueries(threshold: number = 1000): Array<{
    query: string
    avgTime: number
    count: number
  }> {
    const slow: any[] = []
    
    for (const [fingerprint, stats] of this.queryStats.entries()) {
      const avgTime = stats.totalTime / stats.count
      if (avgTime > threshold) {
        slow.push({
          query: fingerprint,
          avgTime,
          count: stats.count
        })
      }
    }
    
    return slow.sort((a, b) => b.avgTime - a.avgTime)
  }
}

// Connection pool manager
export class ConnectionPoolManager {
  private pools = new Map<string, any>()
  private healthChecks = new Map<string, Date>()
  
  constructor(
    private options: {
      minConnections?: number
      maxConnections?: number
      idleTimeout?: number
      healthCheckInterval?: number
    } = {}
  ) {
    this.options.minConnections = options.minConnections || 2
    this.options.maxConnections = options.maxConnections || 10
    this.options.idleTimeout = options.idleTimeout || 30000
    this.options.healthCheckInterval = options.healthCheckInterval || 60000
    
    // Start health check timer
    setInterval(() => this.performHealthChecks(), this.options.healthCheckInterval)
  }
  
  async getConnection(poolName: string): Promise<any> {
    let pool = this.pools.get(poolName)
    
    if (!pool) {
      pool = await this.createPool(poolName)
      this.pools.set(poolName, pool)
    }
    
    // Get connection from pool
    return pool.acquire()
  }
  
  async releaseConnection(poolName: string, connection: any): Promise<void> {
    const pool = this.pools.get(poolName)
    if (pool) {
      await pool.release(connection)
    }
  }
  
  private async createPool(poolName: string): Promise<any> {
    // Mock pool creation
    // In real implementation, this would create actual database connection pool
    const connections: any[] = []
    const available: any[] = []
    
    for (let i = 0; i < this.options.minConnections!; i++) {
      const conn = { id: `${poolName}-${i}`, active: false }
      connections.push(conn)
      available.push(conn)
    }
    
    return {
      acquire: async () => {
        if (available.length > 0) {
          const conn = available.pop()
          conn.active = true
          return conn
        }
        
        if (connections.length < this.options.maxConnections!) {
          const conn = { 
            id: `${poolName}-${connections.length}`, 
            active: true 
          }
          connections.push(conn)
          return conn
        }
        
        // Wait for available connection
        await new Promise(resolve => setTimeout(resolve, 100))
        return this.acquire()
      },
      
      release: async (conn: any) => {
        conn.active = false
        available.push(conn)
      },
      
      size: () => connections.length,
      activeCount: () => connections.filter(c => c.active).length
    }
  }
  
  private async performHealthChecks(): Promise<void> {
    for (const [name, pool] of this.pools.entries()) {
      try {
        // Test connection
        const conn = await pool.acquire()
        await pool.release(conn)
        this.healthChecks.set(name, new Date())
      } catch (error) {
        console.error(`Health check failed for pool ${name}:`, error)
      }
    }
  }
  
  getPoolStats(): Map<string, any> {
    const stats = new Map()
    
    for (const [name, pool] of this.pools.entries()) {
      stats.set(name, {
        size: pool.size(),
        active: pool.activeCount(),
        lastHealthCheck: this.healthChecks.get(name)
      })
    }
    
    return stats
  }
}

// Smart request router with load balancing
export class RequestRouter {
  private providerLoads = new Map<string, number>()
  private providerLatencies = new Map<string, number[]>()
  
  selectProvider(providers: string[]): string {
    // Select provider with lowest load and latency
    let bestProvider = providers[0]
    let bestScore = Infinity
    
    for (const provider of providers) {
      const load = this.providerLoads.get(provider) || 0
      const latencies = this.providerLatencies.get(provider) || []
      const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 100
      
      const score = load * 100 + avgLatency
      
      if (score < bestScore) {
        bestScore = score
        bestProvider = provider
      }
    }
    
    // Update load
    this.providerLoads.set(
      bestProvider, 
      (this.providerLoads.get(bestProvider) || 0) + 1
    )
    
    return bestProvider
  }
  
  recordLatency(provider: string, latency: number): void {
    const latencies = this.providerLatencies.get(provider) || []
    latencies.push(latency)
    
    // Keep only last 10 latencies
    if (latencies.length > 10) {
      latencies.shift()
    }
    
    this.providerLatencies.set(provider, latencies)
  }
  
  releaseProvider(provider: string): void {
    const load = this.providerLoads.get(provider) || 1
    this.providerLoads.set(provider, Math.max(0, load - 1))
  }
}

// Export optimized orchestrator
export class OptimizedToolOrchestrator {
  private metrics = new MetricsCollector()
  private cache = new CacheManager({ maxSize: 1000, ttl: 5 * 60 * 1000 })
  private queryOptimizer = new QueryOptimizer()
  private connectionPool = new ConnectionPoolManager()
  private requestRouter = new RequestRouter()
  private concurrencyLimit = pLimit(5)
  
  constructor(
    private baseOrchestrator: any
  ) {
    // Set up metrics collection
    this.metrics.on('metric', (metric) => {
      if (metric.duration > 5000) {
        console.warn(`Slow operation detected: ${metric.operationId} took ${metric.duration}ms`)
      }
    })
  }
  
  async executeTool(
    tool: string,
    params: any,
    userId: string,
    language: 'sv' | 'en' = 'sv'
  ): Promise<ToolResult> {
    const operationId = `${tool}-${Date.now()}`
    this.metrics.startTimer(operationId)
    
    try {
      // Check cache first
      const cacheKey = `${tool}:${JSON.stringify(params)}`
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        return cached
      }
      
      // Execute with concurrency limit
      const result = await this.concurrencyLimit(async () => {
        return await this.baseOrchestrator.executeTool(tool, params, userId, language)
      })
      
      // Cache successful results
      if (result.success) {
        this.cache.set(cacheKey, result, 60000) // 1 minute cache
      }
      
      return result
    } finally {
      const duration = this.metrics.endTimer(operationId, { tool, userId })
      
      // Log slow operations
      if (duration > 5000) {
        console.warn(`Tool ${tool} took ${duration}ms`)
      }
    }
  }
  
  getPerformanceStats(): any {
    return {
      cache: this.cache.getStats(),
      metrics: {
        averageTimes: new Map(
          Array.from(new Set(this.metrics.getMetrics().map(m => m.tool)))
            .filter(Boolean)
            .map(tool => [tool, this.metrics.getAverageTime(tool)])
        ),
        p95Times: new Map(
          Array.from(new Set(this.metrics.getMetrics().map(m => m.tool)))
            .filter(Boolean)
            .map(tool => [tool, this.metrics.getPercentile(tool, 95)])
        )
      },
      connectionPools: this.connectionPool.getPoolStats(),
      slowQueries: this.queryOptimizer.getSlowQueries()
    }
  }
}

export {
  MetricsCollector,
  CacheManager,
  BatchProcessor,
  QueryOptimizer,
  ConnectionPoolManager,
  RequestRouter
}