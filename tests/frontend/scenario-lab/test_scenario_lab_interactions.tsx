/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScenarioLab } from '@/components/scenario-lab/ScenarioLab';
import { ThemeProvider } from '@/lib/theme-provider';
import { mockScenarioAPI } from './mocks/scenario-mocks';
import '@testing-library/jest-dom';

// Mock API
jest.mock('@/services/scenario-api', () => ({
  ScenarioAPI: jest.fn(() => mockScenarioAPI())
}));

// Sample Swedish test data
const SWEDISH_SUPPLIERS = [
  { id: 'SUP-001', name: 'Stockholms Avfallshantering AB', region: 'Stockholm' },
  { id: 'SUP-002', name: 'Göteborgs Återvinning', region: 'Göteborg' },
  { id: 'SUP-003', name: 'Malmö Miljöservice', region: 'Malmö' },
  { id: 'SUP-004', name: 'Uppsala Kretslopp', region: 'Uppsala' }
];

const MOCK_INSIGHTS = [
  { id: 'INS-2024-03-001', title: 'Ökad återvinningsgrad Q1', severity: 'high' },
  { id: 'INS-2024-03-002', title: 'Kostnadsöverskridande transport', severity: 'medium' },
  { id: 'INS-2024-02-015', title: 'Säsongsvariation februari', severity: 'low' }
];

