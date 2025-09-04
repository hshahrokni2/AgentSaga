/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import { InsightsListInterface } from '@/components/insights/insights-list-interface';
import { ThemeProvider } from '@/lib/theme-provider';
import { mockInsights, mockSuppliers, MockWebSocketProvider } from '../__mocks__/insights-mocks';
import { server } from '../__mocks__/server';
import { rest } from 'msw';

expect.extend(toHaveNoViolations);

const renderWithProviders = (component: React.ReactElement, locale: 'sv' | 'en' = 'sv') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MockWebSocketProvider>
          {component}
        </MockWebSocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('InsightsListInterface - Core Rendering', () => {
  describe('Initial Render', () => {
    test('should render main table structure with all columns', () => {
      renderWithProviders(<InsightsListInterface locale="sv" />);

      // Table headers
      expect(screen.getByRole('columnheader', { name: /id/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /titel/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /allvarlighet/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /källa/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /leverantör/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /månad/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /åtgärder/i })).toBeInTheDocument();
    });

    test('should render filter bar with all filter controls', () => {
      renderWithProviders(<InsightsListInterface locale="sv" />);

      // Filter controls
      expect(screen.getByTestId('severity-filter')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      expect(screen.getByTestId('source-filter')).toBeInTheDocument();
      expect(screen.getByTestId('supplier-search')).toBeInTheDocument();
      expect(screen.getByTestId('month-range-selector')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rensa filter/i })).toBeInTheDocument();
    });

    test('should render batch operations toolbar when items are selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      // Select multiple items
      const checkboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Batch operations should appear
      expect(screen.getByTestId('batch-operations-toolbar')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slå samman/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ändra status/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fäst/i })).toBeInTheDocument();
    });

    test('should display pagination controls', () => {
      renderWithProviders(<InsightsListInterface locale="sv" />);

      expect(screen.getByTestId('pagination-controls')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /föregående/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /nästa/i })).toBeInTheDocument();
      expect(screen.getByTestId('page-info')).toHaveTextContent(/sida 1 av/i);
    });
  });

  describe('English Locale Support', () => {
    test('should render with English text when locale is en', () => {
      renderWithProviders(<InsightsListInterface locale="en" />);

      // English headers
      expect(screen.getByRole('columnheader', { name: /title/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /severity/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /source/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /supplier/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /month/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();

      // English buttons
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    });
  });
});

describe('InsightsListInterface - Expandable Rows', () => {
  test('should expand row when clicked to show evidence panel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    const expandButton = screen.getByTestId('expand-row-INS-2024-03-001');
    await user.click(expandButton);

    // Evidence panel should appear
    const evidencePanel = screen.getByTestId('evidence-panel-INS-2024-03-001');
    expect(evidencePanel).toBeInTheDocument();
    expect(evidencePanel).toHaveAttribute('aria-expanded', 'true');

    // Tabs should be visible
    expect(within(evidencePanel).getByRole('tab', { name: /rå data/i })).toBeInTheDocument();
    expect(within(evidencePanel).getByRole('tab', { name: /filer/i })).toBeInTheDocument();
    expect(within(evidencePanel).getByRole('tab', { name: /diagram/i })).toBeInTheDocument();
  });

  test('should collapse row when expanded row is clicked again', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    const expandButton = screen.getByTestId('expand-row-INS-2024-03-001');
    
    // Expand
    await user.click(expandButton);
    expect(screen.getByTestId('evidence-panel-INS-2024-03-001')).toBeInTheDocument();

    // Collapse
    await user.click(expandButton);
    expect(screen.queryByTestId('evidence-panel-INS-2024-03-001')).not.toBeInTheDocument();
  });

  test('should allow multiple rows to be expanded simultaneously', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      expect(screen.getByText('INS-2024-03-002')).toBeInTheDocument();
    });

    // Expand first row
    await user.click(screen.getByTestId('expand-row-INS-2024-03-001'));
    expect(screen.getByTestId('evidence-panel-INS-2024-03-001')).toBeInTheDocument();

    // Expand second row
    await user.click(screen.getByTestId('expand-row-INS-2024-03-002'));
    expect(screen.getByTestId('evidence-panel-INS-2024-03-002')).toBeInTheDocument();

    // Both should remain expanded
    expect(screen.getByTestId('evidence-panel-INS-2024-03-001')).toBeInTheDocument();
  });
});

