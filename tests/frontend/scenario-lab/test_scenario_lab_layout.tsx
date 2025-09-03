import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import { ScenarioLab } from '@/components/scenario-lab/scenario-lab'
import { ThemeProvider } from '@/lib/theme-provider'
import { MockProviders } from '../granskad/__mocks__/archon-mocks.tsx'

expect.extend(toHaveNoViolations)

// Mock data
const mockSuppliers = [
  { id: 'ABC-001', name: 'ABC Avfallshantering', region: 'Stockholm' },
  { id: 'DEF-002', name: 'DEF Återvinning', region: 'Göteborg' },
  { id: 'GHI-003', name: 'GHI Miljötjänster', region: 'Malmö' }
]

const mockInsights = [
  { id: 'INS-2024-11-001', title: 'Ovanlig viktökning', supplier: 'ABC-001' },
  { id: 'INS-2024-11-002', title: 'Saknad rapportering', supplier: 'DEF-002' }
]

// Test wrapper with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <MockProviders>
        {component}
      </MockProviders>
    </ThemeProvider>
  )
}

describe('ScenarioLab Layout', () => {
  const defaultProps = {
    suppliers: mockSuppliers,
    insights: mockInsights,
    onRun: jest.fn(),
    onSave: jest.fn(),
    onCreateInsight: jest.fn()
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Two-Pane Layout Structure', () => {
    it('renders two-pane layout with correct structure', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Main container should exist
      expect(screen.getByTestId('scenario-lab')).toBeInTheDocument()
      
      // Two main panels should exist
      expect(screen.getByTestId('scenario-controls-panel')).toBeInTheDocument()
      expect(screen.getByTestId('scenario-results-panel')).toBeInTheDocument()
      
      // Footer should exist
      expect(screen.getByTestId('scenario-footer')).toBeInTheDocument()
    })

    it('uses GlassCard components with correct variants', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Control panel should use subtle variant
      const controlPanel = screen.getByTestId('scenario-controls-panel')
      expect(controlPanel).toHaveClass('glass-subtle')
      
      // Results panel should use default variant
      const resultsPanel = screen.getByTestId('scenario-results-panel')
      expect(resultsPanel).toHaveClass('glass')
      
      // KPI cards should use strong variant when active
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      // After running, KPI cards should be visible with strong variant
      waitFor(() => {
        const kpiCards = screen.getAllByTestId(/^kpi-card-/)
        kpiCards.forEach(card => {
          expect(card).toHaveClass('glass-strong')
        })
      })
    })

    it('maintains proper grid layout and spacing', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const container = screen.getByTestId('scenario-lab')
      expect(container).toHaveClass('grid', 'grid-cols-12', 'gap-6', 'h-full')
      
      const controlPanel = screen.getByTestId('scenario-controls-panel')
      expect(controlPanel).toHaveClass('col-span-4', 'space-y-6')
      
      const resultsPanel = screen.getByTestId('scenario-results-panel')
      expect(resultsPanel).toHaveClass('col-span-8', 'space-y-6')
    })
  })

  describe('Left Panel Components', () => {
    it('renders cohort picker with Swedish labels', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Supplier selection
      expect(screen.getByLabelText('Leverantörer')).toBeInTheDocument()
      expect(screen.getByText('Välj leverantörer')).toBeInTheDocument()
      
      // Month range selection
      expect(screen.getByLabelText('Månadsintervall')).toBeInTheDocument()
      expect(screen.getByText('Välj period')).toBeInTheDocument()
    })

    it('renders parameter controls', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Threshold controls
      expect(screen.getByLabelText(/tröskelvärden/i)).toBeInTheDocument()
      expect(screen.getByText('Viktavvikelse (%)')).toBeInTheDocument()
      expect(screen.getByText('Rapporteringsgrad (%)')).toBeInTheDocument()
      
      // Operating hours controls
      expect(screen.getByLabelText(/arbetstider/i)).toBeInTheDocument()
      expect(screen.getByText('Starttid')).toBeInTheDocument()
      expect(screen.getByText('Sluttid')).toBeInTheDocument()
    })

    it('renders INS-ID search component', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText('Sök INS-ID (t.ex. INS-2024-11-001)')
      expect(searchInput).toBeInTheDocument()
      
      const searchLabel = screen.getByText('Baserat på Insights')
      expect(searchLabel).toBeInTheDocument()
    })
  })

  describe('Right Panel Components', () => {
    it('renders empty state initially', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const emptyState = screen.getByTestId('results-empty-state')
      expect(emptyState).toBeInTheDocument()
      expect(screen.getByText('Kör ett scenario för att se resultat')).toBeInTheDocument()
      expect(screen.getByText('Välj leverantörer och parametrar, sedan klicka Kör Scenario')).toBeInTheDocument()
    })

    it('shows Diff KPIs section when results available', async () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('diff-kpis-section')).toBeInTheDocument()
        expect(screen.getByText('KPI Jämförelse')).toBeInTheDocument()
      })
    })

    it('shows Flags change table section when results available', async () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('flags-change-table')).toBeInTheDocument()
        expect(screen.getByText('Förändringar i Flaggor')).toBeInTheDocument()
      })
    })

    it('shows Color heatmap section when results available', async () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('scenario-heatmap')).toBeInTheDocument()
        expect(screen.getByText('Statusöversikt per Leverantör')).toBeInTheDocument()
      })
    })

    it('shows Notes field', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const notesTextarea = screen.getByPlaceholderText('Lägg till anteckningar om scenariot...')
      expect(notesTextarea).toBeInTheDocument()
      expect(screen.getByText('Anteckningar')).toBeInTheDocument()
    })
  })

  describe('Footer Components', () => {
    it('renders Run button with proper states', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      expect(runButton).toBeInTheDocument()
      expect(runButton).not.toBeDisabled()
      
      // Should show loading state when clicked
      fireEvent.click(runButton)
      expect(screen.getByText('Kör scenario...')).toBeInTheDocument()
    })

    it('renders Save snapshot button', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const saveButton = screen.getByRole('button', { name: /spara snapshot/i })
      expect(saveButton).toBeInTheDocument()
      expect(saveButton).toBeDisabled() // Should be disabled initially
    })

    it('renders Link to Insights button', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const linkButton = screen.getByRole('button', { name: /länka till insights/i })
      expect(linkButton).toBeInTheDocument()
      expect(linkButton).toBeDisabled() // Should be disabled initially
    })
  })

  describe('Responsive Design', () => {
    const setViewport = (width: number) => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
      })
      window.dispatchEvent(new Event('resize'))
    }

    it('adapts to mobile viewport (360px+)', () => {
      setViewport(375)
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const container = screen.getByTestId('scenario-lab')
      expect(container).toHaveClass('grid-cols-1', 'md:grid-cols-12')
      
      // On mobile, both panels should stack vertically
      const controlPanel = screen.getByTestId('scenario-controls-panel')
      const resultsPanel = screen.getByTestId('scenario-results-panel')
      
      expect(controlPanel).toHaveClass('col-span-1', 'md:col-span-4')
      expect(resultsPanel).toHaveClass('col-span-1', 'md:col-span-8')
    })

    it('adapts to tablet viewport (768px+)', () => {
      setViewport(768)
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const container = screen.getByTestId('scenario-lab')
      expect(container).toHaveClass('md:grid-cols-12')
    })

    it('uses desktop layout for large screens (1024px+)', () => {
      setViewport(1024)
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const container = screen.getByTestId('scenario-lab')
      expect(container).toHaveClass('lg:grid-cols-12')
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithProviders(<ScenarioLab {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Should be able to tab through all interactive elements
      await user.tab()
      expect(screen.getByLabelText('Leverantörer')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('Månadsintervall')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByPlaceholderText('Sök INS-ID (t.ex. INS-2024-11-001)')).toHaveFocus()
    })

    it('has proper ARIA labels and roles', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Main sections should have proper roles and labels
      const controlPanel = screen.getByTestId('scenario-controls-panel')
      expect(controlPanel).toHaveAttribute('aria-label', 'Scenarioinställningar')
      
      const resultsPanel = screen.getByTestId('scenario-results-panel')
      expect(resultsPanel).toHaveAttribute('aria-label', 'Scenarioresultat')
      
      // Buttons should have accessible names
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      expect(runButton).toBeInTheDocument()
    })

    it('announces loading states to screen readers', async () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      // Should have aria-live region for status updates
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Kör scenario...')
      })
    })
  })

  describe('Error States and Validation', () => {
    it('shows validation error when no suppliers selected', async () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('Välj minst en leverantör')).toBeInTheDocument()
      })
    })

    it('shows validation error for invalid parameter values', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Enter invalid threshold value
      const thresholdInput = screen.getByLabelText('Viktavvikelse (%)')
      await user.clear(thresholdInput)
      await user.type(thresholdInput, '150') // Invalid: > 100%
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('Viktavvikelse måste vara mellan 0-100%')).toBeInTheDocument()
      })
    })

    it('handles API errors gracefully', async () => {
      const failingProps = {
        ...defaultProps,
        onRun: jest.fn().mockRejectedValue(new Error('API Error'))
      }
      
      renderWithProviders(<ScenarioLab {...failingProps} />)
      
      // Select a supplier first
      const supplierSelect = screen.getByLabelText('Leverantörer')
      fireEvent.click(supplierSelect)
      fireEvent.click(screen.getByText('ABC Avfallshantering'))
      
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('Ett fel uppstod vid körning av scenario')).toBeInTheDocument()
      })
    })
  })

  describe('Swedish Formatting and Terminology', () => {
    it('displays Swedish labels throughout the interface', () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Main section headers
      expect(screen.getByText('Scenarioinställningar')).toBeInTheDocument()
      expect(screen.getByText('Leverantörer')).toBeInTheDocument()
      expect(screen.getByText('Parametrar')).toBeInTheDocument()
      expect(screen.getByText('Baserat på Insights')).toBeInTheDocument()
      expect(screen.getByText('Anteckningar')).toBeInTheDocument()
      
      // Button labels
      expect(screen.getByRole('button', { name: /kör scenario/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /spara snapshot/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /länka till insights/i })).toBeInTheDocument()
    })

    it('formats numbers according to Swedish conventions', async () => {
      renderWithProviders(<ScenarioLab {...defaultProps} />)
      
      // Mock a scenario run
      const runButton = screen.getByRole('button', { name: /kör scenario/i })
      fireEvent.click(runButton)
      
      await waitFor(() => {
        // Should show Swedish decimal comma format for percentages
        expect(screen.getByText(/15,5%/)).toBeInTheDocument()
        // Should show Swedish thousand separator for large numbers
        expect(screen.getByText(/1 234 567/)).toBeInTheDocument()
      })
    })
  })
})