describe('ScenarioLab Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cohort Selection', () => {
    it('should allow multi-select of suppliers', async () => {
      const user = userEvent.setup();
      const onCohortChange = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab 
            suppliers={SWEDISH_SUPPLIERS}
            onCohortChange={onCohortChange}
          />
        </ThemeProvider>
      );

      const supplierSelect = screen.getByLabelText('Leverantörer');
      
      // Select multiple suppliers
      await user.click(supplierSelect);
      
      const dropdown = screen.getByRole('listbox');
      const option1 = within(dropdown).getByText('Stockholms Avfallshantering AB');
      const option2 = within(dropdown).getByText('Göteborgs Återvinning');
      
      await user.click(option1);
      await user.click(option2);

      // Should show selected count
      expect(screen.getByText('2 leverantörer valda')).toBeInTheDocument();

      // Callback should be called
      expect(onCohortChange).toHaveBeenCalledWith({
        supplierIds: ['SUP-001', 'SUP-002']
      });
    });

    it('should filter suppliers by search', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioLab suppliers={SWEDISH_SUPPLIERS} />
        </ThemeProvider>
      );

      const supplierSelect = screen.getByLabelText('Leverantörer');
      await user.click(supplierSelect);

      // Type to filter
      const searchInput = screen.getByPlaceholderText('Sök leverantör...');
      await user.type(searchInput, 'Stockholm');

      // Should only show matching supplier
      const dropdown = screen.getByRole('listbox');
      expect(within(dropdown).getByText('Stockholms Avfallshantering AB')).toBeInTheDocument();
      expect(within(dropdown).queryByText('Göteborgs Återvinning')).not.toBeInTheDocument();
    });

    it('should handle time range selection', async () => {
      const user = userEvent.setup();
      const onTimeRangeChange = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab onTimeRangeChange={onTimeRangeChange} />
        </ThemeProvider>
      );

      const timeRangeSelect = screen.getByLabelText('Tidsperiod');
      
      await user.selectOptions(timeRangeSelect, 'last-quarter');

      expect(onTimeRangeChange).toHaveBeenCalledWith({
        preset: 'last-quarter',
        startDate: expect.any(String),
        endDate: expect.any(String)
      });
    });

    it('should apply preset filters', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioLab suppliers={SWEDISH_SUPPLIERS} />
        </ThemeProvider>
      );

      // Click preset for "High volume suppliers"
      const presetButton = screen.getByRole('button', { name: /höga volymer/i });
      await user.click(presetButton);

      // Should apply filter
      const activeFilter = screen.getByTestId('active-filter-badge');
      expect(activeFilter).toHaveTextContent('Höga volymer');
    });
  });

  describe('Parameter Controls', () => {
    it('should update cost adjustment slider', async () => {
      const user = userEvent.setup();
      const onParameterChange = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab onParameterChange={onParameterChange} />
        </ThemeProvider>
      );

      const costSlider = screen.getByLabelText('Kostnadsjustering (%)');
      
      // Change slider value
      await user.clear(costSlider);
      await user.type(costSlider, '25');

      expect(costSlider).toHaveValue('25');
      
      // Should show value label
      expect(screen.getByText('+25%')).toBeInTheDocument();

      expect(onParameterChange).toHaveBeenCalledWith({
        parameter: 'costAdjustment',
        value: 25
      });
    });

    it('should update volume projection slider', async () => {
      const user = userEvent.setup();
      const onParameterChange = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab onParameterChange={onParameterChange} />
        </ThemeProvider>
      );

      const volumeSlider = screen.getByLabelText('Volymprognos (%)');
      
      await user.clear(volumeSlider);
      await user.type(volumeSlider, '-10');

      expect(volumeSlider).toHaveValue('-10');
      expect(screen.getByText('-10%')).toBeInTheDocument();

      expect(onParameterChange).toHaveBeenCalledWith({
        parameter: 'volumeProjection',
        value: -10
      });
    });

    it('should update service level dropdown', async () => {
      const user = userEvent.setup();
      const onParameterChange = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab onParameterChange={onParameterChange} />
        </ThemeProvider>
      );

      const serviceLevel = screen.getByLabelText('Servicenivå');
      
      await user.selectOptions(serviceLevel, 'premium');

      expect(serviceLevel).toHaveValue('premium');
      expect(onParameterChange).toHaveBeenCalledWith({
        parameter: 'serviceLevel',
        value: 'premium'
      });
    });

    it('should show parameter reset button when changed', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioLab />
        </ThemeProvider>
      );

      // Initially no reset button
      expect(screen.queryByRole('button', { name: /återställ/i })).not.toBeInTheDocument();

      // Change a parameter
      const costSlider = screen.getByLabelText('Kostnadsjustering (%)');
      await user.clear(costSlider);
      await user.type(costSlider, '15');

      // Reset button should appear
      const resetButton = screen.getByRole('button', { name: /återställ parametrar/i });
      expect(resetButton).toBeInTheDocument();

      // Click reset
      await user.click(resetButton);

      // Should reset to default
      expect(costSlider).toHaveValue('0');
    });
  });

  describe('INS-ID Search and Selection', () => {
    it('should search for insights by ID', async () => {
      const user = userEvent.setup();
      const mockAPI = mockScenarioAPI();

      render(
        <ThemeProvider>
          <ScenarioLab api={mockAPI} />
        </ThemeProvider>
      );

      const searchInput = screen.getByPlaceholderText('Sök INS-ID (ex: INS-2024-03-001)');
      
      // Type valid INS-ID
      await user.type(searchInput, 'INS-2024-03');

      // Should show autocomplete suggestions
      await waitFor(() => {
        const suggestions = screen.getByRole('listbox', { name: /insiktsförslag/i });
        expect(suggestions).toBeInTheDocument();
        
        MOCK_INSIGHTS.forEach(insight => {
          expect(within(suggestions).getByText(insight.id)).toBeInTheDocument();
        });
      });
    });

    it('should validate INS-ID format', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioLab />
        </ThemeProvider>
      );

      const searchInput = screen.getByPlaceholderText('Sök INS-ID (ex: INS-2024-03-001)');
      
      // Type invalid format
      await user.type(searchInput, 'INVALID-ID');

      // Should show validation error
      const errorMessage = screen.getByText('Ogiltigt INS-ID format');
      expect(errorMessage).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('should add insights to selection', async () => {
      const user = userEvent.setup();
      const onInsightSelect = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab 
            insights={MOCK_INSIGHTS}
            onInsightSelect={onInsightSelect}
          />
        </ThemeProvider>
      );

      const searchInput = screen.getByPlaceholderText('Sök INS-ID (ex: INS-2024-03-001)');
      
      // Search and select
      await user.type(searchInput, 'INS-2024-03-001');
      
      const suggestion = await screen.findByRole('option', { name: /INS-2024-03-001/ });
      await user.click(suggestion);

      // Should add to selected list
      const selectedList = screen.getByTestId('selected-insights-list');
      expect(within(selectedList).getByText('INS-2024-03-001')).toBeInTheDocument();
      expect(within(selectedList).getByText('Ökad återvinningsgrad Q1')).toBeInTheDocument();

      expect(onInsightSelect).toHaveBeenCalledWith(['INS-2024-03-001']);
    });

    it('should remove insights from selection', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioLab 
            insights={MOCK_INSIGHTS}
            selectedInsights={['INS-2024-03-001', 'INS-2024-03-002']}
          />
        </ThemeProvider>
      );

      const selectedList = screen.getByTestId('selected-insights-list');
      
      // Should show selected insights
      expect(within(selectedList).getByText('INS-2024-03-001')).toBeInTheDocument();
      expect(within(selectedList).getByText('INS-2024-03-002')).toBeInTheDocument();

      // Remove one
      const removeButton = within(selectedList).getAllByRole('button', { name: /ta bort/i })[0];
      await user.click(removeButton);

      // Should be removed
      expect(within(selectedList).queryByText('INS-2024-03-001')).not.toBeInTheDocument();
      expect(within(selectedList).getByText('INS-2024-03-002')).toBeInTheDocument();
    });
  });

  describe('Scenario Execution', () => {
    it('should validate before running scenario', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioLab suppliers={SWEDISH_SUPPLIERS} />
        </ThemeProvider>
      );

      // Try to run without selecting suppliers
      const runButton = screen.getByRole('button', { name: /kör scenario/i });
      await user.click(runButton);

      // Should show validation errors
      const errors = screen.getAllByRole('alert');
      expect(errors[0]).toHaveTextContent('Välj minst en leverantör');
    });

    it('should run scenario with selected parameters', async () => {
      const user = userEvent.setup();
      const mockAPI = mockScenarioAPI();
      const onScenarioRun = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab 
            api={mockAPI}
            suppliers={SWEDISH_SUPPLIERS}
            onScenarioRun={onScenarioRun}
          />
        </ThemeProvider>
      );

      // Select suppliers
      const supplierSelect = screen.getByLabelText('Leverantörer');
      await user.click(supplierSelect);
      const option = within(screen.getByRole('listbox')).getByText('Stockholms Avfallshantering AB');
      await user.click(option);

      // Adjust parameters
      const costSlider = screen.getByLabelText('Kostnadsjustering (%)');
      await user.clear(costSlider);
      await user.type(costSlider, '15');

      // Run scenario
      const runButton = screen.getByRole('button', { name: /kör scenario/i });
      await user.click(runButton);

      // Should show loading state
      expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
      expect(runButton).toHaveTextContent('Kör...');
      expect(runButton).toBeDisabled();

      // Wait for results
      await waitFor(() => {
        expect(onScenarioRun).toHaveBeenCalledWith({
          suppliers: ['SUP-001'],
          parameters: {
            costAdjustment: 15,
            volumeProjection: 0,
            serviceLevel: 'standard'
          },
          insights: []
        });
      });
    });

    it('should display progressive results', async () => {
      const user = userEvent.setup();
      const mockAPI = mockScenarioAPI();

      render(
        <ThemeProvider>
          <ScenarioLab 
            api={mockAPI}
            suppliers={SWEDISH_SUPPLIERS}
          />
        </ThemeProvider>
      );

      // Setup and run
      const supplierSelect = screen.getByLabelText('Leverantörer');
      await user.click(supplierSelect);
      await user.click(within(screen.getByRole('listbox')).getByText('Stockholms Avfallshantering AB'));

      const runButton = screen.getByRole('button', { name: /kör scenario/i });
      await user.click(runButton);

      // Should show results progressively
      await waitFor(() => {
        // KPIs should appear first
        const kpiSection = screen.getByTestId('diff-kpis-section');
        expect(within(kpiSection).getByText('Total kostnad')).toBeInTheDocument();
      });

      await waitFor(() => {
        // Then flags table
        const flagsSection = screen.getByTestId('flags-table-section');
        expect(within(flagsSection).getByText('Högrisk')).toBeInTheDocument();
      });

      await waitFor(() => {
        // Finally heatmap
        const heatmapSection = screen.getByTestId('heatmap-section');
        expect(within(heatmapSection).getByTestId('heatmap-canvas')).toBeInTheDocument();
      });
    });
  });

  describe('Results Display', () => {
    it('should format and display KPI differences', async () => {
      const mockResults = {
        kpis: [
          { name: 'Total kostnad', current: 1500000, scenario: 1725000, unit: 'SEK' },
          { name: 'Återvinningsgrad', current: 45, scenario: 52, unit: '%' },
          { name: 'CO2-utsläpp', current: 2500, scenario: 2100, unit: 'ton' }
        ]
      };

      render(
        <ThemeProvider>
          <ScenarioLab scenarioResults={mockResults} />
        </ThemeProvider>
      );

      const kpiSection = screen.getByTestId('diff-kpis-section');

      // Check cost formatting (Swedish)
      expect(within(kpiSection).getByText('1 500 000 SEK')).toBeInTheDocument();
      expect(within(kpiSection).getByText('1 725 000 SEK')).toBeInTheDocument();
      expect(within(kpiSection).getByText('+15,0%')).toBeInTheDocument();

      // Check recycling rate
      expect(within(kpiSection).getByText('45,0%')).toBeInTheDocument();
      expect(within(kpiSection).getByText('52,0%')).toBeInTheDocument();
      expect(within(kpiSection).getByText('+7,0 p.e.')).toBeInTheDocument(); // percentage points

      // Check CO2 (negative change)
      expect(within(kpiSection).getByText('2 500 ton')).toBeInTheDocument();
      expect(within(kpiSection).getByText('2 100 ton')).toBeInTheDocument();
      expect(within(kpiSection).getByText('-16,0%')).toBeInTheDocument();
    });

    it('should display flags change table', async () => {
      const mockResults = {
        flags: [
          { name: 'Högrisk', current: 3, scenario: 5, change: 2 },
          { name: 'Mediumrisk', current: 8, scenario: 6, change: -2 },
          { name: 'Lågrisk', current: 12, scenario: 11, change: -1 }
        ]
      };

      render(
        <ThemeProvider>
          <ScenarioLab scenarioResults={mockResults} />
        </ThemeProvider>
      );

      const flagsSection = screen.getByTestId('flags-table-section');

      // Check table content
      mockResults.flags.forEach(flag => {
        const row = within(flagsSection).getByText(flag.name).closest('tr');
        expect(within(row!).getByText(flag.current.toString())).toBeInTheDocument();
        expect(within(row!).getByText(flag.scenario.toString())).toBeInTheDocument();
        
        // Check change formatting
        if (flag.change > 0) {
          expect(within(row!).getByText(`+${flag.change}`)).toBeInTheDocument();
          expect(within(row!).getByText(`+${flag.change}`)).toHaveClass('text-red-600');
        } else {
          expect(within(row!).getByText(flag.change.toString())).toBeInTheDocument();
          expect(within(row!).getByText(flag.change.toString())).toHaveClass('text-green-600');
        }
      });
    });

    it('should render interactive heatmap', async () => {
      const user = userEvent.setup();
      const mockResults = {
        heatmap: {
          data: [
            [0.2, 0.5, 0.8, 0.3],
            [0.7, 0.1, 0.4, 0.9],
            [0.3, 0.6, 0.2, 0.5]
          ],
          labels: {
            x: ['Jan', 'Feb', 'Mar', 'Apr'],
            y: ['Stockholm', 'Göteborg', 'Malmö']
          }
        }
      };

      render(
        <ThemeProvider>
          <ScenarioLab scenarioResults={mockResults} />
        </ThemeProvider>
      );

      const heatmapCanvas = screen.getByTestId('heatmap-canvas');
      expect(heatmapCanvas).toBeInTheDocument();

      // Hover for tooltip
      await user.hover(heatmapCanvas);

      // Should show tooltip
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveTextContent(/Stockholm.*Jan/);
      });
    });
  });

  describe('Save and Export', () => {
    it('should save scenario snapshot', async () => {
      const user = userEvent.setup();
      const onSaveSnapshot = jest.fn();
      const mockResults = { /* ... scenario results ... */ };

      render(
        <ThemeProvider>
          <ScenarioLab 
            scenarioResults={mockResults}
            onSaveSnapshot={onSaveSnapshot}
          />
        </ThemeProvider>
      );

      const saveButton = screen.getByRole('button', { name: /spara ögonblicksbild/i });
      expect(saveButton).not.toBeDisabled();

      await user.click(saveButton);

      // Should open save dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Enter snapshot name
      const nameInput = within(dialog).getByLabelText('Namn på ögonblicksbild');
      await user.type(nameInput, 'Q1 2024 Kostnadsprognos');

      // Add description
      const descriptionInput = within(dialog).getByLabelText('Beskrivning');
      await user.type(descriptionInput, 'Scenario med 15% kostnadsökning för Stockholm');

      // Save
      const confirmButton = within(dialog).getByRole('button', { name: /spara/i });
      await user.click(confirmButton);

      expect(onSaveSnapshot).toHaveBeenCalledWith({
        name: 'Q1 2024 Kostnadsprognos',
        description: 'Scenario med 15% kostnadsökning för Stockholm',
        timestamp: expect.any(String),
        results: mockResults
      });

      // Should show success message
      expect(screen.getByText('Ögonblicksbild sparad')).toBeInTheDocument();
    });

    it('should create insight from scenario', async () => {
      const user = userEvent.setup();
      const onCreateInsight = jest.fn();
      const mockResults = { /* ... scenario results ... */ };

      render(
        <ThemeProvider>
          <ScenarioLab 
            scenarioResults={mockResults}
            onCreateInsight={onCreateInsight}
          />
        </ThemeProvider>
      );

      const createInsightButton = screen.getByRole('button', { name: /skapa insikt/i });
      await user.click(createInsightButton);

      // Should open insight creation dialog
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Skapa insikt från scenario')).toBeInTheDocument();

      // Fill insight details
      const titleInput = within(dialog).getByLabelText('Insiktstitel');
      await user.type(titleInput, 'Kostnadsökning Q1 2024');

      const severitySelect = within(dialog).getByLabelText('Allvarlighetsgrad');
      await user.selectOptions(severitySelect, 'high');

      const categorySelect = within(dialog).getByLabelText('Kategori');
      await user.selectOptions(categorySelect, 'cost');

      // Submit
      const submitButton = within(dialog).getByRole('button', { name: /skapa/i });
      await user.click(submitButton);

      expect(onCreateInsight).toHaveBeenCalledWith({
        title: 'Kostnadsökning Q1 2024',
        severity: 'high',
        category: 'cost',
        scenarioData: mockResults
      });

      // Should show new INS-ID
      await waitFor(() => {
        expect(screen.getByText(/INS-2024-03-\d{3}/)).toBeInTheDocument();
      });
    });
  });

  describe('Notes Functionality', () => {
    it('should save notes with scenario', async () => {
      const user = userEvent.setup();
      const onNotesChange = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab onNotesChange={onNotesChange} />
        </ThemeProvider>
      );

      const notesTextarea = screen.getByPlaceholderText('Lägg till anteckningar om detta scenario...');
      
      await user.type(notesTextarea, 'Detta scenario visar potentiell kostnadsbesparing genom optimerad rutt.');

      expect(notesTextarea).toHaveValue('Detta scenario visar potentiell kostnadsbesparing genom optimerad rutt.');
      
      // Check character count
      expect(screen.getByText('75 / 500')).toBeInTheDocument();

      // Should debounce onChange
      await waitFor(() => {
        expect(onNotesChange).toHaveBeenCalledWith(
          'Detta scenario visar potentiell kostnadsbesparing genom optimerad rutt.'
        );
      }, { timeout: 1000 });
    });

    it('should enforce character limit', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ScenarioLab />
        </ThemeProvider>
      );

      const notesTextarea = screen.getByPlaceholderText('Lägg till anteckningar om detta scenario...');
      
      // Try to type more than 500 characters
      const longText = 'x'.repeat(501);
      await user.type(notesTextarea, longText);

      // Should truncate to 500
      expect(notesTextarea).toHaveValue('x'.repeat(500));
      expect(screen.getByText('500 / 500')).toBeInTheDocument();
      expect(screen.getByText('500 / 500')).toHaveClass('text-red-600');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should run scenario with Cmd+Enter', async () => {
      const user = userEvent.setup();
      const onScenarioRun = jest.fn();

      render(
        <ThemeProvider>
          <ScenarioLab 
            suppliers={SWEDISH_SUPPLIERS}
            onScenarioRun={onScenarioRun}
          />
        </ThemeProvider>
      );

      // Select supplier first
      const supplierSelect = screen.getByLabelText('Leverantörer');
      await user.click(supplierSelect);
      await user.click(within(screen.getByRole('listbox')).getByText('Stockholms Avfallshantering AB'));

      // Press Cmd+Enter
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(onScenarioRun).toHaveBeenCalled();
    });

    it('should save snapshot with Cmd+S', async () => {
      const user = userEvent.setup();
      const onSaveSnapshot = jest.fn();
      const mockResults = { /* ... */ };

      render(
        <ThemeProvider>
          <ScenarioLab 
            scenarioResults={mockResults}
            onSaveSnapshot={onSaveSnapshot}
          />
        </ThemeProvider>
      );

      // Press Cmd+S
      await user.keyboard('{Meta>}s{/Meta}');

      // Should open save dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});