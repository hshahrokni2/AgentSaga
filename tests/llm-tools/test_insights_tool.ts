/**
 * @file test_insights_tool.ts
 * @description TDD RED Phase - Failing tests for Insights CRUD Tool
 * Tests search, create, update, link operations with Swedish/English support
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { InsightsTool, InsightParams, InsightResponse } from '../../src/services/llm-tools/insights-tool';
import { z } from 'zod';

// Schema definitions
const InsightSchema = z.object({
  id: z.string().regex(/^INS-\d{4}-\d{2}-\d{3}$/),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum(['anomaly', 'trend', 'compliance', 'performance', 'cost']),
  status: z.enum(['draft', 'active', 'resolved', 'archived']),
  confidence: z.number().min(0).max(1),
  supplier_ids: z.array(z.string()),
  period: z.object({
    start: z.string(),
    end: z.string()
  }),
  metadata: z.record(z.any()),
  linked_insights: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string(),
  locale: z.enum(['sv', 'en'])
});

describe('InsightsTool - TDD RED Phase', () => {
  let insightsTool: InsightsTool;
  let mockDatabase: any;
  let mockSearchIndex: any;
  let mockValidator: any;
  let mockLogger: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn()
    };

    mockSearchIndex = {
      search: jest.fn(),
      index: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockValidator = {
      validateInsight: jest.fn(),
      generateId: jest.fn(),
      checkDuplicates: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      audit: jest.fn()
    };

    // This will fail - tool not implemented yet
    insightsTool = new InsightsTool({
      database: mockDatabase,
      searchIndex: mockSearchIndex,
      validator: mockValidator,
      logger: mockLogger
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Insight Search', () => {
    test('should search insights by text query', async () => {
      mockSearchIndex.search.mockResolvedValueOnce([
        { id: 'INS-2024-01-001', title: 'High anomaly burden', score: 0.95 },
        { id: 'INS-2024-01-002', title: 'Seasonal variation detected', score: 0.82 }
      ]);

      const results = await insightsTool.search({
        query: 'anomaly burden',
        locale: 'en'
      });

      expect(results.insights).toHaveLength(2);
      expect(results.insights[0].score).toBeGreaterThan(results.insights[1].score);
    });

    test('should search with Swedish text and characters', async () => {
      const results = await insightsTool.search({
        query: 'hög avvikelsebörda för återvinningsföretag',
        locale: 'sv'
      });

      expect(mockSearchIndex.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('återvinningsföretag'),
          language: 'swedish'
        })
      );
    });

    test('should filter search by severity and category', async () => {
      const results = await insightsTool.search({
        query: 'compliance issues',
        filters: {
          severity: ['critical', 'high'],
          category: ['compliance'],
          status: ['active']
        }
      });

      expect(mockSearchIndex.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            severity: ['critical', 'high']
          })
        })
      );
    });

    test('should search by date range', async () => {
      const results = await insightsTool.search({
        filters: {
          date_range: {
            start: '2024-01-01',
            end: '2024-03-31'
          }
        }
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('period'),
        expect.arrayContaining(['2024-01-01', '2024-03-31'])
      );
    });

    test('should support semantic similarity search', async () => {
      const results = await insightsTool.search({
        query: 'waste collection problems',
        search_type: 'semantic',
        locale: 'en'
      });

      // Should use vector similarity search
      expect(mockSearchIndex.search).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'vector',
          embedding: expect.any(Array)
        })
      );
    });
  });

  describe('Insight Creation', () => {
    test('should create new insight with auto-generated ID', async () => {
      mockValidator.generateId.mockResolvedValueOnce('INS-2024-12-001');
      
      const newInsight = await insightsTool.create({
        title: 'New anomaly detected',
        description: 'Unusual pattern in waste collection data',
        severity: 'high',
        category: 'anomaly',
        supplier_ids: ['supplier_1', 'supplier_2'],
        confidence: 0.85,
        locale: 'en'
      });

      expect(newInsight.id).toMatch(/^INS-\d{4}-\d{2}-\d{3}$/);
      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockSearchIndex.index).toHaveBeenCalled();
    });

    test('should validate required fields on creation', async () => {
      await expect(insightsTool.create({
        title: '', // Empty title
        description: 'Test',
        severity: 'high',
        category: 'anomaly'
      })).rejects.toThrow('Title is required');

      await expect(insightsTool.create({
        title: 'Test',
        description: 'Test',
        severity: 'invalid' as any, // Invalid severity
        category: 'anomaly'
      })).rejects.toThrow('Invalid severity level');
    });

    test('should detect and prevent duplicate insights', async () => {
      mockValidator.checkDuplicates.mockResolvedValueOnce([
        { id: 'INS-2024-01-001', similarity: 0.95 }
      ]);

      await expect(insightsTool.create({
        title: 'Duplicate anomaly',
        description: 'Same as existing insight',
        severity: 'high',
        category: 'anomaly'
      })).rejects.toThrow('Similar insight already exists');
    });

    test('should create insight in Swedish', async () => {
      const newInsight = await insightsTool.create({
        title: 'Ny avvikelse upptäckt',
        description: 'Ovanligt mönster i avfallsinsamlingsdata för Västerås',
        severity: 'high',
        category: 'anomaly',
        supplier_ids: ['Återvinning AB'],
        confidence: 0.85,
        locale: 'sv'
      });

      expect(newInsight.locale).toBe('sv');
      expect(newInsight.title).toContain('avvikelse');
    });

    test('should auto-translate insights when requested', async () => {
      const insight = await insightsTool.create({
        title: 'High waste volume detected',
        description: 'Unusual increase in waste collection',
        severity: 'medium',
        category: 'trend',
        auto_translate: true,
        locale: 'en'
      });

      // Should create both English and Swedish versions
      expect(mockDatabase.insert).toHaveBeenCalledTimes(2);
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'sv',
          title: expect.stringContaining('volym')
        })
      );
    });
  });

  describe('Insight Updates', () => {
    test('should update existing insight', async () => {
      const updated = await insightsTool.update('INS-2024-01-001', {
        status: 'resolved',
        resolution: 'Issue has been addressed',
        resolved_at: new Date().toISOString()
      });

      expect(updated.status).toBe('resolved');
      expect(mockDatabase.update).toHaveBeenCalled();
      expect(mockSearchIndex.update).toHaveBeenCalled();
    });

    test('should validate update permissions', async () => {
      await expect(insightsTool.update('INS-2024-01-001', {
        status: 'resolved'
      }, {
        user_id: 'unauthorized_user',
        role: 'viewer'
      })).rejects.toThrow('Insufficient permissions to update insight');
    });

    test('should track update history', async () => {
      await insightsTool.update('INS-2024-01-001', {
        severity: 'critical',
        reason_for_change: 'Escalated due to impact'
      });

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.stringContaining('insight_history'),
        expect.objectContaining({
          insight_id: 'INS-2024-01-001',
          changes: expect.objectContaining({
            severity: { old: 'high', new: 'critical' }
          })
        })
      );
    });

    test('should prevent invalid status transitions', async () => {
      await expect(insightsTool.update('INS-2024-01-001', {
        status: 'draft' // Can't go back to draft from active
      })).rejects.toThrow('Invalid status transition');
    });
  });

  describe('Insight Linking', () => {
    test('should link related insights', async () => {
      const result = await insightsTool.link(
        'INS-2024-01-001',
        'INS-2024-01-002',
        {
          relationship_type: 'causes',
          confidence: 0.8
        }
      );

      expect(result.success).toBe(true);
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.stringContaining('insight_links'),
        expect.objectContaining({
          source_id: 'INS-2024-01-001',
          target_id: 'INS-2024-01-002',
          relationship_type: 'causes'
        })
      );
    });

    test('should prevent circular dependencies', async () => {
      // A -> B -> C -> A would create a cycle
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          { source: 'INS-2024-01-002', target: 'INS-2024-01-003' },
          { source: 'INS-2024-01-003', target: 'INS-2024-01-001' }
        ]
      });

      await expect(insightsTool.link(
        'INS-2024-01-001',
        'INS-2024-01-002',
        { relationship_type: 'causes' }
      )).rejects.toThrow('Circular dependency detected');
    });

    test('should find insight chains', async () => {
      const chain = await insightsTool.getInsightChain('INS-2024-01-001', {
        max_depth: 3,
        relationship_types: ['causes', 'relates_to']
      });

      expect(chain).toHaveProperty('root');
      expect(chain).toHaveProperty('nodes');
      expect(chain).toHaveProperty('edges');
      expect(chain.nodes.length).toBeLessThanOrEqual(10); // Reasonable limit
    });

    test('should calculate impact scores through links', async () => {
      const impact = await insightsTool.calculateImpact('INS-2024-01-001');

      expect(impact).toHaveProperty('direct_impact');
      expect(impact).toHaveProperty('indirect_impact');
      expect(impact).toHaveProperty('total_suppliers_affected');
      expect(impact.total_impact).toBeGreaterThanOrEqual(0);
      expect(impact.total_impact).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance and Caching', () => {
    test('should cache frequently accessed insights', async () => {
      // First access
      await insightsTool.get('INS-2024-01-001');
      expect(mockDatabase.query).toHaveBeenCalledTimes(1);

      // Second access should use cache
      await insightsTool.get('INS-2024-01-001');
      expect(mockDatabase.query).toHaveBeenCalledTimes(1);
    });

    test('should invalidate cache on updates', async () => {
      await insightsTool.get('INS-2024-01-001');
      
      await insightsTool.update('INS-2024-01-001', {
        status: 'resolved'
      });

      await insightsTool.get('INS-2024-01-001');
      expect(mockDatabase.query).toHaveBeenCalledTimes(2);
    });

    test('should batch operations for efficiency', async () => {
      const insights = await insightsTool.getBatch([
        'INS-2024-01-001',
        'INS-2024-01-002',
        'INS-2024-01-003'
      ]);

      // Should use single query with IN clause
      expect(mockDatabase.query).toHaveBeenCalledTimes(1);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id IN'),
        expect.any(Array)
      );
    });
  });

  describe('Export and Reporting', () => {
    test('should export insights to JSON', async () => {
      const exported = await insightsTool.export({
        format: 'json',
        filters: { status: ['active'] },
        include_metadata: true
      });

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('insights');
      expect(parsed).toHaveProperty('export_date');
      expect(parsed).toHaveProperty('total_count');
    });

    test('should export to CSV with Swedish formatting', async () => {
      const csv = await insightsTool.export({
        format: 'csv',
        locale: 'sv',
        filters: { status: ['active'] }
      });

      expect(csv).toContain('Rubrik;Allvarlighetsgrad;Status');
      expect(csv).toContain(';'); // Swedish CSV separator
    });

    test('should generate insight summary report', async () => {
      const summary = await insightsTool.generateSummary({
        period: { start: '2024-01-01', end: '2024-12-31' },
        group_by: ['severity', 'category'],
        locale: 'en'
      });

      expect(summary).toHaveProperty('total_insights');
      expect(summary).toHaveProperty('by_severity');
      expect(summary).toHaveProperty('by_category');
      expect(summary).toHaveProperty('resolution_rate');
      expect(summary).toHaveProperty('avg_time_to_resolution');
    });
  });

  describe('Audit and Compliance', () => {
    test('should log all CRUD operations', async () => {
      await insightsTool.create({
        title: 'Test insight',
        description: 'Test',
        severity: 'low',
        category: 'trend'
      });

      expect(mockLogger.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'insights.create',
          action: 'create',
          resource_type: 'insight',
          timestamp: expect.any(String)
        })
      );
    });

    test('should track data lineage', async () => {
      const lineage = await insightsTool.getLineage('INS-2024-01-001');

      expect(lineage).toHaveProperty('created_from');
      expect(lineage).toHaveProperty('data_sources');
      expect(lineage).toHaveProperty('transformations');
      expect(lineage).toHaveProperty('confidence_calculation');
    });
  });
});