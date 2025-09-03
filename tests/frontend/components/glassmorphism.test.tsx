/**
 * @jest-environment jsdom
 * Glassmorphism Components Test Suite
 * Testing backdrop blur effects, cross-browser consistency, and fallback handling
 * Coverage Target: 95% component interactions, 100% accessibility compliance
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';
import {
  GlassCard,
  InsightCard,
  ClearanceBar,
  ConfidenceChip,
  MetricCard,
  StatusCard,
} from '@/components/ui/glassmorphism';
import { ThemeProvider } from '@/providers/theme-provider';

expect.extend(toHaveNoViolations);

// Mock CSS.supports for testing browser compatibility
const mockCSSSupports = (supported: boolean) => {
  Object.defineProperty(window.CSS, 'supports', {
    value: jest.fn(() => supported),
    writable: true,
  });
};

describe('Glassmorphism Components', () => {
  describe('GlassCard - Backdrop Blur Rendering', () => {
    it('should render with backdrop blur effects when supported', () => {
      mockCSSSupports(true);
      const { container } = render(
        <GlassCard className="test-card">
          <h2>Test Content</h2>
        </GlassCard>
      );
      
      const card = container.querySelector('.test-card');
      expect(card).toHaveClass('backdrop-blur-md');
      expect(card).toHaveStyle({
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      });
    });

    it('should apply fallback styles when backdrop-filter is not supported', () => {
      mockCSSSupports(false);
      const { container } = render(
        <GlassCard className="test-card">
          <h2>Fallback Content</h2>
        </GlassCard>
      );
      
      const card = container.querySelector('.test-card');
      expect(card).not.toHaveClass('backdrop-blur-md');
      expect(card).toHaveStyle({
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      });
    });

    it('should maintain consistent appearance across Chrome, Firefox, and Safari', () => {
      const browsers = ['Chrome', 'Firefox', 'Safari'];
      browsers.forEach((browser) => {
        // Mock user agent
        Object.defineProperty(navigator, 'userAgent', {
          value: browser,
          writable: true,
        });
        
        const { container } = render(
          <GlassCard data-testid={`glass-${browser}`}>
            <span>Cross-browser test</span>
          </GlassCard>
        );
        
        const card = screen.getByTestId(`glass-${browser}`);
        expect(card).toBeInTheDocument();
        expect(card).toHaveAttribute('data-browser-optimized', 'true');
      });
    });

    it('should handle nested glassmorphism components without visual artifacts', () => {
      const { container } = render(
        <GlassCard>
          <GlassCard variant="nested">
            <GlassCard variant="deeply-nested">
              <p>Triple nested content</p>
            </GlassCard>
          </GlassCard>
        </GlassCard>
      );
      
      const nestedCards = container.querySelectorAll('[data-glass-level]');
      expect(nestedCards).toHaveLength(3);
      
      // Each level should have decreasing blur intensity
      expect(nestedCards[0]).toHaveStyle({ backdropFilter: 'blur(12px)' });
      expect(nestedCards[1]).toHaveStyle({ backdropFilter: 'blur(8px)' });
      expect(nestedCards[2]).toHaveStyle({ backdropFilter: 'blur(4px)' });
    });

    it('should adapt blur intensity based on system performance', async () => {
      // Mock performance observer
      const mockPerformance = {
        memory: { usedJSHeapSize: 50000000 }, // 50MB
        now: jest.fn(() => 100),
      };
      Object.defineProperty(window, 'performance', {
        value: mockPerformance,
        writable: true,
      });
      
      const { rerender, container } = render(
        <GlassCard performanceAdaptive>
          <p>Performance adaptive content</p>
        </GlassCard>
      );
      
      // Simulate high memory usage
      mockPerformance.memory.usedJSHeapSize = 500000000; // 500MB
      rerender(
        <GlassCard performanceAdaptive>
          <p>Performance adaptive content</p>
        </GlassCard>
      );
      
      await waitFor(() => {
        const card = container.querySelector('[data-performance-mode]');
        expect(card).toHaveAttribute('data-performance-mode', 'reduced');
        expect(card).toHaveStyle({ backdropFilter: 'blur(4px)' });
      });
    });

    it('should transition smoothly between light and dark themes', async () => {
      const { container, rerender } = render(
        <ThemeProvider defaultTheme="light">
          <GlassCard>
            <p>Theme transition test</p>
          </GlassCard>
        </ThemeProvider>
      );
      
      let card = container.querySelector('[data-theme-aware]');
      expect(card).toHaveStyle({
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
      });
      
      // Switch to dark theme
      rerender(
        <ThemeProvider defaultTheme="dark">
          <GlassCard>
            <p>Theme transition test</p>
          </GlassCard>
        </ThemeProvider>
      );
      
      card = container.querySelector('[data-theme-aware]');
      expect(card).toHaveStyle({
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        transition: 'all 0.3s ease-in-out',
      });
    });
  });

  describe('Custom Components - Visual Consistency', () => {
    describe('InsightCard', () => {
      it('should display human-friendly ID format (INS-YYYY-MM-NNN)', () => {
        const testData = {
          id: 'INS-2024-09-001',
          title: 'Anomaly detected in waste processing',
          severity: 'high',
          status: 'open',
          evidence: ['row-123', 'row-456'],
        };
        
        render(<InsightCard {...testData} />);
        
        expect(screen.getByText('INS-2024-09-001')).toBeInTheDocument();
        expect(screen.getByText('INS-2024-09-001')).toHaveClass('font-mono');
        expect(screen.getByRole('article')).toHaveAttribute('aria-labelledby', 'insight-INS-2024-09-001');
      });

      it('should apply severity-based visual styling', () => {
        const severities = ['low', 'medium', 'high', 'critical'];
        
        severities.forEach((severity) => {
          const { container } = render(
            <InsightCard
              id={`INS-2024-09-00${severities.indexOf(severity) + 1}`}
              severity={severity}
              title="Test insight"
            />
          );
          
          const card = container.querySelector(`[data-severity="${severity}"]`);
          expect(card).toBeInTheDocument();
          
          // Check border color based on severity
          const expectedColors = {
            low: 'border-green-500/30',
            medium: 'border-yellow-500/30', 
            high: 'border-orange-500/30',
            critical: 'border-red-500/30',
          };
          
          expect(card).toHaveClass(expectedColors[severity as keyof typeof expectedColors]);
        });
      });

      it('should handle evidence linking with expandable details', async () => {
        const user = userEvent.setup();
        
        render(
          <InsightCard
            id="INS-2024-09-001"
            title="Test insight"
            evidence={['row-123', 'row-456', 'chart-789']}
            expandable
          />
        );
        
        const expandButton = screen.getByRole('button', { name: /expand evidence/i });
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');
        
        await user.click(expandButton);
        
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('row-123')).toBeInTheDocument();
        expect(screen.getByText('row-456')).toBeInTheDocument();
        expect(screen.getByText('chart-789')).toBeInTheDocument();
        
        // Check keyboard navigation
        await user.keyboard('{Space}');
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      });
    });

    describe('ClearanceBar', () => {
      it('should render Green/Orange/Red segments with correct proportions', () => {
        const { container } = render(
          <ClearanceBar
            green={60}
            orange={25}
            red={15}
            interactive
          />
        );
        
        const greenSegment = container.querySelector('[data-clearance="green"]');
        const orangeSegment = container.querySelector('[data-clearance="orange"]');
        const redSegment = container.querySelector('[data-clearance="red"]');
        
        expect(greenSegment).toHaveStyle({ width: '60%' });
        expect(orangeSegment).toHaveStyle({ width: '25%' });
        expect(redSegment).toHaveStyle({ width: '15%' });
        
        // Check WCAG color contrast
        expect(greenSegment).toHaveStyle({ backgroundColor: 'rgb(34, 197, 94)' }); // green-500
        expect(orangeSegment).toHaveStyle({ backgroundColor: 'rgb(251, 146, 60)' }); // orange-400
        expect(redSegment).toHaveStyle({ backgroundColor: 'rgb(239, 68, 68)' }); // red-500
      });

      it('should handle interactive segment clicks', async () => {
        const user = userEvent.setup();
        const handleSegmentClick = jest.fn();
        
        render(
          <ClearanceBar
            green={60}
            orange={25}
            red={15}
            interactive
            onSegmentClick={handleSegmentClick}
          />
        );
        
        const greenSegment = screen.getByRole('button', { name: /green clearance: 60%/i });
        await user.click(greenSegment);
        
        expect(handleSegmentClick).toHaveBeenCalledWith('green', 60);
        expect(greenSegment).toHaveAttribute('aria-pressed', 'false');
        
        // Test hover effects
        await user.hover(greenSegment);
        expect(greenSegment).toHaveClass('hover:opacity-80');
      });

      it('should display tooltips with detailed metrics on hover', async () => {
        const user = userEvent.setup();
        
        render(
          <ClearanceBar
            green={60}
            orange={25}
            red={15}
            tooltips={{
              green: '12 suppliers fully compliant',
              orange: '5 suppliers with minor issues',
              red: '3 suppliers need immediate attention',
            }}
          />
        );
        
        const greenSegment = screen.getByRole('button', { name: /green clearance/i });
        await user.hover(greenSegment);
        
        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toHaveTextContent('12 suppliers fully compliant');
        });
      });

      it('should animate transitions when values change', async () => {
        const { rerender, container } = render(
          <ClearanceBar green={60} orange={25} red={15} animated />
        );
        
        const greenSegment = container.querySelector('[data-clearance="green"]');
        expect(greenSegment).toHaveStyle({ transition: 'width 0.5s ease-in-out' });
        
        rerender(<ClearanceBar green={70} orange={20} red={10} animated />);
        
        await waitFor(() => {
          expect(greenSegment).toHaveStyle({ width: '70%' });
        });
      });
    });

    describe('ConfidenceChip', () => {
      it('should display confidence levels with appropriate visual indicators', () => {
        const confidenceLevels = [
          { level: 95, expected: 'high', color: 'text-green-600' },
          { level: 75, expected: 'medium', color: 'text-yellow-600' },
          { level: 45, expected: 'low', color: 'text-orange-600' },
          { level: 20, expected: 'very-low', color: 'text-red-600' },
        ];
        
        confidenceLevels.forEach(({ level, expected, color }) => {
          const { container } = render(
            <ConfidenceChip confidence={level} showPercentage />
          );
          
          const chip = container.querySelector(`[data-confidence="${expected}"]`);
          expect(chip).toBeInTheDocument();
          expect(chip).toHaveClass(color);
          expect(screen.getByText(`${level}%`)).toBeInTheDocument();
        });
      });

      it('should support interactive click-to-approve workflow', async () => {
        const user = userEvent.setup();
        const handleApprove = jest.fn();
        
        render(
          <ConfidenceChip
            confidence={85}
            interactive
            onApprove={handleApprove}
            suggestion="Corrected facility name"
          />
        );
        
        const chip = screen.getByRole('button', { name: /confidence: 85%/i });
        await user.click(chip);
        
        // Should show confirmation dialog
        expect(screen.getByText(/approve correction/i)).toBeInTheDocument();
        expect(screen.getByText('Corrected facility name')).toBeInTheDocument();
        
        const approveButton = screen.getByRole('button', { name: /confirm/i });
        await user.click(approveButton);
        
        expect(handleApprove).toHaveBeenCalledWith('Corrected facility name', 85);
      });

      it('should show loading state during approval process', async () => {
        const user = userEvent.setup();
        const handleApprove = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
        
        render(
          <ConfidenceChip
            confidence={85}
            interactive
            onApprove={handleApprove}
          />
        );
        
        const chip = screen.getByRole('button');
        await user.click(chip);
        
        const approveButton = screen.getByRole('button', { name: /confirm/i });
        await user.click(approveButton);
        
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 1500 });
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have no WCAG 2.1 AA violations in GlassCard', async () => {
      const { container } = render(
        <GlassCard>
          <h2>Accessible Card Title</h2>
          <p>Card content with proper contrast ratios</p>
          <button>Interactive Element</button>
        </GlassCard>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain focus visibility on glassmorphic elements', async () => {
      const user = userEvent.setup();
      
      render(
        <GlassCard>
          <button>First Button</button>
          <input type="text" placeholder="Input field" />
          <a href="#">Link element</a>
        </GlassCard>
      );
      
      // Tab through elements
      await user.tab();
      const firstButton = screen.getByRole('button');
      expect(firstButton).toHaveFocus();
      expect(firstButton).toHaveClass('focus:ring-2', 'focus:ring-blue-500', 'focus:ring-offset-2');
      
      await user.tab();
      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
      
      await user.tab();
      const link = screen.getByRole('link');
      expect(link).toHaveFocus();
    });

    it('should provide proper ARIA labels and roles', () => {
      render(
        <ClearanceBar
          green={60}
          orange={25}
          red={15}
          ariaLabel="Monthly clearance status"
        />
      );
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'Monthly clearance status');
      expect(progressBar).toHaveAttribute('aria-valuenow', '60');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuetext', 'Green: 60%, Orange: 25%, Red: 15%');
    });

    it('should support high contrast mode', () => {
      // Mock high contrast mode
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      
      const { container } = render(
        <GlassCard highContrastAware>
          <p>High contrast content</p>
        </GlassCard>
      );
      
      const card = container.firstChild;
      expect(card).toHaveClass('high-contrast:border-2', 'high-contrast:border-black');
      expect(card).not.toHaveClass('backdrop-blur-md');
    });

    it('should handle reduced motion preferences', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      
      const { container } = render(
        <ClearanceBar
          green={60}
          orange={25}
          red={15}
          animated
        />
      );
      
      const segments = container.querySelectorAll('[data-clearance]');
      segments.forEach(segment => {
        expect(segment).toHaveStyle({ transition: 'none' });
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should render components within 100ms initial render time', () => {
      const startTime = performance.now();
      
      render(
        <div>
          <GlassCard>Content 1</GlassCard>
          <InsightCard id="INS-2024-09-001" title="Test" />
          <ClearanceBar green={60} orange={25} red={15} />
          <ConfidenceChip confidence={85} />
        </div>
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle interactions within 50ms response time', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(
        <ClearanceBar
          green={60}
          orange={25}
          red={15}
          interactive
          onSegmentClick={handleClick}
        />
      );
      
      const segment = screen.getByRole('button', { name: /green clearance/i });
      
      const startTime = performance.now();
      await user.click(segment);
      const endTime = performance.now();
      
      const interactionTime = endTime - startTime;
      expect(interactionTime).toBeLessThan(50);
      expect(handleClick).toHaveBeenCalled();
    });

    it('should efficiently handle multiple glassmorphic components', () => {
      const componentCount = 100;
      const components = Array.from({ length: componentCount }, (_, i) => (
        <GlassCard key={i}>
          <p>Component {i}</p>
        </GlassCard>
      ));
      
      const startTime = performance.now();
      const { container } = render(<div>{components}</div>);
      const endTime = performance.now();
      
      expect(container.querySelectorAll('[data-glassmorphic]')).toHaveLength(componentCount);
      expect(endTime - startTime).toBeLessThan(500); // 5ms per component max
    });

    it('should lazy load heavy glassmorphic effects on scroll', async () => {
      const { container } = render(
        <div style={{ height: '200vh' }}>
          <GlassCard data-testid="visible">Visible card</GlassCard>
          <div style={{ marginTop: '150vh' }}>
            <GlassCard data-testid="offscreen" lazyLoad>
              Offscreen card
            </GlassCard>
          </div>
        </div>
      );
      
      const offscreenCard = screen.getByTestId('offscreen');
      expect(offscreenCard).not.toHaveClass('backdrop-blur-md');
      
      // Simulate scroll
      const intersectionObserverCallback = (IntersectionObserver as any).mock.calls[0][0];
      intersectionObserverCallback([{ isIntersecting: true, target: offscreenCard }]);
      
      await waitFor(() => {
        expect(offscreenCard).toHaveClass('backdrop-blur-md');
      });
    });
  });

  describe('Browser Compatibility', () => {
    it('should detect and handle Safari-specific backdrop-filter bugs', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Safari',
        writable: true,
      });
      
      const { container } = render(
        <GlassCard>
          <p>Safari optimized content</p>
        </GlassCard>
      );
      
      const card = container.firstChild;
      // Safari needs -webkit-backdrop-filter
      expect(card).toHaveStyle({
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
      });
    });

    it('should provide fallback for Firefox ESR without backdrop-filter', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Firefox/91.0', // ESR version
        writable: true,
      });
      mockCSSSupports(false);
      
      const { container } = render(
        <GlassCard>
          <p>Firefox ESR content</p>
        </GlassCard>
      );
      
      const card = container.firstChild;
      expect(card).toHaveClass('bg-white/95', 'dark:bg-gray-900/95');
      expect(card).not.toHaveClass('backdrop-blur-md');
    });

    it('should handle Edge legacy with partial support', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Edge/18',
        writable: true,
      });
      
      const { container } = render(
        <GlassCard>
          <p>Edge legacy content</p>
        </GlassCard>
      );
      
      const card = container.firstChild;
      expect(card).toHaveAttribute('data-edge-legacy', 'true');
      expect(card).toHaveStyle({
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      });
    });
  });
});