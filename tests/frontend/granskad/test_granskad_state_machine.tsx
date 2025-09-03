/**
 * @fileoverview Test suite for Granskad Workflow State Machine
 * Tests state transitions, validation, and persistence
 * 
 * CRITICAL: These tests MUST fail initially per TDD RED phase
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';

// Component imports - These don't exist yet (RED phase)
import { GranskadWorkflow } from '@/components/granskad/GranskadWorkflow';
import { GranskadStateProvider, useGranskadState } from '@/contexts/GranskadStateContext';
import { GranskadStatus, StateTransition } from '@/types/granskad';
import { mockArchonAPI } from '@/test-utils/archon-mocks';

// Swedish state names
const STATES = {
  UNREVIEWED: 'Ogranskad',
  IN_PROGRESS: 'Pågående granskning',
  FULLY_REVIEWED: 'Helt granskad'
} as const;

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  [STATES.UNREVIEWED]: [STATES.IN_PROGRESS],
  [STATES.IN_PROGRESS]: [STATES.FULLY_REVIEWED],
  [STATES.FULLY_REVIEWED]: [] // Terminal state
};

describe('GranskadWorkflow - State Machine', () => {
  let archonMock: ReturnType<typeof mockArchonAPI>;

  beforeEach(() => {
    archonMock = mockArchonAPI();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    test('should initialize with UNREVIEWED state for new workflows', () => {
      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
      expect(statusBadge).toHaveTextContent(STATES.UNREVIEWED);
      expect(statusBadge).toHaveClass('bg-gray-100', 'text-gray-800');
    });

    test('should restore previous state from persistence', () => {
      // Set up persisted state
      const persistedState = {
        monthId: '2024-01',
        supplierId: 'supplier-123',
        status: STATES.IN_PROGRESS,
        startedAt: '2024-01-15T10:00:00Z',
        checklistProgress: 5,
        totalChecklistItems: 10
      };
      
      localStorage.setItem('granskad-state-2024-01-supplier-123', JSON.stringify(persistedState));

      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
      expect(statusBadge).toHaveTextContent(STATES.IN_PROGRESS);
      
      const progressIndicator = screen.getByRole('progressbar', { name: /checklista framsteg/i });
      expect(progressIndicator).toHaveAttribute('aria-valuenow', '5');
      expect(progressIndicator).toHaveAttribute('aria-valuemax', '10');
    });

    test('should validate restored state integrity', () => {
      // Set up corrupted state
      const corruptedState = {
        monthId: '2024-01',
        supplierId: 'supplier-123',
        status: 'INVALID_STATUS', // Invalid status
        startedAt: 'not-a-date' // Invalid date
      };
      
      localStorage.setItem('granskad-state-2024-01-supplier-123', JSON.stringify(corruptedState));
      
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      // Should fall back to initial state
      const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
      expect(statusBadge).toHaveTextContent(STATES.UNREVIEWED);
      
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Ogiltig sparad status, återställer till initial')
      );
      
      consoleWarn.mockRestore();
    });
  });

  describe('Valid State Transitions', () => {
    test('should transition from UNREVIEWED to IN_PROGRESS when review starts', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      expect(startButton).toBeEnabled();

      await user.click(startButton);

      await waitFor(() => {
        const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
        expect(statusBadge).toHaveTextContent(STATES.IN_PROGRESS);
      });

      // Should create audit log entry
      expect(archonMock.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STATE_TRANSITION',
          fromState: STATES.UNREVIEWED,
          toState: STATES.IN_PROGRESS,
          monthId: '2024-01',
          supplierId: 'supplier-123'
        })
      );
    });

    test('should transition from IN_PROGRESS to FULLY_REVIEWED when all requirements met', async () => {
      const user = userEvent.setup();
      
      // Start with IN_PROGRESS state
      const initialState = {
        status: STATES.IN_PROGRESS,
        checklistProgress: 10,
        totalChecklistItems: 10,
        hasRequiredComment: true,
        greenStatusValidated: true
      };

      render(
        <GranskadStateProvider initialState={initialState}>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      expect(completeButton).toBeEnabled();

      await user.click(completeButton);

      // Should show confirmation dialog
      const confirmDialog = await screen.findByRole('dialog', { name: /bekräfta granskning/i });
      expect(confirmDialog).toBeInTheDocument();

      const confirmButton = within(confirmDialog).getByRole('button', { name: /bekräfta/i });
      await user.click(confirmButton);

      await waitFor(() => {
        const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
        expect(statusBadge).toHaveTextContent(STATES.FULLY_REVIEWED);
        expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
      });
    });

    test('should record transition metadata', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadStateProvider>
          <GranskadWorkflow 
            monthId="2024-01" 
            supplierId="supplier-123"
            userId="user-456"
          />
        </GranskadStateProvider>
      );

      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      
      const transitionTime = new Date();
      await user.click(startButton);

      await waitFor(() => {
        expect(archonMock.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-456',
            timestamp: expect.any(String),
            metadata: expect.objectContaining({
              transitionDuration: expect.any(Number),
              clientInfo: expect.objectContaining({
                userAgent: expect.any(String),
                timezone: expect.any(String)
              })
            })
          })
        );
      });

      // Verify timestamp is recent
      const auditCall = archonMock.createAuditLog.mock.calls[0][0];
      const auditTimestamp = new Date(auditCall.timestamp);
      expect(auditTimestamp.getTime()).toBeCloseTo(transitionTime.getTime(), -2); // Within 100ms
    });
  });

  describe('Invalid State Transitions', () => {
    test('should prevent direct transition from UNREVIEWED to FULLY_REVIEWED', async () => {
      const user = userEvent.setup();
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      // Try to force invalid transition
      const { result } = renderHook(() => useGranskadState());
      
      act(() => {
        expect(() => {
          result.current.transitionTo(STATES.FULLY_REVIEWED);
        }).toThrow('Ogiltig statusövergång: Ogranskad → Helt granskad');
      });

      // Status should remain unchanged
      const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
      expect(statusBadge).toHaveTextContent(STATES.UNREVIEWED);
      
      // Should log security event
      expect(archonMock.createSecurityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INVALID_STATE_TRANSITION_ATTEMPT',
          severity: 'warning'
        })
      );
      
      consoleError.mockRestore();
    });

    test('should prevent transition from terminal state (FULLY_REVIEWED)', async () => {
      const initialState = {
        status: STATES.FULLY_REVIEWED,
        completedAt: '2024-01-15T15:00:00Z'
      };

      render(
        <GranskadStateProvider initialState={initialState}>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      // Should not show any transition buttons
      const startButton = screen.queryByRole('button', { name: /börja granskning/i });
      const completeButton = screen.queryByRole('button', { name: /markera som granskad/i });
      
      expect(startButton).not.toBeInTheDocument();
      expect(completeButton).not.toBeInTheDocument();

      // Should show locked indicator
      const lockedBadge = screen.getByRole('img', { name: /låst status/i });
      expect(lockedBadge).toBeInTheDocument();
    });

    test('should validate state transition prerequisites', async () => {
      const user = userEvent.setup();
      
      const initialState = {
        status: STATES.IN_PROGRESS,
        checklistProgress: 5, // Incomplete checklist
        totalChecklistItems: 10,
        hasRequiredComment: false, // No comment
        greenStatusValidated: false // Not green status
      };

      render(
        <GranskadStateProvider initialState={initialState}>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      expect(completeButton).toBeDisabled();

      // Hover for tooltip
      await user.hover(completeButton);
      
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent(/Följande krav måste uppfyllas:/i);
      expect(tooltip).toHaveTextContent(/✗ Alla checklistpunkter måste vara klara/i);
      expect(tooltip).toHaveTextContent(/✗ En kommentar krävs/i);
      expect(tooltip).toHaveTextContent(/✗ Månaden måste ha grön status/i);
    });
  });

  describe('State Persistence', () => {
    test('should persist state changes to localStorage', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      await user.click(startButton);

      await waitFor(() => {
        const persistedState = localStorage.getItem('granskad-state-2024-01-supplier-123');
        expect(persistedState).toBeTruthy();
        
        const parsed = JSON.parse(persistedState!);
        expect(parsed).toMatchObject({
          status: STATES.IN_PROGRESS,
          monthId: '2024-01',
          supplierId: 'supplier-123',
          startedAt: expect.any(String)
        });
      });
    });

    test('should sync state across browser tabs', async () => {
      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      // Simulate storage event from another tab
      const newState = {
        status: STATES.IN_PROGRESS,
        monthId: '2024-01',
        supplierId: 'supplier-123',
        startedAt: new Date().toISOString()
      };

      act(() => {
        localStorage.setItem('granskad-state-2024-01-supplier-123', JSON.stringify(newState));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'granskad-state-2024-01-supplier-123',
          newValue: JSON.stringify(newState),
          oldValue: null
        }));
      });

      await waitFor(() => {
        const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
        expect(statusBadge).toHaveTextContent(STATES.IN_PROGRESS);
      });

      // Should show notification about external update
      const notification = screen.getByRole('alert');
      expect(notification).toHaveTextContent(/Status uppdaterad från annan flik/i);
    });

    test('should handle persistence failures gracefully', async () => {
      const user = userEvent.setup();
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      await user.click(startButton);

      // State should still transition
      await waitFor(() => {
        const statusBadge = screen.getByRole('status', { name: /granskningsstatus/i });
        expect(statusBadge).toHaveTextContent(STATES.IN_PROGRESS);
      });

      // Should show warning about persistence failure
      const warning = screen.getByRole('alert');
      expect(warning).toHaveTextContent(/Kunde inte spara status lokalt/i);

      localStorage.setItem = originalSetItem;
      consoleError.mockRestore();
    });

    test('should create backup in sessionStorage if localStorage fails', async () => {
      const user = userEvent.setup();
      
      // Mock localStorage to be full
      Object.defineProperty(localStorage, 'setItem', {
        writable: true,
        value: jest.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError');
        })
      });

      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      await user.click(startButton);

      await waitFor(() => {
        const sessionBackup = sessionStorage.getItem('granskad-state-backup-2024-01-supplier-123');
        expect(sessionBackup).toBeTruthy();
        
        const parsed = JSON.parse(sessionBackup!);
        expect(parsed.status).toBe(STATES.IN_PROGRESS);
      });
    });
  });

  describe('State History', () => {
    test('should maintain transition history', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadStateProvider>
          <GranskadWorkflow monthId="2024-01" supplierId="supplier-123" />
        </GranskadStateProvider>
      );

      // First transition
      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      await user.click(startButton);

      // Open history panel
      const historyButton = screen.getByRole('button', { name: /visa historik/i });
      await user.click(historyButton);

      const historyPanel = screen.getByRole('complementary', { name: /granskningshistorik/i });
      const historyItems = within(historyPanel).getAllByRole('listitem');
      
      expect(historyItems).toHaveLength(2); // Initial + transition
      expect(historyItems[0]).toHaveTextContent(/Status skapad: Ogranskad/i);
      expect(historyItems[1]).toHaveTextContent(/Övergång: Ogranskad → Pågående granskning/i);
    });

    test('should include user and timestamp in history', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadStateProvider>
          <GranskadWorkflow 
            monthId="2024-01" 
            supplierId="supplier-123"
            userId="user-456"
            userName="Anna Andersson"
          />
        </GranskadStateProvider>
      );

      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      await user.click(startButton);

      const historyButton = screen.getByRole('button', { name: /visa historik/i });
      await user.click(historyButton);

      const historyPanel = screen.getByRole('complementary', { name: /granskningshistorik/i });
      const lastEntry = within(historyPanel).getAllByRole('listitem')[1];
      
      expect(lastEntry).toHaveTextContent(/Anna Andersson/i);
      expect(lastEntry).toHaveTextContent(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/); // Swedish datetime format
    });
  });
});