describe('InsightsListInterface - Filtering', () => {
  describe('Severity Filter', () => {
    test('should filter by severity level', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(11); // 10 data rows + 1 header
      });

      // Select critical severity
      const severityFilter = screen.getByTestId('severity-filter');
      await user.click(severityFilter);
      await user.click(screen.getByRole('option', { name: /kritisk/i }));

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeLessThan(11);
        // All visible rows should have critical severity badge
        const severityBadges = screen.getAllByTestId(/severity-badge-critical/i);
        expect(severityBadges.length).toBeGreaterThan(0);
      });
    });

    test('should support multiple severity selections', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      const severityFilter = screen.getByTestId('severity-filter');
      await user.click(severityFilter);

      // Select multiple severities
      await user.click(screen.getByRole('checkbox', { name: /kritisk/i }));
      await user.click(screen.getByRole('checkbox', { name: /hög/i }));
      await user.click(screen.getByRole('checkbox', { name: /medel/i }));

      await user.click(document.body); // Close dropdown

      await waitFor(() => {
        const severityBadges = screen.getAllByTestId(/severity-badge-(critical|high|medium)/i);
        expect(severityBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Status Filter', () => {
    test('should filter by status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      const statusFilter = screen.getByTestId('status-filter');
      await user.click(statusFilter);
      await user.click(screen.getByRole('option', { name: /ny/i }));

      await waitFor(() => {
        const statusBadges = screen.getAllByTestId(/status-badge-new/i);
        expect(statusBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Source Filter', () => {
    test('should filter by source type', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      const sourceFilter = screen.getByTestId('source-filter');
      await user.click(sourceFilter);
      await user.click(screen.getByRole('option', { name: /regel/i }));

      await waitFor(() => {
        const sourceBadges = screen.getAllByTestId(/source-badge-rule/i);
        expect(sourceBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Supplier Search', () => {
    test('should filter by supplier name search', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      const supplierSearch = screen.getByTestId('supplier-search');
      await user.type(supplierSearch, 'Ragn-Sells');

      await waitFor(() => {
        const supplierCells = screen.getAllByTestId(/supplier-cell/i);
        supplierCells.forEach(cell => {
          expect(cell).toHaveTextContent(/ragn-sells/i);
        });
      });
    });

    test('should show no results when supplier not found', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      const supplierSearch = screen.getByTestId('supplier-search');
      await user.type(supplierSearch, 'NonexistentSupplier');

      await waitFor(() => {
        expect(screen.getByText(/inga insikter hittades/i)).toBeInTheDocument();
      });
    });
  });

  describe('Month Range', () => {
    test('should filter by month range', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      const monthRangeSelector = screen.getByTestId('month-range-selector');
      const startMonth = within(monthRangeSelector).getByLabelText(/från månad/i);
      const endMonth = within(monthRangeSelector).getByLabelText(/till månad/i);

      await user.type(startMonth, '2024-01');
      await user.type(endMonth, '2024-03');

      await waitFor(() => {
        const monthCells = screen.getAllByTestId(/month-cell/i);
        monthCells.forEach(cell => {
          const month = cell.textContent;
          expect(['2024-01', '2024-02', '2024-03']).toContain(month);
        });
      });
    });
  });

  describe('Clear Filters', () => {
    test('should clear all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      // Apply some filters
      const severityFilter = screen.getByTestId('severity-filter');
      await user.click(severityFilter);
      await user.click(screen.getByRole('option', { name: /kritisk/i }));

      const supplierSearch = screen.getByTestId('supplier-search');
      await user.type(supplierSearch, 'Ragn-Sells');

      // Clear filters
      await user.click(screen.getByRole('button', { name: /rensa filter/i }));

      await waitFor(() => {
        expect(supplierSearch).toHaveValue('');
        expect(screen.getAllByRole('row')).toHaveLength(11); // All rows visible again
      });
    });
  });
});

describe('InsightsListInterface - Batch Operations', () => {
  test('should enable select all checkbox', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(11);
    });

    const selectAllCheckbox = screen.getByTestId('select-all-checkbox');
    await user.click(selectAllCheckbox);

    // All row checkboxes should be checked
    const rowCheckboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
    rowCheckboxes.forEach(checkbox => {
      expect(checkbox).toBeChecked();
    });

    // Batch toolbar should show count
    expect(screen.getByTestId('selected-count')).toHaveTextContent('10 valda');
  });

  test('should merge selected insights', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Select multiple insights
    const checkboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    // Click merge button
    await user.click(screen.getByRole('button', { name: /slå samman/i }));

    // Merge dialog should appear
    const dialog = screen.getByRole('dialog', { name: /slå samman insikter/i });
    expect(dialog).toBeInTheDocument();

    // Should show selected insights
    expect(within(dialog).getByText('3 insikter valda')).toBeInTheDocument();
    
    // Confirm merge
    await user.click(within(dialog).getByRole('button', { name: /bekräfta sammanslagning/i }));

    await waitFor(() => {
      expect(screen.getByText(/insikter har slagits samman/i)).toBeInTheDocument();
    });
  });

  test('should batch update status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Select multiple insights
    const checkboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Click change status button
    await user.click(screen.getByRole('button', { name: /ändra status/i }));

    // Status selector should appear
    const statusSelector = screen.getByTestId('batch-status-selector');
    await user.click(statusSelector);
    await user.click(screen.getByRole('option', { name: /validerad/i }));

    await waitFor(() => {
      expect(screen.getByText(/status uppdaterad för 2 insikter/i)).toBeInTheDocument();
    });
  });

  test('should pin/unpin selected insights', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Select insights
    const checkboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Pin insights
    await user.click(screen.getByRole('button', { name: /fäst/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 insikter har fästs/i)).toBeInTheDocument();
      // Pinned insights should have pin icon
      expect(screen.getAllByTestId('pinned-icon')).toHaveLength(2);
    });

    // Unpin insights
    await user.click(screen.getByRole('button', { name: /lossa/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 insikter har lossats/i)).toBeInTheDocument();
      expect(screen.queryAllByTestId('pinned-icon')).toHaveLength(0);
    });
  });
});

