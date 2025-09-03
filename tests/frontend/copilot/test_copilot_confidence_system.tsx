/**
 * @jest-environment jsdom
 * Confidence Scoring and Data Quality Tests for AI Copilot
 * RED Phase - Testing confidence chips and quality indicators
 */

import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Non-existent imports - will fail
import { ConfidenceIndicator } from '@/components/copilot/ConfidenceIndicator';
import { DataQualityBadge } from '@/components/copilot/DataQualityBadge';
import { SourceAttribution } from '@/components/copilot/SourceAttribution';
import { ConfidenceProvider } from '@/providers/confidence-provider';
import type { 
  ConfidenceScore,
  DataQuality,
  Source,
  QualityMetrics 
} from '@/components/copilot/types';

describe('Confidence Scoring System', () => {
  describe('ConfidenceIndicator Component', () => {
    test('displays confidence percentage with appropriate color', () => {
      const testCases = [
        { score: 0.95, color: 'green', label: 'Mycket säker' },
        { score: 0.75, color: 'yellow', label: 'Ganska säker' },
        { score: 0.45, color: 'orange', label: 'Osäker' },
        { score: 0.25, color: 'red', label: 'Mycket osäker' }
      ];

      testCases.forEach(({ score, color, label }) => {
        const { unmount } = render(
          <ConfidenceIndicator 
            score={score}
            locale="sv"
          />
        );

        const indicator = screen.getByRole('meter', { name: /confidence/i });
        expect(indicator).toHaveAttribute('aria-valuenow', String(score));
        expect(indicator).toHaveAttribute('aria-valuemin', '0');
        expect(indicator).toHaveAttribute('aria-valuemax', '1');
        
        const visual = screen.getByTestId('confidence-bar');
        expect(visual).toHaveClass(`bg-${color}-500`);
        expect(visual).toHaveStyle({ width: `${score * 100}%` });
        
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByText(`${Math.round(score * 100)}%`)).toBeInTheDocument();
        
        unmount();
      });
    });

    test('shows confidence breakdown on hover', async () => {
      const breakdown: ConfidenceScore = {
        overall: 0.85,
        factors: {
          dataCompleteness: 0.90,
          sourceReliability: 0.95,
          temporalRelevance: 0.75,
          crossValidation: 0.80
        },
        explanation: 'High confidence based on complete data and reliable sources'
      };

      render(
        <ConfidenceIndicator 
          score={breakdown.overall}
          breakdown={breakdown}
          locale="en"
        />
      );

      const user = userEvent.setup();
      const indicator = screen.getByRole('meter');
      
      await user.hover(indicator);
      
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      
      expect(within(tooltip).getByText(/data completeness.*90%/i)).toBeInTheDocument();
      expect(within(tooltip).getByText(/source reliability.*95%/i)).toBeInTheDocument();
      expect(within(tooltip).getByText(/temporal relevance.*75%/i)).toBeInTheDocument();
      expect(within(tooltip).getByText(/cross validation.*80%/i)).toBeInTheDocument();
      expect(within(tooltip).getByText(breakdown.explanation)).toBeInTheDocument();
    });

    test('animates confidence changes', async () => {
      const { rerender } = render(
        <ConfidenceIndicator score={0.5} animate={true} />
      );

      const bar = screen.getByTestId('confidence-bar');
      expect(bar).toHaveStyle({ width: '50%' });

      rerender(
        <ConfidenceIndicator score={0.9} animate={true} />
      );

      expect(bar).toHaveClass('transition-all', 'duration-500');
      
      await waitFor(() => {
        expect(bar).toHaveStyle({ width: '90%' });
      });
    });

    test('displays trend indicator when historical data available', () => {
      const history = [0.7, 0.75, 0.8, 0.85, 0.9];
      
      render(
        <ConfidenceIndicator 
          score={0.9}
          history={history}
          showTrend={true}
        />
      );

      const trend = screen.getByTestId('confidence-trend');
      expect(trend).toHaveClass('trend-up');
      expect(within(trend).getByTestId('arrow-up-icon')).toBeInTheDocument();
      expect(within(trend).getByText('+20%')).toBeInTheDocument();
    });

    test('supports compact and detailed view modes', () => {
      const { rerender } = render(
        <ConfidenceIndicator score={0.85} variant="compact" />
      );

      let indicator = screen.getByTestId('confidence-compact');
      expect(indicator).toHaveTextContent('85%');
      expect(indicator).toHaveClass('confidence-chip-compact');

      rerender(
        <ConfidenceIndicator score={0.85} variant="detailed" />
      );

      indicator = screen.getByTestId('confidence-detailed');
      expect(indicator.querySelector('.confidence-bar')).toBeInTheDocument();
      expect(indicator.querySelector('.confidence-label')).toBeInTheDocument();
      expect(indicator.querySelector('.confidence-percentage')).toBeInTheDocument();
    });
  });

  describe('DataQualityBadge Component', () => {
    test('displays quality metrics with icons', () => {
      const quality: DataQuality = {
        completeness: 1.0,
        accuracy: 0.95,
        consistency: 0.90,
        timeliness: 0.85,
        validity: 0.92,
        uniqueness: 1.0
      };

      render(<DataQualityBadge quality={quality} />);

      const badge = screen.getByRole('status', { name: /data quality/i });
      expect(badge).toBeInTheDocument();

      // Check for quality dimension icons
      expect(screen.getByTestId('icon-completeness')).toBeInTheDocument();
      expect(screen.getByTestId('icon-accuracy')).toBeInTheDocument();
      expect(screen.getByTestId('icon-consistency')).toBeInTheDocument();
      expect(screen.getByTestId('icon-timeliness')).toBeInTheDocument();
      expect(screen.getByTestId('icon-validity')).toBeInTheDocument();
      expect(screen.getByTestId('icon-uniqueness')).toBeInTheDocument();

      // Check overall score calculation
      const overallScore = Object.values(quality).reduce((a, b) => a + b) / 6;
      expect(screen.getByText(`${Math.round(overallScore * 100)}%`)).toBeInTheDocument();
    });

    test('shows quality issues with warnings', () => {
      const quality: DataQuality = {
        completeness: 0.6, // Low
        accuracy: 0.95,
        consistency: 0.5, // Low
        timeliness: 0.9,
        validity: 0.92,
        uniqueness: 1.0
      };

      render(<DataQualityBadge quality={quality} showIssues={true} />);

      const warnings = screen.getAllByRole('alert');
      expect(warnings).toHaveLength(2);

      expect(screen.getByText(/low data completeness/i)).toBeInTheDocument();
      expect(screen.getByText(/consistency issues detected/i)).toBeInTheDocument();
    });

    test('provides expandable quality report', async () => {
      const quality: DataQuality = {
        completeness: 0.95,
        accuracy: 0.90,
        consistency: 0.88,
        timeliness: 0.92,
        validity: 0.85,
        uniqueness: 0.98
      };

      const details = {
        completeness: { missing_fields: 2, total_fields: 40 },
        accuracy: { errors_found: 5, records_checked: 50 },
        consistency: { conflicts: 3, rules_checked: 25 },
        timeliness: { average_delay: '2.5 hours', max_delay: '6 hours' },
        validity: { invalid_values: 7, total_values: 47 },
        uniqueness: { duplicates: 1, total_records: 50 }
      };

      render(
        <DataQualityBadge 
          quality={quality}
          details={details}
          expandable={true}
        />
      );

      const user = userEvent.setup();
      const expandBtn = screen.getByRole('button', { name: /expand quality report/i });
      
      await user.click(expandBtn);

      const report = await screen.findByRole('region', { name: /quality report/i });
      expect(report).toBeInTheDocument();

      expect(within(report).getByText(/2 missing fields out of 40/i)).toBeInTheDocument();
      expect(within(report).getByText(/5 errors found in 50 records/i)).toBeInTheDocument();
      expect(within(report).getByText(/average delay.*2.5 hours/i)).toBeInTheDocument();
    });

    test('color codes quality dimensions', () => {
      const quality: DataQuality = {
        completeness: 1.0,    // Green
        accuracy: 0.85,       // Yellow
        consistency: 0.65,    // Orange
        timeliness: 0.45,     // Red
        validity: 0.92,       // Green
        uniqueness: 0.98      // Green
      };

      render(<DataQualityBadge quality={quality} />);

      const completeness = screen.getByTestId('quality-completeness');
      expect(completeness).toHaveClass('text-green-600');

      const accuracy = screen.getByTestId('quality-accuracy');
      expect(accuracy).toHaveClass('text-yellow-600');

      const consistency = screen.getByTestId('quality-consistency');
      expect(consistency).toHaveClass('text-orange-600');

      const timeliness = screen.getByTestId('quality-timeliness');
      expect(timeliness).toHaveClass('text-red-600');
    });

    test('supports Swedish and English labels', () => {
      const quality: DataQuality = {
        completeness: 0.95,
        accuracy: 0.90,
        consistency: 0.88,
        timeliness: 0.92,
        validity: 0.85,
        uniqueness: 0.98
      };

      const { rerender } = render(
        <DataQualityBadge quality={quality} locale="sv" />
      );

      expect(screen.getByText('Fullständighet')).toBeInTheDocument();
      expect(screen.getByText('Noggrannhet')).toBeInTheDocument();
      expect(screen.getByText('Konsistens')).toBeInTheDocument();

      rerender(
        <DataQualityBadge quality={quality} locale="en" />
      );

      expect(screen.getByText('Completeness')).toBeInTheDocument();
      expect(screen.getByText('Accuracy')).toBeInTheDocument();
      expect(screen.getByText('Consistency')).toBeInTheDocument();
    });
  });

  describe('SourceAttribution Component', () => {
    test('displays source information with logos', () => {
      const sources: Source[] = [
        {
          id: 'src-1',
          name: 'Archon Knowledge Base',
          type: 'knowledge_base',
          url: 'https://archon.example.com',
          confidence: 0.95,
          lastUpdated: '2024-01-15T10:00:00Z'
        },
        {
          id: 'src-2',
          name: 'Invoice Database',
          type: 'database',
          table: 'invoices',
          confidence: 0.88,
          recordCount: 1250
        },
        {
          id: 'src-3',
          name: 'External API',
          type: 'api',
          endpoint: '/api/v1/suppliers',
          confidence: 0.75
        }
      ];

      render(<SourceAttribution sources={sources} />);

      sources.forEach(source => {
        const sourceElement = screen.getByTestId(`source-${source.id}`);
        expect(sourceElement).toBeInTheDocument();
        
        expect(within(sourceElement).getByText(source.name)).toBeInTheDocument();
        expect(within(sourceElement).getByTestId(`icon-${source.type}`)).toBeInTheDocument();
        
        const confidence = within(sourceElement).getByRole('meter');
        expect(confidence).toHaveAttribute('aria-valuenow', String(source.confidence));
      });
    });

    test('shows source freshness indicators', () => {
      const sources: Source[] = [
        {
          id: 'src-1',
          name: 'Fresh Data',
          type: 'database',
          lastUpdated: new Date().toISOString(), // Just now
          confidence: 0.95
        },
        {
          id: 'src-2',
          name: 'Recent Data',
          type: 'api',
          lastUpdated: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          confidence: 0.90
        },
        {
          id: 'src-3',
          name: 'Stale Data',
          type: 'file',
          lastUpdated: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
          confidence: 0.60
        }
      ];

      render(<SourceAttribution sources={sources} showFreshness={true} />);

      const fresh = screen.getByTestId('source-src-1');
      expect(within(fresh).getByTestId('freshness-indicator')).toHaveClass('freshness-current');
      expect(within(fresh).getByText(/just now/i)).toBeInTheDocument();

      const recent = screen.getByTestId('source-src-2');
      expect(within(recent).getByTestId('freshness-indicator')).toHaveClass('freshness-recent');
      expect(within(recent).getByText(/1 hour ago/i)).toBeInTheDocument();

      const stale = screen.getByTestId('source-src-3');
      expect(within(stale).getByTestId('freshness-indicator')).toHaveClass('freshness-stale');
      expect(within(stale).getByText(/7 days ago/i)).toBeInTheDocument();
    });

    test('links to source origins when available', () => {
      const sources: Source[] = [
        {
          id: 'src-1',
          name: 'Documentation',
          type: 'web',
          url: 'https://docs.example.com/api',
          confidence: 0.90
        },
        {
          id: 'src-2',
          name: 'Database Query',
          type: 'database',
          query: 'SELECT * FROM invoices WHERE status = "overdue"',
          confidence: 0.95
        }
      ];

      render(<SourceAttribution sources={sources} />);

      const docLink = screen.getByRole('link', { name: /Documentation/i });
      expect(docLink).toHaveAttribute('href', 'https://docs.example.com/api');
      expect(docLink).toHaveAttribute('target', '_blank');

      const dbSource = screen.getByTestId('source-src-2');
      const viewQueryBtn = within(dbSource).getByRole('button', { name: /view query/i });
      expect(viewQueryBtn).toBeInTheDocument();
    });

    test('aggregates confidence from multiple sources', () => {
      const sources: Source[] = [
        { id: '1', name: 'Source A', type: 'api', confidence: 0.90, weight: 2 },
        { id: '2', name: 'Source B', type: 'database', confidence: 0.85, weight: 3 },
        { id: '3', name: 'Source C', type: 'file', confidence: 0.75, weight: 1 }
      ];

      render(
        <SourceAttribution 
          sources={sources}
          showAggregateConfidence={true}
        />
      );

      const aggregate = screen.getByTestId('aggregate-confidence');
      
      // Weighted average: (0.90*2 + 0.85*3 + 0.75*1) / 6 = 0.85
      expect(aggregate).toHaveTextContent('85%');
      expect(aggregate).toHaveTextContent(/weighted average/i);
    });

    test('indicates primary vs supporting sources', () => {
      const sources: Source[] = [
        {
          id: 'primary-1',
          name: 'Primary Source',
          type: 'database',
          confidence: 0.95,
          isPrimary: true
        },
        {
          id: 'support-1',
          name: 'Supporting Source 1',
          type: 'api',
          confidence: 0.80,
          isPrimary: false
        },
        {
          id: 'support-2',
          name: 'Supporting Source 2',
          type: 'file',
          confidence: 0.75,
          isPrimary: false
        }
      ];

      render(<SourceAttribution sources={sources} />);

      const primary = screen.getByTestId('source-primary-1');
      expect(primary).toHaveClass('source-primary');
      expect(within(primary).getByTestId('primary-badge')).toBeInTheDocument();

      const supporting = screen.getAllByTestId(/source-support/);
      supporting.forEach(source => {
        expect(source).toHaveClass('source-supporting');
      });
    });
  });

  describe('Confidence Provider Integration', () => {
    test('provides confidence context to child components', () => {
      const mockMetrics: QualityMetrics = {
        overallConfidence: 0.87,
        dataQuality: {
          completeness: 0.92,
          accuracy: 0.88,
          consistency: 0.85,
          timeliness: 0.90,
          validity: 0.86,
          uniqueness: 0.95
        },
        sources: [
          { id: '1', name: 'Main DB', type: 'database', confidence: 0.95 }
        ],
        lastCalculated: new Date().toISOString()
      };

      render(
        <ConfidenceProvider metrics={mockMetrics}>
          <div data-testid="test-container">
            <ConfidenceIndicator />
            <DataQualityBadge />
            <SourceAttribution />
          </div>
        </ConfidenceProvider>
      );

      // All components should receive metrics from context
      const confidence = screen.getByRole('meter', { name: /confidence/i });
      expect(confidence).toHaveAttribute('aria-valuenow', '0.87');

      const quality = screen.getByRole('status', { name: /data quality/i });
      expect(quality).toBeInTheDocument();

      const sources = screen.getByTestId('source-1');
      expect(sources).toBeInTheDocument();
    });

    test('updates confidence in real-time', async () => {
      const { rerender } = render(
        <ConfidenceProvider 
          metrics={{ overallConfidence: 0.75 }}
          realTimeUpdates={true}
        >
          <ConfidenceIndicator />
        </ConfidenceProvider>
      );

      let indicator = screen.getByRole('meter');
      expect(indicator).toHaveAttribute('aria-valuenow', '0.75');

      // Simulate real-time update
      rerender(
        <ConfidenceProvider 
          metrics={{ overallConfidence: 0.92 }}
          realTimeUpdates={true}
        >
          <ConfidenceIndicator />
        </ConfidenceProvider>
      );

      await waitFor(() => {
        indicator = screen.getByRole('meter');
        expect(indicator).toHaveAttribute('aria-valuenow', '0.92');
      });

      // Check for update animation
      expect(indicator.parentElement).toHaveClass('confidence-updating');
    });

    test('tracks confidence history over time', () => {
      const history = [
        { timestamp: '2024-01-15T10:00:00Z', confidence: 0.75 },
        { timestamp: '2024-01-15T10:15:00Z', confidence: 0.80 },
        { timestamp: '2024-01-15T10:30:00Z', confidence: 0.85 },
        { timestamp: '2024-01-15T10:45:00Z', confidence: 0.88 }
      ];

      render(
        <ConfidenceProvider history={history}>
          <ConfidenceIndicator showHistory={true} />
        </ConfidenceProvider>
      );

      const chart = screen.getByTestId('confidence-history-chart');
      expect(chart).toBeInTheDocument();

      // Check trend calculation
      const trend = screen.getByTestId('confidence-trend');
      expect(trend).toHaveTextContent('+13%'); // From 0.75 to 0.88
    });
  });

  describe('Threshold Alerts', () => {
    test('shows alert when confidence drops below threshold', () => {
      render(
        <ConfidenceIndicator 
          score={0.45}
          threshold={0.70}
          showAlert={true}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/low confidence warning/i);
      expect(alert).toHaveClass('alert-warning');
    });

    test('triggers callback when quality issues detected', () => {
      const onQualityIssue = jest.fn();
      
      const poorQuality: DataQuality = {
        completeness: 0.50,
        accuracy: 0.60,
        consistency: 0.45,
        timeliness: 0.55,
        validity: 0.52,
        uniqueness: 0.58
      };

      render(
        <DataQualityBadge 
          quality={poorQuality}
          qualityThreshold={0.70}
          onQualityIssue={onQualityIssue}
        />
      );

      expect(onQualityIssue).toHaveBeenCalledWith({
        dimensions: ['completeness', 'consistency'],
        scores: { completeness: 0.50, consistency: 0.45 },
        severity: 'high'
      });
    });
  });

  describe('Export and Reporting', () => {
    test('exports confidence report as JSON', async () => {
      const metrics: QualityMetrics = {
        overallConfidence: 0.85,
        dataQuality: {
          completeness: 0.90,
          accuracy: 0.88,
          consistency: 0.82,
          timeliness: 0.86,
          validity: 0.84,
          uniqueness: 0.92
        },
        sources: [
          { id: '1', name: 'Primary DB', type: 'database', confidence: 0.95 },
          { id: '2', name: 'API', type: 'api', confidence: 0.78 }
        ]
      };

      const onExport = jest.fn();
      render(
        <ConfidenceProvider metrics={metrics}>
          <button onClick={() => onExport(metrics)}>Export Report</button>
        </ConfidenceProvider>
      );

      const user = userEvent.setup();
      const exportBtn = screen.getByRole('button', { name: /export report/i });
      
      await user.click(exportBtn);

      expect(onExport).toHaveBeenCalledWith(expect.objectContaining({
        overallConfidence: 0.85,
        dataQuality: expect.any(Object),
        sources: expect.arrayContaining([
          expect.objectContaining({ name: 'Primary DB' })
        ])
      }));
    });

    test('generates quality improvement recommendations', () => {
      const poorQuality: DataQuality = {
        completeness: 0.60,
        accuracy: 0.95,
        consistency: 0.55,
        timeliness: 0.90,
        validity: 0.88,
        uniqueness: 0.98
      };

      render(
        <DataQualityBadge 
          quality={poorQuality}
          showRecommendations={true}
        />
      );

      const recommendations = screen.getByRole('region', { name: /recommendations/i });
      expect(recommendations).toBeInTheDocument();

      expect(within(recommendations).getByText(/improve data completeness/i)).toBeInTheDocument();
      expect(within(recommendations).getByText(/address consistency issues/i)).toBeInTheDocument();
      expect(within(recommendations).queryByText(/accuracy/i)).not.toBeInTheDocument(); // Good score
    });
  });
});