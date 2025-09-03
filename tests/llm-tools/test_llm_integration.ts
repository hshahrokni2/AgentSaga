/**
 * @file test_llm_integration.ts
 * @description Integration tests for LLM tool orchestration
 * Tests provider fallback, concurrent execution, and end-to-end flows
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { LLMOrchestrator, ToolCall, ToolResponse } from '../../src/services/llm-tools/orchestrator';
import { z } from 'zod';
import { performance } from 'perf_hooks';

// Provider configuration
const PROVIDERS = [
  { name: 'claude-sonnet-4', priority: 1, timeout: 10000 },
  { name: 'gpt-4o', priority: 2, timeout: 8000 },
  { name: 'gemini-1.5-flash', priority: 3, timeout: 5000 }
];

describe('LLM Tool Integration - TDD RED Phase', () => {
  let orchestrator: LLMOrchestrator;
  let mockProviders: Map<string, any>;
  let mockTools: Map<string, any>;
  let mockLogger: any;
  let mockRateLimiter: any;

  beforeEach(() => {
    mockProviders = new Map();
    mockTools = new Map();
    
    // Mock each provider
    PROVIDERS.forEach(provider => {
      mockProviders.set(provider.name, {
        invoke: jest.fn(),
        isAvailable: jest.fn().mockResolvedValue(true),
        getMetrics: jest.fn()
      });
    });

    // Mock each tool
    ['metrics', 'warehouse', 'insights', 'scenarios', 'reports', 'explain'].forEach(tool => {
      mockTools.set(tool, {
        execute: jest.fn(),
        validate: jest.fn(),
        getSchema: jest.fn()
      });
    });

    mockRateLimiter = {
      checkLimit: jest.fn().mockResolvedValue(true),
      consume: jest.fn(),
      reset: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      audit: jest.fn(),
      performance: jest.fn()
    };

    // This will fail - orchestrator not implemented yet
    orchestrator = new LLMOrchestrator({
      providers: mockProviders,
      tools: mockTools,
      rateLimiter: mockRateLimiter,
      logger: mockLogger,
      maxConcurrent: 5
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Fallback', () => {
    test('should fallback from Claude to GPT-4o on failure', async () => {
      const claudeProvider = mockProviders.get('claude-sonnet-4')!;
      const gptProvider = mockProviders.get('gpt-4o')!;
      
      claudeProvider.invoke.mockRejectedValueOnce(new Error('Rate limit exceeded'));
      gptProvider.invoke.mockResolvedValueOnce({
        tool: 'metrics.query',
        result: { completeness: 0.92 }
      });

      const result = await orchestrator.invokeWithFallback({
        tool: 'metrics.query',
        params: { metric_type: 'completeness' }
      });

      expect(claudeProvider.invoke).toHaveBeenCalledTimes(1);
      expect(gptProvider.invoke).toHaveBeenCalledTimes(1);
      expect(result.provider_used).toBe('gpt-4o');
      expect(result.fallback_reason).toContain('Rate limit');
    });

    test('should fallback through all providers', async () => {
      // All providers fail except the last one
      mockProviders.get('claude-sonnet-4')!.invoke.mockRejectedValueOnce(new Error('Service unavailable'));
      mockProviders.get('gpt-4o')!.invoke.mockRejectedValueOnce(new Error('Timeout'));
      mockProviders.get('gemini-1.5-flash')!.invoke.mockResolvedValueOnce({
        tool: 'insights.search',
        result: { insights: [] }
      });

      const result = await orchestrator.invokeWithFallback({
        tool: 'insights.search',
        params: { query: 'test' }
      });

      expect(result.provider_used).toBe('gemini-1.5-flash');
      expect(result.fallback_chain).toEqual([
        'claude-sonnet-4',
        'gpt-4o',
        'gemini-1.5-flash'
      ]);
    });

    test('should throw when all providers fail', async () => {
      mockProviders.forEach(provider => {
        provider.invoke.mockRejectedValueOnce(new Error('Failed'));
      });

      await expect(orchestrator.invokeWithFallback({
        tool: 'warehouse.sql_read',
        params: { query: 'SELECT * FROM test' }
      })).rejects.toThrow('All providers failed');
    });

    test('should respect provider availability', async () => {
      mockProviders.get('claude-sonnet-4')!.isAvailable.mockResolvedValueOnce(false);
      mockProviders.get('gpt-4o')!.invoke.mockResolvedValueOnce({
        tool: 'metrics.query',
        result: {}
      });

      const result = await orchestrator.invokeWithFallback({
        tool: 'metrics.query',
        params: {}
      });

      expect(mockProviders.get('claude-sonnet-4')!.invoke).not.toHaveBeenCalled();
      expect(result.provider_used).toBe('gpt-4o');
    });
  });

  describe('Concurrent Tool Execution', () => {
    test('should execute multiple tools concurrently', async () => {
      const toolCalls = [
        { tool: 'metrics.query', params: { metric_type: 'completeness' } },
        { tool: 'insights.search', params: { query: 'anomaly' } },
        { tool: 'scenarios.plan', params: { name: 'test' } }
      ];

      const startTime = performance.now();
      const results = await orchestrator.executeConcurrent(toolCalls);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(3);
      expect(duration).toBeLessThan(2000); // Should be faster than sequential
    });

    test('should respect concurrency limits', async () => {
      const toolCalls = Array(10).fill(0).map((_, i) => ({
        tool: 'metrics.query',
        params: { metric_type: 'completeness', id: i }
      }));

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockTools.get('metrics')!.execute.mockImplementation(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 100));
        currentConcurrent--;
        return { status: 'success' };
      });

      await orchestrator.executeConcurrent(toolCalls);

      expect(maxConcurrent).toBeLessThanOrEqual(5); // maxConcurrent setting
    });

    test('should handle partial failures in concurrent execution', async () => {
      const toolCalls = [
        { tool: 'metrics.query', params: {} },
        { tool: 'insights.search', params: {} }, // This one will fail
        { tool: 'scenarios.plan', params: {} }
      ];

      mockTools.get('insights')!.execute.mockRejectedValueOnce(new Error('Search failed'));

      const results = await orchestrator.executeConcurrent(toolCalls);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('error');
      expect(results[1].error).toContain('Search failed');
      expect(results[2].status).toBe('success');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits per provider', async () => {
      mockRateLimiter.checkLimit.mockResolvedValueOnce(false);

      await expect(orchestrator.invokeWithFallback({
        tool: 'metrics.query',
        params: {},
        provider: 'claude-sonnet-4'
      })).rejects.toThrow('Rate limit exceeded');

      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('claude-sonnet-4');
    });

    test('should queue requests when rate limited', async () => {
      mockRateLimiter.checkLimit
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await orchestrator.invokeWithQueue({
        tool: 'metrics.query',
        params: {},
        maxRetries: 3,
        retryDelay: 100
      });

      expect(result.retries).toBe(2);
      expect(result.status).toBe('success');
    });

    test('should track rate limit metrics', async () => {
      await orchestrator.invokeWithFallback({
        tool: 'metrics.query',
        params: {}
      });

      const metrics = await orchestrator.getRateLimitMetrics();
      
      expect(metrics).toHaveProperty('requests_per_minute');
      expect(metrics).toHaveProperty('remaining_quota');
      expect(metrics).toHaveProperty('reset_time');
    });
  });

  describe('End-to-End Workflows', () => {
    test('should execute complete analysis workflow', async () => {
      const workflow = await orchestrator.executeWorkflow({
        name: 'monthly_analysis',
        steps: [
          {
            id: 'fetch_metrics',
            tool: 'metrics.query',
            params: { metric_type: 'completeness', month_range: { start: '2024-01', end: '2024-01' } }
          },
          {
            id: 'find_insights',
            tool: 'insights.search',
            params: { query: 'anomalies', filters: { month: '2024-01' } },
            depends_on: ['fetch_metrics']
          },
          {
            id: 'run_scenario',
            tool: 'scenarios.run',
            params: { name: 'baseline', parameters: { use_metrics: '${fetch_metrics.result}' } },
            depends_on: ['fetch_metrics', 'find_insights']
          },
          {
            id: 'generate_report',
            tool: 'reports.compose',
            params: {
              type: 'summary',
              sections: [
                { type: 'metrics', data: '${fetch_metrics.result}' },
                { type: 'insights', data: '${find_insights.result}' },
                { type: 'scenario', data: '${run_scenario.result}' }
              ]
            },
            depends_on: ['run_scenario']
          }
        ]
      });

      expect(workflow.status).toBe('completed');
      expect(workflow.steps_completed).toBe(4);
      expect(workflow.results.generate_report).toBeDefined();
    });

    test('should handle workflow step dependencies', async () => {
      const executionOrder: string[] = [];

      mockTools.forEach((tool, name) => {
        tool.execute.mockImplementation(async (params: any) => {
          executionOrder.push(params.step_id);
          return { status: 'success' };
        });
      });

      await orchestrator.executeWorkflow({
        name: 'dependency_test',
        steps: [
          { id: 'A', tool: 'metrics.query', params: {} },
          { id: 'B', tool: 'metrics.query', params: {}, depends_on: ['A'] },
          { id: 'C', tool: 'metrics.query', params: {}, depends_on: ['A'] },
          { id: 'D', tool: 'metrics.query', params: {}, depends_on: ['B', 'C'] }
        ]
      });

      // A must come first
      expect(executionOrder[0]).toBe('A');
      // B and C can be in any order but must come after A
      expect(executionOrder.slice(1, 3).sort()).toEqual(['B', 'C']);
      // D must come last
      expect(executionOrder[3]).toBe('D');
    });

    test('should rollback workflow on critical failure', async () => {
      mockTools.get('scenarios')!.execute.mockRejectedValueOnce(
        new Error('Critical: Invalid scenario')
      );

      const workflow = await orchestrator.executeWorkflow({
        name: 'rollback_test',
        steps: [
          { id: 'step1', tool: 'metrics.query', params: {} },
          { id: 'step2', tool: 'scenarios.run', params: {}, critical: true },
          { id: 'step3', tool: 'reports.compose', params: {} }
        ],
        rollback_on_failure: true
      });

      expect(workflow.status).toBe('rolled_back');
      expect(workflow.steps_completed).toBe(1);
      expect(workflow.rollback_reason).toContain('Critical');
    });
  });

  describe('Tool Validation', () => {
    test('should validate tool parameters against schema', async () => {
      mockTools.get('metrics')!.getSchema.mockReturnValue({
        metric_type: z.enum(['completeness', 'anomaly_burden']),
        month_range: z.object({
          start: z.string(),
          end: z.string()
        })
      });

      await expect(orchestrator.invokeWithValidation({
        tool: 'metrics.query',
        params: {
          metric_type: 'invalid_type',
          month_range: { start: '2024-01', end: '2024-01' }
        }
      })).rejects.toThrow('Schema validation failed');
    });

    test('should sanitize tool inputs', async () => {
      const result = await orchestrator.invokeWithValidation({
        tool: 'warehouse.sql_read',
        params: {
          query: "SELECT * FROM users WHERE name = '<script>alert(1)</script>'"
        }
      });

      expect(result.sanitized).toBe(true);
      expect(result.params.query).not.toContain('<script>');
    });

    test('should validate tool response format', async () => {
      mockTools.get('insights')!.execute.mockResolvedValueOnce({
        // Missing required fields
        data: []
      });

      await expect(orchestrator.invokeWithValidation({
        tool: 'insights.search',
        params: { query: 'test' },
        validate_response: true
      })).rejects.toThrow('Invalid tool response format');
    });
  });

  describe('Audit and Observability', () => {
    test('should create complete audit trail', async () => {
      await orchestrator.invokeWithFallback({
        tool: 'metrics.query',
        params: { metric_type: 'completeness' },
        context: {
          user_id: 'user123',
          session_id: 'session456',
          request_id: 'req789'
        }
      });

      expect(mockLogger.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'metrics.query',
          provider: expect.any(String),
          user_id: 'user123',
          session_id: 'session456',
          request_id: 'req789',
          timestamp: expect.any(String),
          duration_ms: expect.any(Number)
        })
      );
    });

    test('should track performance metrics', async () => {
      await orchestrator.invokeWithFallback({
        tool: 'scenarios.run',
        params: { name: 'test' }
      });

      expect(mockLogger.performance).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'scenarios.run',
          latency_ms: expect.any(Number),
          provider_latency_ms: expect.any(Number),
          queue_time_ms: expect.any(Number)
        })
      );
    });

    test('should generate tracing spans', async () => {
      const result = await orchestrator.invokeWithTracing({
        tool: 'reports.compose',
        params: { type: 'summary' }
      });

      expect(result.trace_id).toBeDefined();
      expect(result.spans).toBeInstanceOf(Array);
      expect(result.spans[0]).toHaveProperty('name');
      expect(result.spans[0]).toHaveProperty('start_time');
      expect(result.spans[0]).toHaveProperty('end_time');
    });
  });

  describe('Error Recovery', () => {
    test('should retry transient failures', async () => {
      let attempts = 0;
      mockProviders.get('claude-sonnet-4')!.invoke.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
        }
        return { tool: 'metrics.query', result: {} };
      });

      const result = await orchestrator.invokeWithRetry({
        tool: 'metrics.query',
        params: {},
        max_retries: 3,
        retry_delay: 100
      });

      expect(attempts).toBe(3);
      expect(result.status).toBe('success');
      expect(result.retries).toBe(2);
    });

    test('should use circuit breaker for failing providers', async () => {
      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        mockProviders.get('claude-sonnet-4')!.invoke.mockRejectedValueOnce(
          new Error('Service error')
        );
      }

      // After threshold, circuit should open
      const circuitStatus = await orchestrator.getCircuitStatus('claude-sonnet-4');
      expect(circuitStatus).toBe('open');

      // Should skip provider when circuit is open
      const result = await orchestrator.invokeWithFallback({
        tool: 'metrics.query',
        params: {}
      });

      expect(result.provider_used).not.toBe('claude-sonnet-4');
    });
  });

  describe('Security', () => {
    test('should detect and block PII in tool calls', async () => {
      await expect(orchestrator.invokeWithSecurity({
        tool: 'warehouse.sql_read',
        params: {
          query: 'SELECT * FROM users WHERE personnummer = "19900101-1234"'
        }
      })).rejects.toThrow('PII detected in query');
    });

    test('should enforce tool access permissions', async () => {
      await expect(orchestrator.invokeWithSecurity({
        tool: 'warehouse.sql_read',
        params: { query: 'DELETE FROM users' },
        context: {
          user_role: 'viewer'
        }
      })).rejects.toThrow('Insufficient permissions');
    });

    test('should validate authentication tokens', async () => {
      await expect(orchestrator.invokeWithSecurity({
        tool: 'scenarios.run',
        params: {},
        context: {
          auth_token: 'invalid_token'
        }
      })).rejects.toThrow('Invalid authentication');
    });
  });
});