describe('InsightsListInterface - Evidence Panel', () => {
  beforeEach(async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);
    
    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    // Expand first row
    await user.click(screen.getByTestId('expand-row-INS-2024-03-001'));
  });

  test('should display raw rows tab with linked data', async () => {
    const user = userEvent.setup();
    const evidencePanel = screen.getByTestId('evidence-panel-INS-2024-03-001');
    
    // Raw data tab should be active by default
    const rawDataTab = within(evidencePanel).getByRole('tab', { name: /rå data/i });
    expect(rawDataTab).toHaveAttribute('aria-selected', 'true');

    // Should display linked rows
    const rawDataPanel = within(evidencePanel).getByRole('tabpanel', { name: /rå data/i });
    expect(within(rawDataPanel).getByText(/10 rader länkade/i)).toBeInTheDocument();
    
    // Should have data table
    const dataTable = within(rawDataPanel).getByRole('table');
    expect(dataTable).toBeInTheDocument();
    expect(within(dataTable).getAllByRole('row')).toHaveLength(11); // 10 data + 1 header
  });

  test('should display files tab with associated documents', async () => {
    const user = userEvent.setup();
    const evidencePanel = screen.getByTestId('evidence-panel-INS-2024-03-001');
    
    // Click files tab
    await user.click(within(evidencePanel).getByRole('tab', { name: /filer/i }));

    const filesPanel = within(evidencePanel).getByRole('tabpanel', { name: /filer/i });
    expect(within(filesPanel).getByText(/3 dokument/i)).toBeInTheDocument();

    // Should show file list
    expect(within(filesPanel).getByText('invoice_2024_03.pdf')).toBeInTheDocument();
    expect(within(filesPanel).getByText('waste_report.xlsx')).toBeInTheDocument();
    expect(within(filesPanel).getByText('anomaly_evidence.png')).toBeInTheDocument();

    // Should have download buttons
    expect(within(filesPanel).getAllByRole('button', { name: /ladda ner/i })).toHaveLength(3);
  });

  test('should display charts tab with visualizations', async () => {
    const user = userEvent.setup();
    const evidencePanel = screen.getByTestId('evidence-panel-INS-2024-03-001');
    
    // Click charts tab
    await user.click(within(evidencePanel).getByRole('tab', { name: /diagram/i }));

    const chartsPanel = within(evidencePanel).getByRole('tabpanel', { name: /diagram/i });
    
    // Should show chart containers
    expect(within(chartsPanel).getByTestId('trend-chart')).toBeInTheDocument();
    expect(within(chartsPanel).getByTestId('distribution-chart')).toBeInTheDocument();
    expect(within(chartsPanel).getByTestId('correlation-chart')).toBeInTheDocument();
  });
});

