import React from 'react'
import { render, screen } from '@testing-library/react'
import { ScenarioLab } from '@/components/scenario-lab/scenario-lab'

// Simple test data
const mockSuppliers = [
  { id: 'ABC-001', name: 'ABC Avfallshantering', region: 'Stockholm' }
]

const mockInsights = [
  { id: 'INS-2024-11-001', title: 'Test insight', supplier: 'ABC-001' }
]

// Mock functions
const mockOnRun = jest.fn()
const mockOnSave = jest.fn()
const mockOnCreateInsight = jest.fn()

describe('ScenarioLab Simple Test', () => {
  it('renders without crashing', () => {
    render(
      <ScenarioLab
        suppliers={mockSuppliers}
        insights={mockInsights}
        onRun={mockOnRun}
        onSave={mockOnSave}
        onCreateInsight={mockOnCreateInsight}
      />
    )
    
    expect(screen.getByTestId('scenario-lab')).toBeInTheDocument()
  })
})