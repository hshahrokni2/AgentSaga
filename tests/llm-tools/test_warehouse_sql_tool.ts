/**
 * @file test_warehouse_sql_tool.ts
 * @description TDD RED Phase - Failing tests for Warehouse SQL Read Tool
 * Tests SQL injection prevention, read-only enforcement, and query validation
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { WarehouseSQLTool, SQLQueryParams, SQLResponse } from '../../src/services/llm-tools/warehouse-sql-tool';
import { z } from 'zod';

// Schema definitions
const SQLQuerySchema = z.object({
  query: z.string().min(1).max(10000),
  parameters: z.record(z.any()).optional(),
  timeout_ms: z.number().min(100).max(30000).default(5000),
  max_rows: z.number().min(1).max(10000).default(1000),
  explain: z.boolean().default(false)
});

const SQLResponseSchema = z.object({
  status: z.enum(['success', 'error', 'timeout']),
  columns: z.array(z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean()
  })).optional(),
  rows: z.array(z.record(z.any())).optional(),
  row_count: z.number(),
  execution_time_ms: z.number(),
  query_plan: z.string().optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional()
});

describe('WarehouseSQLTool - TDD RED Phase', () => {
  let sqlTool: WarehouseSQLTool;
  let mockConnection: any;
  let mockValidator: any;
  let mockLogger: any;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
      close: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    };

    mockValidator = {
      validateReadOnly: jest.fn(),
      detectInjection: jest.fn(),
      sanitizeQuery: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      security: jest.fn(),
      audit: jest.fn()
    };

    // This will fail - tool not implemented yet
    sqlTool = new WarehouseSQLTool({
      connection: mockConnection,
      validator: mockValidator,
      logger: mockLogger,
      readOnly: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SQL Injection Prevention', () => {
    test('should detect and block basic SQL injection attempts', async () => {
      const maliciousQueries = [
        "SELECT * FROM users WHERE id = 1; DROP TABLE users;",
        "SELECT * FROM data WHERE name = 'test' OR '1'='1'",
        "SELECT * FROM orders; DELETE FROM orders WHERE 1=1",
        "SELECT * FROM products WHERE id = 1 UNION SELECT * FROM passwords",
        "SELECT * FROM users WHERE username = 'admin'--'"
      ];

      for (const query of maliciousQueries) {
        await expect(sqlTool.execute({ query }))
          .rejects.toThrow('SQL injection detected');
        
        expect(mockLogger.security).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'sql_injection_attempt',
            query,
            timestamp: expect.any(String)
          })
        );
      }
    });

    test('should detect encoded injection attempts', async () => {
      const encodedInjections = [
        "SELECT * FROM users WHERE id = CHAR(49) + CHAR(59) + CHAR(68) + CHAR(82) + CHAR(79) + CHAR(80)", // 1;DROP
        "SELECT * FROM data WHERE name = 0x27204F522031273D2731", // ' OR '1'='1
        "SELECT * FROM users WHERE id = %31%3B%44%52%4F%50" // URL encoded
      ];

      for (const query of encodedInjections) {
        await expect(sqlTool.execute({ query }))
          .rejects.toThrow('Encoded injection pattern detected');
      }
    });

    test('should sanitize parameters to prevent injection', async () => {
      const result = await sqlTool.execute({
        query: "SELECT * FROM suppliers WHERE name = :name AND id = :id",
        parameters: {
          name: "Test'; DROP TABLE suppliers; --",
          id: "1 OR 1=1"
        }
      });

      // Should escape special characters in parameters
      expect(mockValidator.sanitizeQuery).toHaveBeenCalled();
      expect(result.status).toBe('success');
    });
  });

  describe('Read-Only Enforcement', () => {
    test('should block all write operations', async () => {
      const writeQueries = [
        "INSERT INTO users (name) VALUES ('test')",
        "UPDATE suppliers SET status = 'active' WHERE id = 1",
        "DELETE FROM invoices WHERE date < '2020-01-01'",
        "DROP TABLE temp_data",
        "CREATE TABLE new_table (id INT)",
        "ALTER TABLE suppliers ADD COLUMN notes TEXT",
        "TRUNCATE TABLE logs",
        "MERGE INTO target USING source ON target.id = source.id"
      ];

      for (const query of writeQueries) {
        await expect(sqlTool.execute({ query }))
          .rejects.toThrow('Write operation not allowed in read-only mode');
      }
    });

    test('should block transaction control statements', async () => {
      const transactionQueries = [
        "BEGIN TRANSACTION",
        "COMMIT",
        "ROLLBACK",
        "SAVEPOINT sp1",
        "RELEASE SAVEPOINT sp1"
      ];

      for (const query of transactionQueries) {
        await expect(sqlTool.execute({ query }))
          .rejects.toThrow('Transaction control not allowed');
      }
    });

    test('should allow SELECT queries with JOINs and subqueries', async () => {
      const validQueries = [
        "SELECT * FROM suppliers s JOIN invoices i ON s.id = i.supplier_id",
        "SELECT name, (SELECT COUNT(*) FROM invoices WHERE supplier_id = s.id) as invoice_count FROM suppliers s",
        "WITH monthly_totals AS (SELECT * FROM invoices) SELECT * FROM monthly_totals",
        "SELECT * FROM suppliers WHERE id IN (SELECT supplier_id FROM invoices WHERE amount > 1000)"
      ];

      for (const query of validQueries) {
        const result = await sqlTool.execute({ query });
        expect(result.status).toBe('success');
      }
    });

    test('should detect write operations disguised in CTEs', async () => {
      const query = `
        WITH deleted AS (
          DELETE FROM suppliers WHERE inactive = true RETURNING *
        )
        SELECT * FROM deleted;
      `;

      await expect(sqlTool.execute({ query }))
        .rejects.toThrow('Write operation detected in CTE');
    });
  });

  describe('Performance and Limits', () => {
    test('should enforce query timeout', async () => {
      mockConnection.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 6000))
      );

      await expect(sqlTool.execute({
        query: "SELECT * FROM large_table",
        timeout_ms: 5000
      })).rejects.toThrow('Query execution timeout');
    });

    test('should limit result rows', async () => {
      mockConnection.query.mockResolvedValueOnce({
        rows: Array(2000).fill({ id: 1, name: 'test' }),
        rowCount: 2000
      });

      const result = await sqlTool.execute({
        query: "SELECT * FROM suppliers",
        max_rows: 1000
      });

      expect(result.rows?.length).toBe(1000);
      expect(result.warnings).toContain('Result limited to 1000 rows');
    });

    test('should provide query execution plan when requested', async () => {
      const result = await sqlTool.execute({
        query: "SELECT * FROM suppliers WHERE city = 'Stockholm'",
        explain: true
      });

      expect(result.query_plan).toBeDefined();
      expect(result.query_plan).toContain('Index Scan');
    });

    test('should handle concurrent query limits', async () => {
      const queries = Array(10).fill(0).map(() => 
        sqlTool.execute({ query: "SELECT * FROM suppliers" })
      );

      // Should queue queries if concurrent limit exceeded
      const results = await Promise.all(queries);
      expect(results.every(r => r.status === 'success')).toBe(true);
    });
  });

  describe('Data Type Handling', () => {
    test('should properly handle Swedish characters in results', async () => {
      mockConnection.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Återvinning AB', city: 'Västerås' },
          { id: 2, name: 'Städföretaget', city: 'Örebro' }
        ],
        rowCount: 2
      });

      const result = await sqlTool.execute({
        query: "SELECT * FROM suppliers WHERE city LIKE '%å%'"
      });

      expect(result.rows?.[0].name).toBe('Återvinning AB');
      expect(result.rows?.[1].city).toBe('Örebro');
    });

    test('should handle NULL values correctly', async () => {
      mockConnection.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Test', email: null, phone: null }
        ],
        rowCount: 1
      });

      const result = await sqlTool.execute({
        query: "SELECT * FROM suppliers WHERE email IS NULL"
      });

      expect(result.rows?.[0].email).toBeNull();
      expect(result.rows?.[0].phone).toBeNull();
    });

    test('should handle decimal values with Swedish formatting', async () => {
      mockConnection.query.mockResolvedValueOnce({
        rows: [
          { id: 1, amount: 1234567.89, vat_rate: 0.25 }
        ],
        rowCount: 1
      });

      const result = await sqlTool.execute({
        query: "SELECT * FROM invoices WHERE id = 1",
        parameters: { format_locale: 'sv-SE' }
      });

      // Should preserve numeric precision
      expect(result.rows?.[0].amount).toBe(1234567.89);
      expect(result.rows?.[0].vat_rate).toBe(0.25);
    });
  });

  describe('Query Validation', () => {
    test('should validate table access permissions', async () => {
      const restrictedTables = [
        'user_passwords',
        'api_keys',
        'audit_logs',
        'system_config'
      ];

      for (const table of restrictedTables) {
        await expect(sqlTool.execute({
          query: `SELECT * FROM ${table}`
        })).rejects.toThrow(`Access denied to table: ${table}`);
      }
    });

    test('should validate column-level access', async () => {
      await expect(sqlTool.execute({
        query: "SELECT personnummer FROM customers"
      })).rejects.toThrow('Access denied to sensitive column: personnummer');
    });

    test('should detect and warn about missing indexes', async () => {
      const result = await sqlTool.execute({
        query: "SELECT * FROM large_table WHERE unindexed_column = 'value'"
      });

      expect(result.warnings).toContain('Query may be slow: no index on unindexed_column');
    });

    test('should detect cartesian products', async () => {
      await expect(sqlTool.execute({
        query: "SELECT * FROM suppliers, invoices"
      })).rejects.toThrow('Cartesian product detected - please add JOIN condition');
    });
  });

  describe('Error Recovery', () => {
    test('should handle database connection errors gracefully', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await sqlTool.execute({
        query: "SELECT * FROM suppliers"
      });

      expect(result.status).toBe('error');
      expect(result.errors).toContain('Database connection error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should provide helpful error messages for syntax errors', async () => {
      mockConnection.query.mockRejectedValueOnce({
        code: '42601',
        message: 'syntax error at or near "FORM"',
        position: '8'
      });

      const result = await sqlTool.execute({
        query: "SELECT FORM suppliers"
      });

      expect(result.status).toBe('error');
      expect(result.errors?.[0]).toContain('Syntax error: Did you mean FROM?');
    });

    test('should handle out of memory errors', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('Out of memory'));

      const result = await sqlTool.execute({
        query: "SELECT * FROM huge_table",
        max_rows: 1000000
      });

      expect(result.status).toBe('error');
      expect(result.errors).toContain('Query too resource-intensive');
      expect(result.warnings).toContain('Consider adding LIMIT clause');
    });
  });

  describe('Audit and Compliance', () => {
    test('should log all queries for audit trail', async () => {
      await sqlTool.execute({
        query: "SELECT * FROM suppliers WHERE id = :id",
        parameters: { id: 123 }
      });

      expect(mockLogger.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'warehouse.sql_read',
          query_hash: expect.any(String),
          tables_accessed: ['suppliers'],
          execution_time_ms: expect.any(Number),
          row_count: expect.any(Number),
          timestamp: expect.any(String)
        })
      );
    });

    test('should detect and log PII access attempts', async () => {
      const piiColumns = ['personnummer', 'social_security', 'credit_card'];
      
      for (const column of piiColumns) {
        await sqlTool.execute({
          query: `SELECT name FROM customers` // Even without selecting PII
        });

        // Should still log if PII columns exist in accessed table
        expect(mockLogger.security).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'pii_table_accessed',
            table: 'customers',
            pii_columns: expect.arrayContaining(piiColumns)
          })
        );
      }
    });
  });
});