describe('InsightsListInterface - Action Buttons', () => {
  test('should trigger explain action with LLM', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    const explainButton = screen.getByTestId('explain-button-INS-2024-03-001');
    await user.click(explainButton);

    // Should show loading state
    expect(screen.getByTestId('explain-loading-INS-2024-03-001')).toBeInTheDocument();

    // Should display explanation dialog
    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /förklaring av insikt/i });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/denna insikt indikerar/i)).toBeInTheDocument();
    });
  });

  test('should create scenario from insight', async () => {
    const user = userEvent.setup();
    const mockNavigate = jest.fn();
    
    renderWithProviders(<InsightsListInterface locale="sv" onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    const scenarioButton = screen.getByTestId('create-scenario-button-INS-2024-03-001');
    await user.click(scenarioButton);

    // Should navigate to scenario lab with prefilled data
    expect(mockNavigate).toHaveBeenCalledWith({
      path: '/scenario-lab',
      params: {
        insightId: 'INS-2024-03-001',
        prefill: true
      }
    });
  });

  test('should copy insight ID to clipboard', async () => {
    const user = userEvent.setup();
    const mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined)
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId('copy-id-button-INS-2024-03-001');
    await user.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('INS-2024-03-001');
    
    // Should show success message
    expect(screen.getByText(/id kopierat/i)).toBeInTheDocument();
  });

  test('should show action menu on mobile', async () => {
    const user = userEvent.setup();
    
    // Set mobile viewport
    global.innerWidth = 375;
    global.innerHeight = 667;
    
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    // On mobile, actions should be in dropdown menu
    const moreButton = screen.getByTestId('more-actions-button-INS-2024-03-001');
    await user.click(moreButton);

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /förklara/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /skapa scenario/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /kopiera id/i })).toBeInTheDocument();
  });
});

