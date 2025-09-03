/**
 * @file test_explain_rule_tool.ts
 * @description TDD RED Phase - Failing tests for Rule Explanation Tool
 * Tests rule generation, multi-language explanations, and clarity
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ExplainRuleTool, RuleExplanationParams, RuleExplanation } from '../../src/services/llm-tools/explain-rule-tool';
import { z } from 'zod';

// Schema definitions
const RuleExplanationSchema = z.object({
  rule_id: z.string(),
  rule_type: z.enum(['validation', 'calculation', 'business', 'compliance', 'threshold']),
  title: z.string(),
  summary: z.string().max(500),
  detailed_explanation: z.string(),
  examples: z.array(z.object({
    scenario: z.string(),
    input: z.any(),
    output: z.any(),
    explanation: z.string()
  })),
  exceptions: z.array(z.string()).optional(),
  related_rules: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  locale: z.enum(['sv', 'en']),
  complexity: z.enum(['simple', 'moderate', 'complex'])
});

describe('ExplainRuleTool - TDD RED Phase', () => {
  let explainTool: ExplainRuleTool;
  let mockRuleEngine: any;
  let mockTranslator: any;
  let mockSimplifier: any;
  let mockLogger: any;

  beforeEach(() => {
    mockRuleEngine = {
      getRule: jest.fn(),
      evaluateRule: jest.fn(),
      getRuleDependencies: jest.fn(),
      getRuleHistory: jest.fn()
    };

    mockTranslator = {
      translate: jest.fn(),
      simplifyLanguage: jest.fn(),
      generateExamples: jest.fn()
    };

    mockSimplifier = {
      simplifyExpression: jest.fn(),
      extractVariables: jest.fn(),
      generateFlowchart: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      audit: jest.fn()
    };

    // This will fail - tool not implemented yet
    explainTool = new ExplainRuleTool({
      ruleEngine: mockRuleEngine,
      translator: mockTranslator,
      simplifier: mockSimplifier,
      logger: mockLogger
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rule Explanations', () => {
    test('should explain simple validation rule', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce({
        id: 'VAL_001',
        type: 'validation',
        expression: 'value >= 0 && value <= 1',
        description: 'Value must be between 0 and 1'
      });

      const explanation = await explainTool.explain({
        rule_id: 'VAL_001',
        locale: 'en',
        target_audience: 'business_user'
      });

      expect(explanation.rule_type).toBe('validation');
      expect(explanation.summary).toContain('between 0 and 1');
      expect(explanation.complexity).toBe('simple');
    });

    test('should explain complex calculation rule', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce({
        id: 'CALC_001',
        type: 'calculation',
        expression: 'if (seasonal_factor > 0.8) then volume * 1.2 * seasonal_factor else volume * baseline_factor',
        variables: ['volume', 'seasonal_factor', 'baseline_factor']
      });

      const explanation = await explainTool.explain({
        rule_id: 'CALC_001',
        locale: 'en',
        include_formula: true
      });

      expect(explanation.rule_type).toBe('calculation');
      expect(explanation.detailed_explanation).toContain('seasonal adjustment');
      expect(explanation.complexity).toBe('complex');
      expect(explanation.formula).toBeDefined();
    });

    test('should explain compliance rules with regulations', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce({
        id: 'GDPR_001',
        type: 'compliance',
        regulation: 'GDPR Article 17',
        requirement: 'Data must be deleted within 30 days of request'
      });

      const explanation = await explainTool.explain({
        rule_id: 'GDPR_001',
        locale: 'en',
        include_legal_references: true
      });

      expect(explanation.rule_type).toBe('compliance');
      expect(explanation.legal_references).toBeDefined();
      expect(explanation.legal_references).toContain('GDPR Article 17');
      expect(explanation.detailed_explanation).toContain('right to erasure');
    });
  });

  describe('Multi-Language Support', () => {
    test('should explain rule in Swedish', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce({
        id: 'VAL_001',
        type: 'validation',
        expression: 'completeness >= 0.9'
      });

      mockTranslator.translate.mockImplementation((text, locale) => {
        if (locale === 'sv') {
          return text
            .replace('completeness', 'fullständighet')
            .replace('must be at least', 'måste vara minst');
        }
        return text;
      });

      const explanation = await explainTool.explain({
        rule_id: 'VAL_001',
        locale: 'sv'
      });

      expect(explanation.locale).toBe('sv');
      expect(explanation.summary).toContain('fullständighet');
      expect(explanation.summary).toContain('måste vara minst');
    });

    test('should use appropriate terminology for locale', async () => {
      const explanationEN = await explainTool.explain({
        rule_id: 'CALC_001',
        locale: 'en'
      });

      const explanationSV = await explainTool.explain({
        rule_id: 'CALC_001',
        locale: 'sv'
      });

      // English uses period for decimals
      expect(explanationEN.examples[0].output).toContain('0.95');
      
      // Swedish uses comma for decimals
      expect(explanationSV.examples[0].output).toContain('0,95');
    });
  });

  describe('Example Generation', () => {
    test('should generate relevant examples', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce({
        id: 'THRESH_001',
        type: 'threshold',
        expression: 'anomaly_burden > 0.2',
        action: 'trigger_alert'
      });

      mockTranslator.generateExamples.mockResolvedValueOnce([
        {
          scenario: 'Normal operation',
          input: { anomaly_burden: 0.15 },
          output: { alert: false },
          explanation: 'No alert as burden is below threshold'
        },
        {
          scenario: 'High anomaly detected',
          input: { anomaly_burden: 0.35 },
          output: { alert: true },
          explanation: 'Alert triggered as burden exceeds 0.2'
        }
      ]);

      const explanation = await explainTool.explain({
        rule_id: 'THRESH_001',
        locale: 'en',
        num_examples: 2
      });

      expect(explanation.examples).toHaveLength(2);
      expect(explanation.examples[0].scenario).toBe('Normal operation');
      expect(explanation.examples[1].output.alert).toBe(true);
    });

    test('should generate edge case examples', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'VAL_001',
        locale: 'en',
        include_edge_cases: true
      });

      const edgeCases = explanation.examples.filter(e => 
        e.scenario.toLowerCase().includes('edge') ||
        e.scenario.toLowerCase().includes('boundary')
      );

      expect(edgeCases.length).toBeGreaterThan(0);
    });

    test('should generate counter-examples', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'CALC_001',
        locale: 'en',
        include_counter_examples: true
      });

      const counterExamples = explanation.examples.filter(e => 
        e.scenario.toLowerCase().includes('invalid') ||
        e.scenario.toLowerCase().includes('fails')
      );

      expect(counterExamples.length).toBeGreaterThan(0);
    });
  });

  describe('Rule Simplification', () => {
    test('should simplify complex expressions', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce({
        id: 'COMPLEX_001',
        expression: '((a > 0 && b < 100) || (c == true && d != null)) && (e >= 0.5 || f <= 0.2)'
      });

      mockSimplifier.simplifyExpression.mockResolvedValueOnce(
        'Either (a is positive AND b is less than 100) OR (c is true AND d has a value), AND either e is at least 0.5 OR f is at most 0.2'
      );

      const explanation = await explainTool.explain({
        rule_id: 'COMPLEX_001',
        locale: 'en',
        simplify: true
      });

      expect(explanation.simplified_version).toBeDefined();
      expect(explanation.simplified_version).not.toContain('&&');
      expect(explanation.simplified_version).not.toContain('||');
    });

    test('should provide step-by-step breakdown', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'CALC_001',
        locale: 'en',
        breakdown: true
      });

      expect(explanation.steps).toBeDefined();
      expect(explanation.steps).toBeInstanceOf(Array);
      expect(explanation.steps[0]).toHaveProperty('step_number');
      expect(explanation.steps[0]).toHaveProperty('description');
      expect(explanation.steps[0]).toHaveProperty('formula');
    });

    test('should generate visual flowchart', async () => {
      mockSimplifier.generateFlowchart.mockResolvedValueOnce({
        format: 'mermaid',
        diagram: 'graph TD; A[Start] --> B{Condition}; B -->|Yes| C[Action1]; B -->|No| D[Action2];'
      });

      const explanation = await explainTool.explain({
        rule_id: 'FLOW_001',
        locale: 'en',
        include_flowchart: true
      });

      expect(explanation.flowchart).toBeDefined();
      expect(explanation.flowchart.format).toBe('mermaid');
      expect(explanation.flowchart.diagram).toContain('graph TD');
    });
  });

  describe('Target Audience Adaptation', () => {
    test('should adapt explanation for technical users', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'CALC_001',
        locale: 'en',
        target_audience: 'technical'
      });

      expect(explanation.detailed_explanation).toContain('algorithm');
      expect(explanation.detailed_explanation).toContain('function');
      expect(explanation.includes_implementation).toBe(true);
    });

    test('should adapt explanation for business users', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'CALC_001',
        locale: 'en',
        target_audience: 'business'
      });

      expect(explanation.detailed_explanation).not.toContain('algorithm');
      expect(explanation.detailed_explanation).toContain('business impact');
      expect(explanation.includes_implementation).toBe(false);
    });

    test('should adapt explanation for auditors', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'COMP_001',
        locale: 'en',
        target_audience: 'auditor'
      });

      expect(explanation.audit_trail).toBeDefined();
      expect(explanation.compliance_mappings).toBeDefined();
      expect(explanation.detailed_explanation).toContain('compliance');
    });
  });

  describe('Rule Dependencies', () => {
    test('should explain dependent rules', async () => {
      mockRuleEngine.getRuleDependencies.mockResolvedValueOnce([
        'PREREQ_001',
        'PREREQ_002'
      ]);

      const explanation = await explainTool.explain({
        rule_id: 'DEPENDENT_001',
        locale: 'en',
        include_dependencies: true
      });

      expect(explanation.dependencies).toBeDefined();
      expect(explanation.dependencies).toHaveLength(2);
      expect(explanation.dependency_explanation).toBeDefined();
    });

    test('should explain cascading effects', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'CASCADE_001',
        locale: 'en',
        include_cascading_effects: true
      });

      expect(explanation.cascading_effects).toBeDefined();
      expect(explanation.cascading_effects).toContainEqual(
        expect.objectContaining({
          affected_rule: expect.any(String),
          impact: expect.any(String)
        })
      );
    });
  });

  describe('Historical Context', () => {
    test('should include rule change history', async () => {
      mockRuleEngine.getRuleHistory.mockResolvedValueOnce([
        {
          version: '1.0',
          date: '2024-01-01',
          change: 'Initial rule',
          reason: 'New compliance requirement'
        },
        {
          version: '1.1',
          date: '2024-06-01',
          change: 'Threshold adjusted from 0.8 to 0.9',
          reason: 'Performance optimization'
        }
      ]);

      const explanation = await explainTool.explain({
        rule_id: 'HIST_001',
        locale: 'en',
        include_history: true
      });

      expect(explanation.history).toBeDefined();
      expect(explanation.history).toHaveLength(2);
      expect(explanation.current_version).toBe('1.1');
    });

    test('should explain reason for rule existence', async () => {
      const explanation = await explainTool.explain({
        rule_id: 'REASON_001',
        locale: 'en',
        include_rationale: true
      });

      expect(explanation.rationale).toBeDefined();
      expect(explanation.business_justification).toBeDefined();
      expect(explanation.risk_mitigation).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should generate explanation within 2 seconds', async () => {
      const startTime = Date.now();
      
      await explainTool.explain({
        rule_id: 'PERF_001',
        locale: 'en',
        include_examples: true,
        include_flowchart: true
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });

    test('should cache repeated explanations', async () => {
      const params = {
        rule_id: 'CACHE_001',
        locale: 'en'
      };

      await explainTool.explain(params);
      await explainTool.explain(params);

      expect(mockRuleEngine.getRule).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent rules', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce(null);

      await expect(explainTool.explain({
        rule_id: 'NONEXISTENT_001',
        locale: 'en'
      })).rejects.toThrow('Rule not found');
    });

    test('should handle malformed rule expressions', async () => {
      mockRuleEngine.getRule.mockResolvedValueOnce({
        id: 'MALFORMED_001',
        expression: 'if (a > then b' // Missing closing parenthesis and value
      });

      const explanation = await explainTool.explain({
        rule_id: 'MALFORMED_001',
        locale: 'en'
      });

      expect(explanation.warnings).toContain('Rule expression may be malformed');
      expect(explanation.confidence).toBeLessThan(0.5);
    });
  });

  describe('Audit and Logging', () => {
    test('should log explanation requests', async () => {
      await explainTool.explain({
        rule_id: 'AUDIT_001',
        locale: 'en'
      });

      expect(mockLogger.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'explain.rule',
          rule_id: 'AUDIT_001',
          locale: 'en',
          timestamp: expect.any(String)
        })
      );
    });
  });
});