/**
 * @fileoverview Test suite for Granskad Workflow Layout & Responsiveness
 * Tests three-column layout, sticky behavior, and responsive design
 * 
 * CRITICAL: These tests MUST fail initially per TDD RED phase
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Component imports - These don't exist yet (RED phase)
import { GranskadWorkflow } from '@/components/granskad/GranskadWorkflow';
import { ChecklistPanel } from '@/components/granskad/ChecklistPanel';
import { FindingsTable } from '@/components/granskad/FindingsTable';
import { CommentDrawer } from '@/components/granskad/CommentDrawer';
import { ThemeProvider } from '@/lib/theme-provider';

// Mock viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  ultrawide: { width: 2560, height: 1440 }
};

// Helper to set viewport size
const setViewport = (viewport: keyof typeof VIEWPORTS) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: VIEWPORTS[viewport].width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: VIEWPORTS[viewport].height,
  });
  window.dispatchEvent(new Event('resize'));
};

// Mock intersection observer for sticky behavior testing
const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  });
  window.IntersectionObserver = mockIntersectionObserver as any;
};

describe('GranskadWorkflow - Layout & Responsiveness', () => {
  beforeEach(() => {
    mockIntersectionObserver();
    setViewport('desktop');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Three-Column Layout', () => {
    test('should render three distinct columns on desktop', () => {
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      // Checklist panel (left column)
      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      expect(checklistPanel).toBeInTheDocument();
      expect(checklistPanel).toHaveClass('w-80'); // 320px width

      // Findings table (center column)
      const findingsTable = screen.getByRole('main', { name: /granskningsresultat/i });
      expect(findingsTable).toBeInTheDocument();
      expect(findingsTable).toHaveClass('flex-1'); // Flexible center

      // Comment drawer (right column)
      const commentDrawer = screen.getByRole('aside', { name: /kommentarer/i });
      expect(commentDrawer).toBeInTheDocument();
      expect(commentDrawer).toHaveClass('w-96'); // 384px width
    });

    test('should maintain column order: checklist → findings → comments', () => {
      const { container } = render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const layoutContainer = container.querySelector('.granskad-layout');
      expect(layoutContainer).toHaveClass('grid', 'grid-cols-[320px_1fr_384px]');
      
      const columns = within(layoutContainer!).getAllByRole('region');
      expect(columns).toHaveLength(3);
      expect(columns[0]).toHaveAttribute('data-column', 'checklist');
      expect(columns[1]).toHaveAttribute('data-column', 'findings');
      expect(columns[2]).toHaveAttribute('data-column', 'comments');
    });

    test('should apply glassmorphism styling to all columns', () => {
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const columns = screen.getAllByRole('region');
      columns.forEach(column => {
        expect(column).toHaveClass('glassmorphism');
        expect(column).toHaveStyle({
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        });
      });
    });
  });

  describe('Sticky Checklist Panel', () => {
    test('should make checklist panel sticky on scroll', () => {
      const { container } = render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      
      // Initially at top
      expect(checklistPanel).toHaveClass('sticky', 'top-4');
      expect(checklistPanel).toHaveStyle({
        position: 'sticky',
        top: '1rem'
      });

      // Simulate scroll
      window.pageYOffset = 500;
      window.dispatchEvent(new Event('scroll'));

      // Should remain sticky
      expect(checklistPanel).toHaveClass('sticky');
      expect(checklistPanel.getBoundingClientRect().top).toBeLessThanOrEqual(16);
    });

    test('should limit sticky panel height to viewport', () => {
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      expect(checklistPanel).toHaveClass('max-h-[calc(100vh-2rem)]', 'overflow-y-auto');
    });

    test('should maintain sticky behavior with long checklist content', () => {
      const longChecklist = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        label: `Checkpunkt ${i + 1}`,
        completed: false
      }));

      render(
        <ThemeProvider>
          <GranskadWorkflow 
            monthId="2024-01" 
            supplierId="supplier-123"
            checklistItems={longChecklist}
          />
        </ThemeProvider>
      );

      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      const scrollContainer = within(checklistPanel).getByRole('list');
      
      expect(scrollContainer).toHaveClass('overflow-y-auto', 'scrollbar-thin');
      expect(scrollContainer).toHaveAttribute('aria-label', 'Granskningschecklista');
    });
  });

  describe('Responsive Behavior', () => {
    test('should stack columns vertically on mobile', () => {
      setViewport('mobile');
      
      const { container } = render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const layoutContainer = container.querySelector('.granskad-layout');
      expect(layoutContainer).toHaveClass('grid', 'grid-cols-1', 'gap-4');
      
      // Checklist should be collapsible on mobile
      const checklistToggle = screen.getByRole('button', { name: /visa checklista/i });
      expect(checklistToggle).toBeInTheDocument();
    });

    test('should use two-column layout on tablet', () => {
      setViewport('tablet');
      
      const { container } = render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const layoutContainer = container.querySelector('.granskad-layout');
      expect(layoutContainer).toHaveClass('grid', 'md:grid-cols-[320px_1fr]');
      
      // Comments should be in a drawer/modal on tablet
      const commentToggle = screen.getByRole('button', { name: /öppna kommentarer/i });
      expect(commentToggle).toBeInTheDocument();
    });

    test('should handle ultrawide screens with max-width constraint', () => {
      setViewport('ultrawide');
      
      const { container } = render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const layoutContainer = container.querySelector('.granskad-layout');
      expect(layoutContainer?.parentElement).toHaveClass('max-w-[2000px]', 'mx-auto');
    });

    test('should maintain minimum column widths', () => {
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      const commentDrawer = screen.getByRole('aside', { name: /kommentarer/i });
      
      expect(checklistPanel).toHaveClass('min-w-[280px]');
      expect(commentDrawer).toHaveClass('min-w-[320px]');
    });
  });

  describe('Column Resizing', () => {
    test('should allow resizing checklist panel width', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const resizeHandle = screen.getByRole('separator', { name: /ändra storlek på checklista/i });
      expect(resizeHandle).toBeInTheDocument();
      expect(resizeHandle).toHaveAttribute('aria-orientation', 'vertical');

      // Drag to resize
      await user.pointer([
        { keys: '[MouseLeft>]', target: resizeHandle },
        { coords: { x: 400, y: 100 } },
        { keys: '[/MouseLeft]' }
      ]);

      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      expect(checklistPanel).toHaveStyle({ width: '400px' });
    });

    test('should persist column sizes in localStorage', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const resizeHandle = screen.getByRole('separator', { name: /ändra storlek på checklista/i });
      
      await user.pointer([
        { keys: '[MouseLeft>]', target: resizeHandle },
        { coords: { x: 350, y: 100 } },
        { keys: '[/MouseLeft]' }
      ]);

      expect(localStorage.getItem('granskad-column-sizes')).toEqual(
        JSON.stringify({
          checklist: 350,
          comments: 384
        })
      );
    });

    test('should enforce minimum and maximum resize bounds', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const resizeHandle = screen.getByRole('separator', { name: /ändra storlek på checklista/i });
      
      // Try to resize below minimum
      await user.pointer([
        { keys: '[MouseLeft>]', target: resizeHandle },
        { coords: { x: 100, y: 100 } },
        { keys: '[/MouseLeft]' }
      ]);

      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      expect(checklistPanel).toHaveStyle({ width: '280px' }); // Minimum enforced

      // Try to resize above maximum
      await user.pointer([
        { keys: '[MouseLeft>]', target: resizeHandle },
        { coords: { x: 600, y: 100 } },
        { keys: '[/MouseLeft]' }
      ]);

      expect(checklistPanel).toHaveStyle({ width: '500px' }); // Maximum enforced
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should support keyboard navigation between columns', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      // Start in checklist
      const checklistPanel = screen.getByRole('complementary', { name: /granskning checklista/i });
      checklistPanel.focus();
      expect(document.activeElement).toBe(checklistPanel);

      // Tab to findings
      await user.keyboard('{Tab}');
      const findingsTable = screen.getByRole('main', { name: /granskningsresultat/i });
      expect(document.activeElement).toBeInTheDocument();
      expect(findingsTable).toContainElement(document.activeElement!);

      // Tab to comments
      await user.keyboard('{Tab}');
      const commentDrawer = screen.getByRole('aside', { name: /kommentarer/i });
      expect(commentDrawer).toContainElement(document.activeElement!);
    });

    test('should announce layout changes to screen readers', async () => {
      setViewport('desktop');
      
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const liveRegion = screen.getByRole('status', { name: /layoutmeddelanden/i });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      // Change to mobile
      setViewport('mobile');
      window.dispatchEvent(new Event('resize'));

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/Layout ändrad till mobilvy/i);
      });
    });

    test('should provide skip links for keyboard users', () => {
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </ThemeProvider>
      );

      const skipLinks = screen.getAllByRole('link', { name: /hoppa till/i });
      expect(skipLinks).toHaveLength(3);
      
      expect(skipLinks[0]).toHaveAttribute('href', '#checklist');
      expect(skipLinks[1]).toHaveAttribute('href', '#findings');
      expect(skipLinks[2]).toHaveAttribute('href', '#comments');
    });
  });

  describe('Loading & Error States', () => {
    test('should show skeleton loaders while data loads', () => {
      render(
        <ThemeProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" loading />
        </ThemeProvider>
      );

      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
      
      skeletons.forEach(skeleton => {
        expect(skeleton).toHaveClass('animate-pulse');
      });
    });

    test('should handle column rendering errors gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      render(
        <ThemeProvider>
          <GranskadWorkflow 
            monthId="2024-01" 
            supplierId="supplier-123"
            checklistItems={null as any} // Force error
          />
        </ThemeProvider>
      );

      const errorBoundary = screen.getByRole('alert');
      expect(errorBoundary).toHaveTextContent(/Ett fel uppstod vid laddning av granskningsvy/i);
      
      consoleError.mockRestore();
    });
  });
});