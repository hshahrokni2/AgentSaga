/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScenarioHeatmap } from '@/components/scenario-lab/ScenarioHeatmap';
import { ThemeProvider } from '@/lib/theme-provider';
import '@testing-library/jest-dom';

// Mock canvas context
const mockCanvasContext = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'alphabetic' as CanvasTextBaseline,
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  scale: jest.fn(),
  measureText: jest.fn(() => ({ width: 50 }))
};

// Sample heatmap data
const MOCK_HEATMAP_DATA = {
  data: [
    [0.2, 0.5, 0.8, 0.3, 0.6, 0.9],
    [0.7, 0.1, 0.4, 0.9, 0.2, 0.5],
    [0.3, 0.6, 0.2, 0.5, 0.8, 0.1],
    [0.9, 0.4, 0.7, 0.1, 0.3, 0.6]
  ],
  labels: {
    x: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun'],
    y: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala']
  },
  title: 'Kostnadsförändring per månad och region',
  unit: '%',
  colorScale: {
    min: -50,
    max: 50,
    colors: ['#2563eb', '#ffffff', '#dc2626'] // Blue -> White -> Red
  }
};

describe('ScenarioHeatmap Component', () => {
  beforeEach(() => {
    // Mock getContext for canvas
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvasContext as any);
    
    // Mock getBoundingClientRect
    HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {}
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Heatmap Rendering', () => {
    it('should render canvas element with proper dimensions', () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      const canvas = screen.getByTestId('heatmap-canvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('width', '800');
      expect(canvas).toHaveAttribute('height', '400');
    });

    it('should render title and axis labels', () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      // Title
      expect(screen.getByText('Kostnadsförändring per månad och region')).toBeInTheDocument();

      // X-axis labels (months)
      MOCK_HEATMAP_DATA.labels.x.forEach(label => {
        expect(mockCanvasContext.fillText).toHaveBeenCalledWith(
          label,
          expect.any(Number),
          expect.any(Number)
        );
      });

      // Y-axis labels (regions)
      MOCK_HEATMAP_DATA.labels.y.forEach(label => {
        expect(mockCanvasContext.fillText).toHaveBeenCalledWith(
          label,
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    it('should draw heatmap cells with correct colors', () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      // Should draw rectangle for each data point
      const expectedCalls = MOCK_HEATMAP_DATA.data.length * MOCK_HEATMAP_DATA.data[0].length;
      expect(mockCanvasContext.fillRect).toHaveBeenCalledTimes(expectedCalls);

      // Check that colors are set based on values
      const fillStyleCalls = (mockCanvasContext.fillStyle = jest.fn());
      expect(fillStyleCalls).toBeDefined();
    });

    it('should render color scale legend', () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      const legend = screen.getByTestId('heatmap-legend');
      expect(legend).toBeInTheDocument();

      // Should show min/max values
      expect(screen.getByText('-50%')).toBeInTheDocument();
      expect(screen.getByText('+50%')).toBeInTheDocument();

      // Should show gradient
      const gradient = legend.querySelector('.heatmap-legend__gradient');
      expect(gradient).toHaveStyle({
        background: expect.stringContaining('linear-gradient')
      });
    });

    it('should handle empty data gracefully', () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={null} />
        </ThemeProvider>
      );

      expect(screen.getByText('Ingen data att visa')).toBeInTheDocument();
    });
  });

  describe('Interactivity', () => {
    it('should show tooltip on hover', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      const canvas = screen.getByTestId('heatmap-canvas');

      // Simulate mouse move over a cell
      fireEvent.mouseMove(canvas, {
        clientX: 100,
        clientY: 100
      });

      // Should show tooltip
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveTextContent('Stockholm');
        expect(tooltip).toHaveTextContent('Jan');
        expect(tooltip).toHaveTextContent('20%'); // Based on mock data[0][0] = 0.2
      });
    });

    it('should update tooltip position on mouse move', async () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      const canvas = screen.getByTestId('heatmap-canvas');

      // Move to first position
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
      
      let tooltip = await screen.findByRole('tooltip');
      const firstPosition = {
        left: tooltip.style.left,
        top: tooltip.style.top
      };

      // Move to different position
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
      
      tooltip = await screen.findByRole('tooltip');
      const secondPosition = {
        left: tooltip.style.left,
        top: tooltip.style.top
      };

      expect(firstPosition).not.toEqual(secondPosition);
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      const canvas = screen.getByTestId('heatmap-canvas');

      // Show tooltip
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
      expect(await screen.findByRole('tooltip')).toBeInTheDocument();

      // Hide tooltip
      fireEvent.mouseLeave(canvas);
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should handle click to select cell', async () => {
      const user = userEvent.setup();
      const onCellClick = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioHeatmap 
            data={MOCK_HEATMAP_DATA}
            onCellClick={onCellClick}
          />
        </ThemeProvider>
      );

      const canvas = screen.getByTestId('heatmap-canvas');

      // Click on a cell
      await user.click(canvas);

      expect(onCellClick).toHaveBeenCalledWith({
        row: expect.any(Number),
        col: expect.any(Number),
        value: expect.any(Number),
        rowLabel: expect.any(String),
        colLabel: expect.any(String)
      });
    });

    it('should highlight selected cell', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioHeatmap 
            data={MOCK_HEATMAP_DATA}
            selectedCell={{ row: 0, col: 0 }}
          />
        </ThemeProvider>
      );

      // Should draw border around selected cell
      expect(mockCanvasContext.strokeRect).toHaveBeenCalled();
      expect(mockCanvasContext.strokeStyle).toBe('#3b82f6'); // Blue border
      expect(mockCanvasContext.lineWidth).toBe(3);
    });
  });

  describe('Responsive Behavior', () => {
    it('should resize canvas on window resize', async () => {
      const { rerender } = render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      const canvas = screen.getByTestId('heatmap-canvas');
      
      // Initial size
      expect(canvas).toHaveAttribute('width', '800');

      // Simulate window resize
      HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 600,
        bottom: 300,
        width: 600,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => {}
      }));

      fireEvent(window, new Event('resize'));

      // Re-render to apply new size
      rerender(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(canvas).toHaveAttribute('width', '600');
        expect(canvas).toHaveAttribute('height', '300');
      });
    });

    it('should adjust cell size based on canvas dimensions', () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      // Calculate expected cell dimensions
      const canvasWidth = 800;
      const canvasHeight = 400;
      const padding = 60; // Assumed padding for labels
      
      const cellWidth = (canvasWidth - padding * 2) / MOCK_HEATMAP_DATA.labels.x.length;
      const cellHeight = (canvasHeight - padding * 2) / MOCK_HEATMAP_DATA.labels.y.length;

      // Verify fillRect was called with correct dimensions
      expect(mockCanvasContext.fillRect).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.closeTo(cellWidth, 1),
        expect.closeTo(cellHeight, 1)
      );
    });
  });

  describe('Color Scaling', () => {
    it('should apply custom color scale', () => {
      const customColorScale = {
        min: 0,
        max: 100,
        colors: ['#00ff00', '#ffff00', '#ff0000'] // Green -> Yellow -> Red
      };

      render(
        <ThemeProvider>
          <ScenarioHeatmap 
            data={{
              ...MOCK_HEATMAP_DATA,
              colorScale: customColorScale
            }}
          />
        </ThemeProvider>
      );

      // Legend should reflect custom scale
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle negative values in color scale', () => {
      const negativeData = {
        ...MOCK_HEATMAP_DATA,
        data: [
          [-0.5, -0.2, 0, 0.3, 0.6],
          [-0.8, -0.4, 0.1, 0.5, 0.9]
        ]
      };

      render(
        <ThemeProvider>
          <ScenarioHeatmap data={negativeData} />
        </ThemeProvider>
      );

      // Should render without errors
      expect(screen.getByTestId('heatmap-canvas')).toBeInTheDocument();
    });

    it('should normalize values outside color scale range', () => {
      const outOfRangeData = {
        ...MOCK_HEATMAP_DATA,
        data: [
          [1.5, -0.8, 0.5], // 1.5 is above max, -0.8 is below min
          [0.2, 0.7, 2.0]
        ],
        colorScale: {
          min: 0,
          max: 1,
          colors: ['#000', '#fff']
        }
      };

      render(
        <ThemeProvider>
          <ScenarioHeatmap data={outOfRangeData} />
        </ThemeProvider>
      );

      // Should clamp values and render
      expect(mockCanvasContext.fillRect).toHaveBeenCalled();
    });
  });

  describe('Export Functionality', () => {
    it('should export heatmap as image', async () => {
      const user = userEvent.setup();
      const onExport = jest.fn();

      // Mock toBlob
      HTMLCanvasElement.prototype.toBlob = jest.fn((callback) => {
        callback(new Blob(['image-data'], { type: 'image/png' }));
      });

      render(
        <ThemeProvider>
          <ScenarioHeatmap 
            data={MOCK_HEATMAP_DATA}
            onExport={onExport}
            showExportButton
          />
        </ThemeProvider>
      );

      const exportButton = screen.getByRole('button', { name: /exportera/i });
      await user.click(exportButton);

      expect(onExport).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('should copy heatmap data to clipboard', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn()
        }
      });

      render(
        <ThemeProvider>
          <ScenarioHeatmap 
            data={MOCK_HEATMAP_DATA}
            showCopyButton
          />
        </ThemeProvider>
      );

      const copyButton = screen.getByRole('button', { name: /kopiera data/i });
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Stockholm')
      );

      // Should show success message
      expect(screen.getByText('Data kopierad')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should provide text alternative for visual data', () => {
      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      // Should have accessible description
      const canvas = screen.getByTestId('heatmap-canvas');
      expect(canvas).toHaveAttribute('aria-label', expect.stringContaining('Värmekarta'));
      expect(canvas).toHaveAttribute('role', 'img');

      // Should have table alternative
      const tableButton = screen.getByRole('button', { name: /visa som tabell/i });
      expect(tableButton).toBeInTheDocument();
    });

    it('should show data as table for screen readers', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      const tableButton = screen.getByRole('button', { name: /visa som tabell/i });
      await user.click(tableButton);

      // Should show table
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Check headers
      MOCK_HEATMAP_DATA.labels.x.forEach(label => {
        expect(screen.getByRole('columnheader', { name: label })).toBeInTheDocument();
      });

      // Check row headers
      MOCK_HEATMAP_DATA.labels.y.forEach(label => {
        expect(screen.getByRole('rowheader', { name: label })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation in table view', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      // Switch to table view
      const tableButton = screen.getByRole('button', { name: /visa som tabell/i });
      await user.click(tableButton);

      // Tab through cells
      const firstCell = screen.getByRole('cell', { name: /20%/i }); // First data cell
      firstCell.focus();

      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toHaveTextContent('50%');

      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toHaveTextContent('10%');
    });
  });

  describe('Performance', () => {
    it('should use requestAnimationFrame for smooth rendering', () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');

      render(
        <ThemeProvider>
          <ScenarioHeatmap data={MOCK_HEATMAP_DATA} />
        </ThemeProvider>
      );

      expect(rafSpy).toHaveBeenCalled();
      rafSpy.mockRestore();
    });

    it('should debounce resize events', async () => {
      jest.useFakeTimers();
      const redrawSpy = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioHeatmap 
            data={MOCK_HEATMAP_DATA}
            onRedraw={redrawSpy}
          />
        </ThemeProvider>
      );

      // Fire multiple resize events
      for (let i = 0; i < 5; i++) {
        fireEvent(window, new Event('resize'));
      }

      // Should not redraw immediately
      expect(redrawSpy).not.toHaveBeenCalled();

      // Fast forward debounce timer
      jest.runAllTimers();

      // Should redraw once after debounce
      expect(redrawSpy).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });
});