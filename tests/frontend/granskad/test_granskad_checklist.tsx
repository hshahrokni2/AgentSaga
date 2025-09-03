/**
 * @fileoverview Test suite for Granskad Checklist System
 * Tests checklist completion, validation, and button enabling logic
 * 
 * CRITICAL: These tests MUST fail initially per TDD RED phase
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Component imports - These don't exist yet (RED phase)
import { ChecklistPanel } from '@/components/granskad/ChecklistPanel';
import { GranskadWorkflow } from '@/components/granskad/GranskadWorkflow';
import { ChecklistItem, ChecklistCategory } from '@/types/granskad';
import { useChecklistStore } from '@/stores/checklistStore';

// Default checklist items for Swedish waste management review
const DEFAULT_CHECKLIST_ITEMS: ChecklistCategory[] = [
  {
    id: 'data-quality',
    name: 'Datakvalitet',
    items: [
      { id: 'dq-1', label: 'Alla månadsdata är kompletta', required: true },
      { id: 'dq-2', label: 'Inga saknade leverantörer', required: true },
      { id: 'dq-3', label: 'Formatering är konsekvent', required: true },
      { id: 'dq-4', label: 'Summor stämmer överens', required: true }
    ]
  },
  {
    id: 'compliance',
    name: 'Regelefterlevnad',
    items: [
      { id: 'comp-1', label: 'GDPR-krav uppfyllda', required: true },
      { id: 'comp-2', label: 'Personnummer är maskade', required: true },
      { id: 'comp-3', label: 'Svensk standard följd', required: false },
      { id: 'comp-4', label: 'EU/EES datahantering', required: true }
    ]
  },
  {
    id: 'validation',
    name: 'Validering',
    items: [
      { id: 'val-1', label: 'AI-insikter verifierade', required: false },
      { id: 'val-2', label: 'Anomalier granskade', required: true },
      { id: 'val-3', label: 'Trender bekräftade', required: false },
      { id: 'val-4', label: 'Rapporter genererade', required: true }
    ]
  }
];

describe('GranskadWorkflow - Checklist System', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Checklist Rendering', () => {
    test('should render all checklist categories and items', () => {
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      // Check categories
      DEFAULT_CHECKLIST_ITEMS.forEach(category => {
        const categoryHeader = screen.getByRole('heading', { name: category.name });
        expect(categoryHeader).toBeInTheDocument();
      });

      // Check all items
      const checkboxes = screen.getAllByRole('checkbox');
      const totalItems = DEFAULT_CHECKLIST_ITEMS.reduce((acc, cat) => acc + cat.items.length, 0);
      expect(checkboxes).toHaveLength(totalItems);
    });

    test('should indicate required vs optional items', () => {
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      DEFAULT_CHECKLIST_ITEMS.forEach(category => {
        category.items.forEach(item => {
          const checkbox = screen.getByRole('checkbox', { name: new RegExp(item.label) });
          const container = checkbox.closest('[data-checklist-item]');
          
          if (item.required) {
            expect(container).toHaveAttribute('data-required', 'true');
            
            // Should have required indicator
            const requiredBadge = within(container!).getByText('*Obligatorisk');
            expect(requiredBadge).toBeInTheDocument();
            expect(requiredBadge).toHaveClass('text-red-500');
          } else {
            expect(container).toHaveAttribute('data-required', 'false');
            
            // Should have optional indicator
            const optionalBadge = within(container!).getByText('Valfri');
            expect(optionalBadge).toBeInTheDocument();
            expect(optionalBadge).toHaveClass('text-gray-500');
          }
        });
      });
    });

    test('should show progress indicator', () => {
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const progressBar = screen.getByRole('progressbar', { name: /checklista framsteg/i });
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      
      const totalItems = DEFAULT_CHECKLIST_ITEMS.reduce((acc, cat) => acc + cat.items.length, 0);
      expect(progressBar).toHaveAttribute('aria-valuemax', String(totalItems));

      // Visual progress text
      const progressText = screen.getByText(/0 av \d+ punkter klara/i);
      expect(progressText).toBeInTheDocument();
    });
  });

  describe('Checklist Completion Logic', () => {
    test('should update progress when items are checked', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const firstCheckbox = screen.getByRole('checkbox', { name: /alla månadsdata är kompletta/i });
      await user.click(firstCheckbox);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');

      const progressText = screen.getByText(/1 av \d+ punkter klara/i);
      expect(progressText).toBeInTheDocument();
    });

    test('should calculate completion percentage correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const totalItems = checkboxes.length;
      
      // Check half of the items
      for (let i = 0; i < Math.floor(totalItems / 2); i++) {
        await user.click(checkboxes[i]);
      }

      const percentageText = screen.getByText(/50%/);
      expect(percentageText).toBeInTheDocument();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    test('should distinguish between required and optional completion', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      // Check only optional items
      const optionalItems = screen.getAllByRole('checkbox').filter(checkbox => {
        const container = checkbox.closest('[data-checklist-item]');
        return container?.getAttribute('data-required') === 'false';
      });

      for (const item of optionalItems) {
        await user.click(item);
      }

      // Should show required items warning
      const requiredWarning = screen.getByRole('alert');
      expect(requiredWarning).toHaveTextContent(/obligatoriska punkter återstår/i);
      expect(requiredWarning).toHaveClass('text-amber-600');
    });

    test('should track completion time for each item', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /alla månadsdata är kompletta/i });
      const startTime = Date.now();
      
      await user.click(checkbox);

      // Get completion timestamp
      const container = checkbox.closest('[data-checklist-item]');
      const timestamp = container?.getAttribute('data-completed-at');
      
      expect(timestamp).toBeTruthy();
      const completedAt = new Date(timestamp!).getTime();
      expect(completedAt).toBeGreaterThanOrEqual(startTime);
      expect(completedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Button Enabling Logic', () => {
    test('should disable "Markera som granskad" button when checklist incomplete', () => {
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          checklistCategories={DEFAULT_CHECKLIST_ITEMS}
        />
      );

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      expect(completeButton).toBeDisabled();
      expect(completeButton).toHaveAttribute('aria-disabled', 'true');
    });

    test('should enable button only when ALL required items are checked', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          checklistCategories={DEFAULT_CHECKLIST_ITEMS}
        />
      );

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      
      // Check all required items
      const requiredCheckboxes = screen.getAllByRole('checkbox').filter(checkbox => {
        const container = checkbox.closest('[data-checklist-item]');
        return container?.getAttribute('data-required') === 'true';
      });

      for (const checkbox of requiredCheckboxes) {
        await user.click(checkbox);
      }

      await waitFor(() => {
        expect(completeButton).toBeEnabled();
        expect(completeButton).not.toHaveAttribute('aria-disabled');
      });
    });

    test('should re-disable button if required item is unchecked', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          checklistCategories={DEFAULT_CHECKLIST_ITEMS}
        />
      );

      // Check all required items
      const requiredCheckboxes = screen.getAllByRole('checkbox').filter(checkbox => {
        const container = checkbox.closest('[data-checklist-item]');
        return container?.getAttribute('data-required') === 'true';
      });

      for (const checkbox of requiredCheckboxes) {
        await user.click(checkbox);
      }

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      await waitFor(() => expect(completeButton).toBeEnabled());

      // Uncheck one required item
      await user.click(requiredCheckboxes[0]);

      expect(completeButton).toBeDisabled();
    });

    test('should show tooltip explaining why button is disabled', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          checklistCategories={DEFAULT_CHECKLIST_ITEMS}
        />
      );

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      
      await user.hover(completeButton);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent(/följande obligatoriska punkter måste slutföras/i);

      // Should list unchecked required items
      const uncheckedRequired = DEFAULT_CHECKLIST_ITEMS.flatMap(cat =>
        cat.items.filter(item => item.required)
      );

      uncheckedRequired.forEach(item => {
        expect(tooltip).toHaveTextContent(item.label);
      });
    });
  });

  describe('Checklist Persistence', () => {
    test('should persist checklist state to localStorage', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /alla månadsdata är kompletta/i });
      await user.click(checkbox);

      const savedState = localStorage.getItem('checklist-2024-01-supplier-123');
      expect(savedState).toBeTruthy();

      const parsed = JSON.parse(savedState!);
      expect(parsed['dq-1']).toEqual({
        checked: true,
        completedAt: expect.any(String),
        completedBy: expect.any(String)
      });
    });

    test('should restore checklist state on mount', () => {
      const savedState = {
        'dq-1': { checked: true, completedAt: '2024-01-15T10:00:00Z', completedBy: 'user-123' },
        'comp-1': { checked: true, completedAt: '2024-01-15T10:05:00Z', completedBy: 'user-123' }
      };

      localStorage.setItem('checklist-2024-01-supplier-123', JSON.stringify(savedState));

      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const checkbox1 = screen.getByRole('checkbox', { name: /alla månadsdata är kompletta/i });
      const checkbox2 = screen.getByRole('checkbox', { name: /gdpr-krav uppfyllda/i });

      expect(checkbox1).toBeChecked();
      expect(checkbox2).toBeChecked();

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '2');
    });

    test('should sync checklist state across tabs', async () => {
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      // Simulate storage event from another tab
      const newState = {
        'dq-1': { checked: true, completedAt: new Date().toISOString(), completedBy: 'user-456' }
      };

      act(() => {
        localStorage.setItem('checklist-2024-01-supplier-123', JSON.stringify(newState));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'checklist-2024-01-supplier-123',
          newValue: JSON.stringify(newState)
        }));
      });

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox', { name: /alla månadsdata är kompletta/i });
        expect(checkbox).toBeChecked();
      });
    });
  });

  describe('Category Completion', () => {
    test('should show category as complete when all items checked', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const dataQualityCategory = DEFAULT_CHECKLIST_ITEMS[0];
      
      // Check all items in category
      for (const item of dataQualityCategory.items) {
        const checkbox = screen.getByRole('checkbox', { name: new RegExp(item.label) });
        await user.click(checkbox);
      }

      // Category should show as complete
      const categoryHeader = screen.getByRole('heading', { name: dataQualityCategory.name });
      const categoryContainer = categoryHeader.closest('[data-category]');
      
      expect(categoryContainer).toHaveAttribute('data-complete', 'true');
      
      const completeBadge = within(categoryContainer!).getByRole('img', { name: /komplett/i });
      expect(completeBadge).toBeInTheDocument();
      expect(completeBadge).toHaveClass('text-green-600');
    });

    test('should collapse/expand categories', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const categoryHeader = screen.getByRole('heading', { name: /datakvalitet/i });
      const toggleButton = within(categoryHeader.parentElement!).getByRole('button', { name: /visa\/dölj/i });

      // Items should be visible initially
      const firstItem = screen.getByRole('checkbox', { name: /alla månadsdata är kompletta/i });
      expect(firstItem).toBeVisible();

      // Collapse
      await user.click(toggleButton);
      expect(firstItem).not.toBeVisible();

      // Expand
      await user.click(toggleButton);
      expect(firstItem).toBeVisible();
    });
  });

  describe('Checklist Validation', () => {
    test('should validate checklist integrity on load', () => {
      const corruptedState = {
        'invalid-id': { checked: true }, // Non-existent item
        'dq-1': { checked: 'not-boolean' } // Invalid data
      };

      localStorage.setItem('checklist-2024-01-supplier-123', JSON.stringify(corruptedState));
      
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Ogiltig checklista-data, återställer')
      );

      // Should reset to empty state
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });

      consoleWarn.mockRestore();
    });

    test('should prevent checking items in locked state', () => {
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
          locked={true}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeDisabled();
        expect(checkbox).toHaveAttribute('aria-disabled', 'true');
      });

      // Should show lock indicator
      const lockBadge = screen.getByRole('img', { name: /låst checklista/i });
      expect(lockBadge).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should support keyboard navigation through checklist', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Tab through checkboxes
      await user.tab();
      expect(checkboxes[0]).toHaveFocus();

      await user.keyboard(' '); // Space to check
      expect(checkboxes[0]).toBeChecked();

      await user.tab();
      expect(checkboxes[1]).toHaveFocus();
    });

    test('should announce checklist progress to screen readers', async () => {
      const user = userEvent.setup();
      
      render(
        <ChecklistPanel 
          categories={DEFAULT_CHECKLIST_ITEMS}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const liveRegion = screen.getByRole('status', { name: /checklista meddelanden/i });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      const checkbox = screen.getByRole('checkbox', { name: /alla månadsdata är kompletta/i });
      await user.click(checkbox);

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/1 av \d+ punkter slutförda/i);
      });
    });
  });
});