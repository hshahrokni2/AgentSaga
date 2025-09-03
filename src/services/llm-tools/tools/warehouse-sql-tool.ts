import { z } from 'zod'
import { BaseTool, ToolContext, SecurityValidator } from '../base/tool-server'

// Schema for SQL query
const WarehouseQuerySchema = z.object({
  query: z.string().max(5000),
  params: z.array(z.any()).optional(),
  limit: z.number().min(1).max(1000).default(100),
  timeout: z.number().min(1000).max(30000).default(5000),
  format: z.enum(['json', 'csv']).default('json')
})

type WarehouseQueryInput = z.infer<typeof WarehouseQuerySchema>

export interface QueryResult {
  rows: any[]
  columns: Array<{
    name: string
    type: string
  }>
  rowCount: number
  executionTime: number
  format: 'json' | 'csv'
}

export class WarehouseSQLTool extends BaseTool<WarehouseQueryInput, QueryResult> {
  name = 'warehouse.sql_read'
  description = 'Execute read-only SQL queries on the data warehouse'
  schema = WarehouseQuerySchema
  requiresConfirmation = false

  protected async validateSecurity(
    params: WarehouseQueryInput,
    context: ToolContext
  ): Promise<void> {
    const { query } = params
    
    // Validate SQL injection
    SecurityValidator.validateSQL(query)
    
    // Ensure read-only
    if (!SecurityValidator.isReadOnlySQL(query)) {
      throw new Error('Only read-only queries are allowed')
    }
    
    // Check for PII
    if (SecurityValidator.detectPII(query)) {
      throw new Error('Query contains potential PII data')
    }
    
    // Validate table access (allowlist)
    this.validateTableAccess(query)
  }

  protected async run(
    params: WarehouseQueryInput,
    context: ToolContext
  ): Promise<QueryResult> {
    const { query, params: queryParams, limit, timeout, format } = params
    
    // Add LIMIT if not present
    const limitedQuery = this.addLimit(query, limit)
    
    // Cache key for query results
    const cacheKey = `sql:${this.hashQuery(limitedQuery)}:${JSON.stringify(queryParams)}`
    const cached = context.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 min cache
      return cached.data
    }
    
    // Execute query with timeout
    const startTime = Date.now()
    const result = await this.executeQuery(limitedQuery, queryParams, timeout)
    const executionTime = Date.now() - startTime
    
    // Format result based on requested format
    const formattedResult: QueryResult = {
      rows: result.rows,
      columns: result.columns,
      rowCount: result.rows.length,
      executionTime,
      format
    }
    
    // Handle Swedish characters in results
    if (context.language === 'sv') {
      formattedResult.rows = this.handleSwedishCharacters(result.rows)
    }
    
    // Cache result
    context.cache.set(cacheKey, { data: formattedResult, timestamp: Date.now() })
    
    return formattedResult
  }

  private validateTableAccess(query: string): void {
    // Allowlist of tables that can be queried
    const allowedTables = [
      'loads',
      'rows',
      'findings',
      'insights',
      'scenarios',
      'reports',
      'suppliers',
      'waste_types',
      'facilities'
    ]
    
    // Extract table names from query
    const tablePattern = /\b(?:FROM|JOIN)\s+(\w+)/gi
    const matches = [...query.matchAll(tablePattern)]
    
    for (const match of matches) {
      const table = match[1].toLowerCase()
      if (!allowedTables.includes(table)) {
        throw new Error(`Access denied to table: ${table}`)
      }
    }
  }

  private addLimit(query: string, limit: number): string {
    const upperQuery = query.toUpperCase()
    if (upperQuery.includes('LIMIT')) {
      return query
    }
    
    // Add LIMIT clause
    return `${query.trim().replace(/;?\s*$/, '')} LIMIT ${limit}`
  }

  private hashQuery(query: string): string {
    // Simple hash for caching
    let hash = 0
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  private async executeQuery(
    query: string,
    params: any[] | undefined,
    timeout: number
  ): Promise<{ rows: any[]; columns: any[] }> {
    // Simulated database query
    // In real implementation, this would use asyncpg or similar
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock data with Swedish characters
        resolve({
          rows: [
            { 
              supplier_id: 'SUP-001', 
              name: 'Återvinning AB', 
              total_weight: 1234.56,
              month: '2025-09'
            },
            { 
              supplier_id: 'SUP-002', 
              name: 'Miljö & Avfall', 
              total_weight: 2345.67,
              month: '2025-09'
            }
          ],
          columns: [
            { name: 'supplier_id', type: 'text' },
            { name: 'name', type: 'text' },
            { name: 'total_weight', type: 'numeric' },
            { name: 'month', type: 'text' }
          ]
        })
      }, Math.min(timeout / 10, 500)) // Simulate query time
    })
  }

  private handleSwedishCharacters(rows: any[]): any[] {
    // Ensure Swedish characters are properly handled
    return rows.map(row => {
      const newRow: any = {}
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string') {
          // Ensure åäö are preserved
          newRow[key] = value
        } else if (typeof value === 'number') {
          // Format numbers in Swedish style if needed
          newRow[key] = value
        } else {
          newRow[key] = value
        }
      }
      return newRow
    })
  }
}