describe('InsightsListInterface - Pagination', () => {
  test('should navigate to next page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByTestId('page-info')).toHaveTextContent('Sida 1 av 5');
    });

    await user.click(screen.getByRole('button', { name: /nästa/i }));

    await waitFor(() => {
      expect(screen.getByTestId('page-info')).toHaveTextContent('Sida 2 av 5');
      // Different insights should be visible
      expect(screen.queryByText('INS-2024-03-001')).not.toBeInTheDocument();
      expect(screen.getByText('INS-2024-03-011')).toBeInTheDocument();
    });
  });

  test('should navigate to previous page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Go to page 2 first
    await user.click(screen.getByRole('button', { name: /nästa/i }));
    await waitFor(() => {
      expect(screen.getByTestId('page-info')).toHaveTextContent('Sida 2 av 5');
    });

    // Go back to page 1
    await user.click(screen.getByRole('button', { name: /föregående/i }));
    await waitFor(() => {
      expect(screen.getByTestId('page-info')).toHaveTextContent('Sida 1 av 5');
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });
  });

  test('should jump to specific page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    const pageInput = screen.getByRole('spinbutton', { name: /gå till sida/i });
    await user.clear(pageInput);
    await user.type(pageInput, '3');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('page-info')).toHaveTextContent('Sida 3 av 5');
    });
  });

  test('should change page size', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    const pageSizeSelector = screen.getByTestId('page-size-selector');
    await user.click(pageSizeSelector);
    await user.click(screen.getByRole('option', { name: /25 per sida/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(26); // 25 data + 1 header
      expect(screen.getByTestId('page-info')).toHaveTextContent('Sida 1 av 2');
    });
  });

  test('should disable previous button on first page', () => {
    renderWithProviders(<InsightsListInterface locale="sv" />);
    
    expect(screen.getByRole('button', { name: /föregående/i })).toBeDisabled();
  });

  test('should disable next button on last page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Navigate to last page
    const pageInput = screen.getByRole('spinbutton', { name: /gå till sida/i });
    await user.clear(pageInput);
    await user.type(pageInput, '5');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nästa/i })).toBeDisabled();
    });
  });
});

describe('InsightsListInterface - Real-time Updates', () => {
  test('should handle new insight via WebSocket', async () => {
    const { container } = renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(11);
    });

    // Simulate WebSocket message
    const wsMessage = {
      type: 'insight-created',
      data: {
        id: 'INS-2024-03-999',
        title: 'New Real-time Insight',
        severity: 'critical',
        status: 'new'
      }
    };

    // Trigger WebSocket event
    window.dispatchEvent(new CustomEvent('ws-message', { detail: wsMessage }));

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-999')).toBeInTheDocument();
      expect(screen.getByText('New Real-time Insight')).toBeInTheDocument();
    });
  });

  test('should handle insight update via WebSocket', async () => {
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    // Simulate status update
    const wsMessage = {
      type: 'insight-updated',
      data: {
        id: 'INS-2024-03-001',
        status: 'resolved'
      }
    };

    window.dispatchEvent(new CustomEvent('ws-message', { detail: wsMessage }));

    await waitFor(() => {
      const statusBadge = screen.getByTestId('status-badge-INS-2024-03-001');
      expect(statusBadge).toHaveTextContent(/löst/i);
    });
  });

  test('should handle insight deletion via WebSocket', async () => {
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    // Simulate deletion
    const wsMessage = {
      type: 'insight-deleted',
      data: {
        id: 'INS-2024-03-001'
      }
    };

    window.dispatchEvent(new CustomEvent('ws-message', { detail: wsMessage }));

    await waitFor(() => {
      expect(screen.queryByText('INS-2024-03-001')).not.toBeInTheDocument();
    });
  });
});

describe('InsightsListInterface - Accessibility', () => {
  test('should have no accessibility violations', async () => {
    const { container } = renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(11);
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(11);
    });

    // Tab through interactive elements
    await user.tab();
    expect(screen.getByTestId('severity-filter')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('status-filter')).toHaveFocus();

    // Navigate table with arrow keys
    const firstRow = screen.getAllByRole('row')[1]; // First data row
    firstRow.focus();

    await user.keyboard('{ArrowDown}');
    const secondRow = screen.getAllByRole('row')[2];
    expect(secondRow).toHaveFocus();

    // Expand row with Enter key
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('evidence-panel-INS-2024-03-002')).toBeInTheDocument();
  });

  test('should announce status changes to screen readers', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Select insights
    const checkboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
    await user.click(checkboxes[0]);

    // Check for aria-live region
    const liveRegion = screen.getByRole('status', { live: 'polite' });
    expect(liveRegion).toHaveTextContent('1 insikt vald');

    await user.click(checkboxes[1]);
    expect(liveRegion).toHaveTextContent('2 insikter valda');
  });

  test('should have proper ARIA labels', () => {
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Table should have accessible name
    expect(screen.getByRole('table')).toHaveAccessibleName(/insiktslista/i);

    // Filters should have labels
    expect(screen.getByTestId('severity-filter')).toHaveAccessibleName(/filtrera efter allvarlighet/i);
    expect(screen.getByTestId('status-filter')).toHaveAccessibleName(/filtrera efter status/i);
    expect(screen.getByTestId('source-filter')).toHaveAccessibleName(/filtrera efter källa/i);

    // Action buttons should have descriptive labels
    const explainButtons = screen.getAllByTestId(/explain-button/i);
    explainButtons.forEach(button => {
      expect(button).toHaveAccessibleName(/förklara insikt/i);
    });
  });
});

