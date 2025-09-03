/**
 * @file test_metrics_tool.ts
 * @description TDD RED Phase - Failing tests for Metrics Query Tool
 * Tests KPI queries, Swedish formatting, schema validation, and performance
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { MetricsQueryTool, MetricsQueryParams, MetricsResponse } from '../../src/services/llm-tools/metrics-tool';
import { z } from 'zod';
import { performance } from 'perf_hooks';

// Schema definitions for validation
const MetricsQuerySchema = z.object({
  metric_type: z.enum(['completeness', 'anomaly_burden', 'review_progress', 'data_quality', 'volume']),
  supplier_ids: z.array(z.string()).optional(),
  month_range: z.object({
    start: z.string().regex(/^\d{4}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}$/)
  }),
  aggregation: z.enum(['sum', 'average', 'median', 'percentile']).optional(),
  group_by: z.array(z.enum(['supplier', 'month', 'category'])).optional(),
  locale: z.enum(['sv', 'en']).default('sv')
});

const MetricsResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.array(z.object({
    metric: z.string(),
    value: z.number(),
    unit: z.string().optional(),
    formatted_value: z.string(),
    period: z.string(),
    supplier_id: z.string().optional(),
    trend: z.enum(['up', 'down', 'stable']).optional(),
    confidence: z.number().min(0).max(1)
  })),
  metadata: z.object({
    query_time_ms: z.number(),
    cache_hit: z.boolean(),
    locale: z.enum(['sv', 'en'])
  }),
  errors: z.array(z.string()).optional()
});

describe('MetricsQueryTool - TDD RED Phase', () => {
  let metricsTool: MetricsQueryTool;
  let mockDatabase: any;
  let mockCache: any;
  let mockLogger: any;

  beforeEach(() => {
    // This will fail - tool not implemented yet
    metricsTool = new MetricsQueryTool({
      database: mockDatabase,
      cache: mockCache,
      logger: mockLogger,
      timeout: 5000
    });

    mockDatabase = {
      query: jest.fn(),
      close: jest.fn()
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      audit: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should validate correct input schema', async () => {
      const validParams: MetricsQueryParams = {
        metric_type: 'completeness',
        month_range: {
          start: '2024-01',
          end: '2024-12'
        },
        locale: 'sv'
      };

      const result = MetricsQuerySchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    test('should reject invalid metric types', async () => {
      const invalidParams = {
        metric_type: 'invalid_metric',
        month_range: {
          start: '2024-01',
          end: '2024-12'
        }
      };

      const result = MetricsQuerySchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    test('should reject malformed date ranges', async () => {
      const invalidParams = {
        metric_type: 'completeness',
        month_range: {
          start: '2024/01/01', // Wrong format
          end: '2024-12'
        }
      };

      const result = MetricsQuerySchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    test('should validate response schema', async () => {
      const response = await metricsTool.query({
        metric_type: 'completeness',
        month_range: { start: '2024-01', end: '2024-03' },
        locale: 'sv'
      });

      const validationResult = MetricsResponseSchema.safeParse(response);
      expect(validationResult.success).toBe(true);
    });
  });

  describe('Swedish Number Formatting', () => {
    test('should format numbers with Swedish decimal separator', async () => {
      const response = await metricsTool.query({
        metric_type: 'data_quality',
        month_range: { start: '2024-01', end: '2024-01' },
        locale: 'sv'
      });

      // Swedish uses comma as decimal separator
      expect(response.data[0].formatted_value).toMatch(/\d{1,3}(\s\d{3})*(,\d+)?/);
    });

    test('should format percentages correctly in Swedish', async () => {
      const response = await metricsTool.query({
        metric_type: 'completeness',
        month_range: { start: '2024-01', end: '2024-01' },
        locale: 'sv'
      });

      expect(response.data[0].formatted_value).toMatch(/\d{1,3}(,\d+)?\s?%/);
    });

    test('should format currency values in SEK', async () => {
      const response = await metricsTool.query({
        metric_type: 'volume',
        month_range: { start: '2024-01', end: '2024-01' },
        locale: 'sv'
      });

      expect(response.data[0].formatted_value).toMatch(/^\d{1,3}(\s\d{3})*\sSEK$/);
    });

    test('should switch to English formatting when locale is en', async () => {
      const response = await metricsTool.query({
        metric_type: 'data_quality',
        month_range: { start: '2024-01', end: '2024-01' },
        locale: 'en'
      });

      // English uses period as decimal separator
      expect(response.data[0].formatted_value).toMatch(/\d{1,3}(,\d{3})*(\.\d+)?/);
    });
  });

  describe('Performance Requirements', () => {
    test('should complete query within 5 seconds', async () => {
      const startTime = performance.now();
      
      await metricsTool.query({
        metric_type: 'anomaly_burden',
        supplier_ids: Array(100).fill(0).map((_, i) => `supplier_${i}`),
        month_range: { start: '2023-01', end: '2024-12' },
        aggregation: 'median',
        group_by: ['supplier', 'month']
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000);
    });

    test('should use cache for repeated queries', async () => {
      const params = {
        metric_type: 'completeness' as const,
        month_range: { start: '2024-01', end: '2024-01' },
        locale: 'sv' as const
      };

      // First query
      const response1 = await metricsTool.query(params);
      expect(response1.metadata.cache_hit).toBe(false);

      // Second identical query
      const response2 = await metricsTool.query(params);
      expect(response2.metadata.cache_hit).toBe(true);
      expect(mockCache.get).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenCalledTimes(1);
    });

    test('should handle timeout gracefully', async () => {
      const slowTool = new MetricsQueryTool({
        database: mockDatabase,
        cache: mockCache,
        logger: mockLogger,
        timeout: 100 // Very short timeout
      });

      mockDatabase.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(slowTool.query({
        metric_type: 'completeness',
        month_range: { start: '2024-01', end: '2024-01' }
      })).rejects.toThrow('Query timeout');
    });
  });

  describe('Data Aggregation', () => {
    test('should calculate sum aggregation correctly', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          { value: 100, supplier_id: 's1', month: '2024-01' },
          { value: 200, supplier_id: 's1', month: '2024-02' },
          { value: 150, supplier_id: 's2', month: '2024-01' }
        ]
      });

      const response = await metricsTool.query({
        metric_type: 'volume',
        month_range: { start: '2024-01', end: '2024-02' },
        aggregation: 'sum'
      });

      expect(response.data[0].value).toBe(450);
    });

    test('should calculate median correctly', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          { value: 10 },
          { value: 20 },
          { value: 30 },
          { value: 40 },
          { value: 50 }
        ]
      });

      const response = await metricsTool.query({
        metric_type: 'review_progress',
        month_range: { start: '2024-01', end: '2024-01' },
        aggregation: 'median'
      });

      expect(response.data[0].value).toBe(30);
    });

    test('should handle grouping by multiple dimensions', async () => {
      const response = await metricsTool.query({
        metric_type: 'completeness',
        month_range: { start: '2024-01', end: '2024-03' },
        group_by: ['supplier', 'month']
      });

      // Each combination should have its own entry
      const groups = response.data.map(d => `${d.supplier_id}_${d.period}`);
      expect(new Set(groups).size).toBe(groups.length);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Connection lost'));

      const response = await metricsTool.query({
        metric_type: 'completeness',
        month_range: { start: '2024-01', end: '2024-01' }
      });

      expect(response.status).toBe('error');
      expect(response.errors).toContain('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle invalid supplier IDs gracefully', async () => {
      const response = await metricsTool.query({
        metric_type: 'completeness',
        supplier_ids: ['<script>alert(1)</script>'], // SQL injection attempt
        month_range: { start: '2024-01', end: '2024-01' }
      });

      expect(response.status).toBe('error');
      expect(response.errors).toContain('Invalid supplier ID format');
    });

    test('should handle empty result sets', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const response = await metricsTool.query({
        metric_type: 'completeness',
        month_range: { start: '2024-01', end: '2024-01' }
      });

      expect(response.status).toBe('success');
      expect(response.data).toEqual([]);
    });
  });

  describe('Swedish Context Handling', () => {
    test('should recognize Swedish supplier naming patterns', async () => {
      const response = await metricsTool.query({
        metric_type: 'completeness',
        supplier_ids: ['Återvinning AB', 'Städföretaget i Örebro'],
        month_range: { start: '2024-01', end: '2024-01' },
        locale: 'sv'
      });

      expect(response.status).toBe('success');
      // Should handle åäö characters properly
    });

    test('should apply Swedish seasonal adjustments', async () => {
      const response = await metricsTool.query({
        metric_type: 'volume',
        month_range: { start: '2024-06', end: '2024-08' }, // Swedish summer
        locale: 'sv'
      });

      // Should apply summer vacation adjustments
      expect(response.data[0]).toHaveProperty('seasonal_adjustment');
    });
  });

  describe('Audit Logging', () => {
    test('should log all tool calls for audit', async () => {
      await metricsTool.query({
        metric_type: 'completeness',
        month_range: { start: '2024-01', end: '2024-01' }
      });

      expect(mockLogger.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'metrics.query',
          timestamp: expect.any(String),
          params: expect.any(Object),
          duration_ms: expect.any(Number),
          status: expect.any(String)
        })
      );
    });

    test('should include user context in audit logs', async () => {
      const context = {
        user_id: 'user123',
        session_id: 'session456',
        ip_address: '192.168.1.1'
      };

      await metricsTool.query(
        {
          metric_type: 'completeness',
          month_range: { start: '2024-01', end: '2024-01' }
        },
        context
      );

      expect(mockLogger.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          user_context: context
        })
      );
    });
  });
});