describe('InsightsListInterface - Error States', () => {
  test('should display error when data fetch fails', async () => {
    server.use(
      rest.get('/api/insights', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      })
    );

    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/kunde inte ladda insikter/i)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByRole('button', { name: /försök igen/i })).toBeInTheDocument();
  });

  test('should handle batch operation failures gracefully', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.post('/api/insights/batch-update', (req, res, ctx) => {
        return res(ctx.status(400), ctx.json({ error: 'Invalid request' }));
      })
    );

    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Select and try to update
    const checkboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: /ändra status/i }));

    const statusSelector = screen.getByTestId('batch-status-selector');
    await user.click(statusSelector);
    await user.click(screen.getByRole('option', { name: /validerad/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/uppdatering misslyckades/i);
    });
  });

  test('should show empty state when no insights', async () => {
    server.use(
      rest.get('/api/insights', (req, res, ctx) => {
        return res(ctx.json({ data: [], total: 0 }));
      })
    );

    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/inga insikter hittades/i)).toBeInTheDocument();
      expect(screen.getByText(/försök justera dina filter/i)).toBeInTheDocument();
    });
  });
});

describe('InsightsListInterface - Loading States', () => {
  test('should show skeleton loader while fetching data', () => {
    renderWithProviders(<InsightsListInterface locale="sv" />);

    // Should show skeleton rows
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(10);
    expect(screen.getByTestId('skeleton-pagination')).toBeInTheDocument();
  });

  test('should show inline loader for actions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    const explainButton = screen.getByTestId('explain-button-INS-2024-03-001');
    await user.click(explainButton);

    // Should show loading indicator
    expect(explainButton).toHaveAttribute('aria-busy', 'true');
    expect(within(explainButton).getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('InsightsListInterface - Optimistic Updates', () => {
  test('should optimistically update status with rollback on failure', async () => {
    const user = userEvent.setup();
    
    let shouldFail = false;
    server.use(
      rest.patch('/api/insights/:id', (req, res, ctx) => {
        if (shouldFail) {
          return res(ctx.status(500), ctx.json({ error: 'Update failed' }));
        }
        return res(ctx.json({ success: true }));
      })
    );

    renderWithProviders(<InsightsListInterface locale="sv" />);

    await waitFor(() => {
      expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
    });

    const initialStatus = screen.getByTestId('status-badge-INS-2024-03-001');
    expect(initialStatus).toHaveTextContent(/ny/i);

    // Set to fail
    shouldFail = true;

    // Change status - should update optimistically
    const statusCell = screen.getByTestId('status-cell-INS-2024-03-001');
    await user.click(within(statusCell).getByRole('button'));
    await user.click(screen.getByRole('option', { name: /validerad/i }));

    // Should immediately show new status
    expect(screen.getByTestId('status-badge-INS-2024-03-001')).toHaveTextContent(/validerad/i);

    // Should rollback after failure
    await waitFor(() => {
      expect(screen.getByTestId('status-badge-INS-2024-03-001')).toHaveTextContent(/ny/i);
      expect(screen.getByRole('alert')).toHaveTextContent(/kunde inte uppdatera status/i);
    });
  });
});