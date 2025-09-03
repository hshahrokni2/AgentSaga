/**
 * @fileoverview Test suite for Granskad Snapshot, Audit Trail, and Completion
 * Tests snapshot confirmation, audit logging, green status validation, and workflow management
 * 
 * CRITICAL: These tests MUST fail initially per TDD RED phase
 */

import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';

// Component imports - These don't exist yet (RED phase)
import { GranskadWorkflow } from '@/components/granskad/GranskadWorkflow';
import { SnapshotDialog } from '@/components/granskad/SnapshotDialog';
import { AuditTrail } from '@/components/granskad/AuditTrail';
import { GreenStatusValidator } from '@/components/granskad/GreenStatusValidator';
import { WorkflowManager } from '@/components/granskad/WorkflowManager';
import { GranskadSnapshot, AuditEntry, ClearanceStatus } from '@/types/granskad';
import { mockArchonAPI } from '@/test-utils/archon-mocks';

describe('GranskadWorkflow - Snapshot Confirmation', () => {
  let archonMock: ReturnType<typeof mockArchonAPI>;

  beforeEach(() => {
    archonMock = mockArchonAPI();
    localStorage.clear();
  });

  describe('Snapshot Dialog', () => {
    test('should show snapshot dialog before final completion', async () => {
      const user = userEvent.setup();
      
      const initialState = {
        status: 'Pågående granskning',
        checklistComplete: true,
        hasComment: true,
        greenStatus: true
      };

      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          initialState={initialState}
        />
      );

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      await user.click(completeButton);

      // Snapshot dialog should appear
      const dialog = await screen.findByRole('dialog', { name: /bekräfta granskning/i });
      expect(dialog).toBeInTheDocument();

      // Dialog content
      expect(within(dialog).getByText(/skapa permanent ögonblicksbild/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/kan inte ångras/i)).toBeInTheDocument();
      
      // Warning icon
      const warningIcon = within(dialog).getByRole('img', { name: /varning/i });
      expect(warningIcon).toBeInTheDocument();
      expect(warningIcon).toHaveClass('text-amber-500');
    });

    test('should display snapshot preview with all data', async () => {
      const user = userEvent.setup();
      
      const mockData = {
        monthId: '2024-01',
        supplierId: 'supplier-123',
        checklistItems: [
          { id: 'item-1', label: 'Test 1', completed: true },
          { id: 'item-2', label: 'Test 2', completed: true }
        ],
        findings: [
          { id: 'finding-1', title: 'Anomali detekterad', severity: 'medium' }
        ],
        insights: [
          { id: 'insight-1', description: 'Trend identifierad', confidence: 0.85 }
        ],
        comment: 'Granskning genomförd utan anmärkningar'
      };

      render(
        <SnapshotDialog 
          isOpen={true}
          data={mockData}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Snapshot sections
      const checklistSection = screen.getByRole('region', { name: /checklista-status/i });
      expect(within(checklistSection).getByText(/2 av 2 punkter klara/i)).toBeInTheDocument();

      const findingsSection = screen.getByRole('region', { name: /granskade fynd/i });
      expect(within(findingsSection).getByText(/anomali detekterad/i)).toBeInTheDocument();

      const insightsSection = screen.getByRole('region', { name: /ai-insikter/i });
      expect(within(insightsSection).getByText(/trend identifierad/i)).toBeInTheDocument();

      const commentSection = screen.getByRole('region', { name: /granskningskommentar/i });
      expect(within(commentSection).getByText(/granskning genomförd/i)).toBeInTheDocument();

      // Metadata
      const metadata = screen.getByRole('region', { name: /metadata/i });
      expect(within(metadata).getByText(/2024-01/i)).toBeInTheDocument();
      expect(within(metadata).getByText(/supplier-123/i)).toBeInTheDocument();
    });

    test('should create immutable snapshot on confirmation', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();
      
      render(
        <SnapshotDialog 
          isOpen={true}
          data={{ monthId: '2024-01', supplierId: 'supplier-123' }}
          onConfirm={onConfirm}
          onCancel={jest.fn()}
        />
      );

      // Confirm button should require explicit confirmation
      const confirmButton = screen.getByRole('button', { name: /bekräfta och slutför/i });
      expect(confirmButton).toBeDisabled();

      // Check confirmation checkbox
      const confirmCheckbox = screen.getByRole('checkbox', { 
        name: /jag förstår att detta inte kan ångras/i 
      });
      await user.click(confirmCheckbox);

      expect(confirmButton).toBeEnabled();
      await user.click(confirmButton);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(String),
            timestamp: expect.any(String),
            hash: expect.any(String), // SHA-256 hash for immutability
            version: expect.any(Number),
            data: expect.any(Object)
          })
        );
      });
    });

    test('should calculate and display snapshot hash', () => {
      const mockData = {
        monthId: '2024-01',
        supplierId: 'supplier-123',
        checklistComplete: true
      };

      render(
        <SnapshotDialog 
          isOpen={true}
          data={mockData}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Hash should be displayed
      const hashElement = screen.getByRole('textbox', { name: /sha-256 hash/i });
      expect(hashElement).toBeInTheDocument();
      expect(hashElement).toHaveValue(expect.stringMatching(/^[a-f0-9]{64}$/i));
      expect(hashElement).toHaveAttribute('readonly');

      // Copy hash button
      const copyButton = screen.getByRole('button', { name: /kopiera hash/i });
      expect(copyButton).toBeInTheDocument();
    });

    test('should allow snapshot download before confirmation', async () => {
      const user = userEvent.setup();
      
      const mockData = {
        monthId: '2024-01',
        supplierId: 'supplier-123',
        timestamp: new Date().toISOString()
      };

      render(
        <SnapshotDialog 
          isOpen={true}
          data={mockData}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const downloadButton = screen.getByRole('button', { name: /ladda ner ögonblicksbild/i });
      
      // Mock download
      const createObjectURL = jest.fn();
      const revokeObjectURL = jest.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      await user.click(downloadButton);

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      
      // Check file format
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe('application/json');
    });
  });

  describe('Green Status Prerequisite', () => {
    test('should block workflow if clearance is not green', () => {
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          clearanceStatus="yellow"
        />
      );

      // Should show warning banner
      const warningBanner = screen.getByRole('alert');
      expect(warningBanner).toHaveTextContent(/månaden måste ha grön status/i);
      expect(warningBanner).toHaveClass('bg-amber-50', 'border-amber-200');

      // Complete button should be disabled
      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      expect(completeButton).toBeDisabled();
    });

    test('should validate green status in real-time', async () => {
      const { rerender } = render(
        <GreenStatusValidator 
          monthId="2024-01"
          supplierId="supplier-123"
          clearanceStatus="yellow"
        />
      );

      const statusIndicator = screen.getByRole('status', { name: /clearance-status/i });
      expect(statusIndicator).toHaveTextContent(/gul status/i);
      expect(statusIndicator).toHaveClass('text-amber-600');

      // Simulate status change
      rerender(
        <GreenStatusValidator 
          monthId="2024-01"
          supplierId="supplier-123"
          clearanceStatus="green"
        />
      );

      expect(statusIndicator).toHaveTextContent(/grön status/i);
      expect(statusIndicator).toHaveClass('text-green-600');
      
      // Success message
      const successMessage = screen.getByRole('status', { name: /status godkänd/i });
      expect(successMessage).toBeInTheDocument();
    });

    test('should show clearance details and requirements', async () => {
      const user = userEvent.setup();
      
      render(
        <GreenStatusValidator 
          monthId="2024-01"
          supplierId="supplier-123"
          clearanceStatus="red"
          clearanceDetails={{
            missingData: ['Leverantör A', 'Leverantör B'],
            anomalies: 3,
            unresolvedFindings: 2
          }}
        />
      );

      const detailsButton = screen.getByRole('button', { name: /visa detaljer/i });
      await user.click(detailsButton);

      const detailsPanel = screen.getByRole('complementary', { name: /clearance-detaljer/i });
      
      expect(within(detailsPanel).getByText(/saknade data:/i)).toBeInTheDocument();
      expect(within(detailsPanel).getByText(/leverantör a/i)).toBeInTheDocument();
      expect(within(detailsPanel).getByText(/3 anomalier/i)).toBeInTheDocument();
      expect(within(detailsPanel).getByText(/2 olösta fynd/i)).toBeInTheDocument();
    });

    test('should allow admin override for non-green status', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          clearanceStatus="yellow"
          userRole="admin"
        />
      );

      const overrideButton = screen.getByRole('button', { name: /åsidosätt statuskrav/i });
      expect(overrideButton).toBeInTheDocument();

      await user.click(overrideButton);

      // Override dialog
      const dialog = screen.getByRole('dialog', { name: /åsidosätt clearance-krav/i });
      
      // Must provide reason
      const reasonInput = within(dialog).getByRole('textbox', { name: /orsak/i });
      await user.type(reasonInput, 'Manuell granskning bekräftar att data är korrekt');

      const confirmButton = within(dialog).getByRole('button', { name: /bekräfta åsidosättning/i });
      await user.click(confirmButton);

      // Should create audit entry for override
      await waitFor(() => {
        expect(archonMock.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CLEARANCE_OVERRIDE',
            reason: 'Manuell granskning bekräftar att data är korrekt',
            originalStatus: 'yellow',
            userId: expect.any(String)
          })
        );
      });
    });
  });

  describe('Audit Trail', () => {
    test('should log all state transitions with metadata', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          userId="user-123"
          userName="Anna Andersson"
        />
      );

      const startButton = screen.getByRole('button', { name: /börja granskning/i });
      await user.click(startButton);

      expect(archonMock.createAuditLog).toHaveBeenCalledWith({
        id: expect.any(String),
        timestamp: expect.any(String),
        action: 'STATE_TRANSITION',
        userId: 'user-123',
        userName: 'Anna Andersson',
        details: {
          from: 'Ogranskad',
          to: 'Pågående granskning',
          monthId: '2024-01',
          supplierId: 'supplier-123'
        },
        metadata: expect.objectContaining({
          ip: expect.any(String),
          userAgent: expect.any(String),
          sessionId: expect.any(String)
        })
      });
    });

    test('should display audit trail in chronological order', () => {
      const auditEntries: AuditEntry[] = [
        {
          id: '1',
          timestamp: '2024-01-15T10:00:00Z',
          action: 'WORKFLOW_STARTED',
          userId: 'user-123',
          userName: 'Anna'
        },
        {
          id: '2',
          timestamp: '2024-01-15T10:30:00Z',
          action: 'CHECKLIST_COMPLETED',
          userId: 'user-123',
          userName: 'Anna'
        },
        {
          id: '3',
          timestamp: '2024-01-15T11:00:00Z',
          action: 'COMMENT_ADDED',
          userId: 'user-456',
          userName: 'Bengt'
        },
        {
          id: '4',
          timestamp: '2024-01-15T11:30:00Z',
          action: 'WORKFLOW_COMPLETED',
          userId: 'user-123',
          userName: 'Anna'
        }
      ];

      render(
        <AuditTrail 
          entries={auditEntries}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const entries = screen.getAllByRole('listitem');
      expect(entries).toHaveLength(4);

      // Check chronological order
      expect(entries[0]).toHaveTextContent(/10:00.*workflow started/i);
      expect(entries[1]).toHaveTextContent(/10:30.*checklist completed/i);
      expect(entries[2]).toHaveTextContent(/11:00.*comment added/i);
      expect(entries[3]).toHaveTextContent(/11:30.*workflow completed/i);
    });

    test('should ensure audit trail immutability', () => {
      const auditEntries = [
        {
          id: 'audit-1',
          timestamp: '2024-01-15T10:00:00Z',
          action: 'STATE_TRANSITION',
          hash: 'abc123def456',
          signature: 'signed-data'
        }
      ];

      render(
        <AuditTrail 
          entries={auditEntries}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const entry = screen.getByRole('listitem');
      
      // Immutability indicators
      expect(entry).toHaveAttribute('data-immutable', 'true');
      
      const hashElement = within(entry).getByText(/abc123def456/i);
      expect(hashElement).toBeInTheDocument();
      
      const verifiedBadge = within(entry).getByRole('img', { name: /verifierad/i });
      expect(verifiedBadge).toBeInTheDocument();
    });

    test('should export audit trail in multiple formats', async () => {
      const user = userEvent.setup();
      
      const auditEntries = [
        {
          id: '1',
          timestamp: '2024-01-15T10:00:00Z',
          action: 'WORKFLOW_STARTED',
          userId: 'user-123'
        }
      ];

      render(
        <AuditTrail 
          entries={auditEntries}
          monthId="2024-01"
          supplierId="supplier-123"
          allowExport={true}
        />
      );

      const exportButton = screen.getByRole('button', { name: /exportera/i });
      await user.click(exportButton);

      const exportMenu = screen.getByRole('menu');
      
      // Export options
      expect(within(exportMenu).getByRole('menuitem', { name: /json/i })).toBeInTheDocument();
      expect(within(exportMenu).getByRole('menuitem', { name: /csv/i })).toBeInTheDocument();
      expect(within(exportMenu).getByRole('menuitem', { name: /pdf/i })).toBeInTheDocument();
    });

    test('should validate audit trail integrity on load', () => {
      const corruptedEntry = {
        id: 'audit-1',
        timestamp: '2024-01-15T10:00:00Z',
        action: 'STATE_TRANSITION',
        hash: 'invalid-hash',
        expectedHash: 'abc123def456'
      };

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      render(
        <AuditTrail 
          entries={[corruptedEntry]}
          monthId="2024-01"
          supplierId="supplier-123"
          validateIntegrity={true}
        />
      );

      // Should show integrity warning
      const warning = screen.getByRole('alert');
      expect(warning).toHaveTextContent(/integritetskontroll misslyckades/i);
      expect(warning).toHaveClass('text-red-600');

      consoleError.mockRestore();
    });
  });

  describe('Workflow Management', () => {
    test('should save workflow progress automatically', async () => {
      const user = userEvent.setup();
      
      render(
        <WorkflowManager 
          monthId="2024-01"
          supplierId="supplier-123"
          autoSave={true}
          autoSaveInterval={5000}
        />
      );

      // Make some changes
      const checkbox = screen.getByRole('checkbox', { name: /första punkten/i });
      await user.click(checkbox);

      // Wait for autosave
      await waitFor(() => {
        const saved = localStorage.getItem('workflow-2024-01-supplier-123');
        expect(saved).toBeTruthy();
        
        const parsed = JSON.parse(saved!);
        expect(parsed.lastSaved).toBeTruthy();
        expect(parsed.progress).toMatchObject({
          checklistItems: expect.any(Array),
          status: expect.any(String)
        });
      }, { timeout: 6000 });

      // Should show save indicator
      const saveIndicator = screen.getByRole('status', { name: /sparad/i });
      expect(saveIndicator).toBeInTheDocument();
    });

    test('should handle workflow interruption and resumption', async () => {
      // Simulate interrupted workflow
      const interruptedState = {
        status: 'Pågående granskning',
        startedAt: '2024-01-15T10:00:00Z',
        checklistProgress: 5,
        totalChecklistItems: 10,
        lastActivity: '2024-01-15T11:00:00Z'
      };

      localStorage.setItem('workflow-2024-01-supplier-123', JSON.stringify(interruptedState));

      render(
        <WorkflowManager 
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      // Should show resumption dialog
      const resumeDialog = screen.getByRole('dialog', { name: /återuppta granskning/i });
      expect(resumeDialog).toBeInTheDocument();
      
      expect(within(resumeDialog).getByText(/påbörjad: 15 januari 10:00/i)).toBeInTheDocument();
      expect(within(resumeDialog).getByText(/5 av 10 punkter klara/i)).toBeInTheDocument();

      const resumeButton = within(resumeDialog).getByRole('button', { name: /återuppta/i });
      const startOverButton = within(resumeDialog).getByRole('button', { name: /börja om/i });
      
      expect(resumeButton).toBeInTheDocument();
      expect(startOverButton).toBeInTheDocument();
    });

    test('should handle concurrent access prevention', () => {
      // Simulate another user has lock
      const lockInfo = {
        userId: 'user-456',
        userName: 'Bengt Bengtsson',
        lockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

      sessionStorage.setItem('workflow-lock-2024-01-supplier-123', JSON.stringify(lockInfo));

      render(
        <WorkflowManager 
          monthId="2024-01"
          supplierId="supplier-123"
          userId="user-123"
        />
      );

      // Should show lock warning
      const lockWarning = screen.getByRole('alert');
      expect(lockWarning).toHaveTextContent(/bengt bengtsson granskar just nu/i);
      expect(lockWarning).toHaveClass('bg-amber-50');

      // Should show read-only mode
      const readOnlyBadge = screen.getByText(/skrivskyddat läge/i);
      expect(readOnlyBadge).toBeInTheDocument();

      // All interactive elements should be disabled
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    test('should send completion notifications', async () => {
      const user = userEvent.setup();
      const notificationHandler = jest.fn();
      
      render(
        <WorkflowManager 
          monthId="2024-01"
          supplierId="supplier-123"
          onComplete={notificationHandler}
          notifyUsers={['user-456', 'user-789']}
        />
      );

      // Complete workflow
      const completeButton = screen.getByRole('button', { name: /slutför granskning/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(notificationHandler).toHaveBeenCalledWith({
          type: 'WORKFLOW_COMPLETED',
          monthId: '2024-01',
          supplierId: 'supplier-123',
          completedBy: expect.any(String),
          completedAt: expect.any(String),
          recipients: ['user-456', 'user-789']
        });
      });

      // Should show success message
      const successMessage = screen.getByRole('status');
      expect(successMessage).toHaveTextContent(/granskning slutförd och meddelanden skickade/i);
    });

    test('should handle session timeout gracefully', async () => {
      jest.useFakeTimers();
      
      render(
        <WorkflowManager 
          monthId="2024-01"
          supplierId="supplier-123"
          sessionTimeout={30 * 60 * 1000} // 30 minutes
        />
      );

      // Fast forward to near timeout
      act(() => {
        jest.advanceTimersByTime(28 * 60 * 1000); // 28 minutes
      });

      // Should show warning
      const timeoutWarning = await screen.findByRole('alert');
      expect(timeoutWarning).toHaveTextContent(/session går ut om 2 minuter/i);

      // Fast forward to timeout
      act(() => {
        jest.advanceTimersByTime(3 * 60 * 1000); // 3 more minutes
      });

      // Should show timeout message
      const timeoutMessage = screen.getByRole('alert');
      expect(timeoutMessage).toHaveTextContent(/session har gått ut/i);

      // Should have saved progress
      const saved = localStorage.getItem('workflow-2024-01-supplier-123');
      expect(saved).toBeTruthy();

      jest.useRealTimers();
    });

    test('should validate Swedish compliance requirements', () => {
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          complianceMode="swedish"
        />
      );

      // Should enforce Swedish-specific requirements
      const complianceIndicator = screen.getByRole('region', { name: /svensk regelefterlevnad/i });
      expect(complianceIndicator).toBeInTheDocument();

      // Check for required Swedish fields
      const requiredFields = [
        'Organisationsnummer',
        'Miljötillstånd',
        'Avfallskoder',
        'Transportdokumentation'
      ];

      requiredFields.forEach(field => {
        expect(screen.getByText(new RegExp(field, 'i'))).toBeInTheDocument();
      });

      // Date should be in Swedish format
      const dateElement = screen.getByText(/\d{4}-\d{2}-\d{2}/);
      expect(dateElement).toBeInTheDocument();
    });
  });

  describe('Performance & Optimization', () => {
    test('should lazy load audit trail entries', async () => {
      const manyEntries = Array.from({ length: 1000 }, (_, i) => ({
        id: `audit-${i}`,
        timestamp: new Date(2024, 0, 15, 10, i).toISOString(),
        action: 'TEST_ACTION',
        userId: 'user-123'
      }));

      render(
        <AuditTrail 
          entries={manyEntries}
          monthId="2024-01"
          supplierId="supplier-123"
          lazyLoad={true}
          pageSize={20}
        />
      );

      // Should only render first page
      const visibleEntries = screen.getAllByRole('listitem');
      expect(visibleEntries).toHaveLength(20);

      // Should show load more button
      const loadMoreButton = screen.getByRole('button', { name: /ladda fler/i });
      expect(loadMoreButton).toBeInTheDocument();
    });

    test('should debounce autosave operations', async () => {
      const user = userEvent.setup();
      const saveSpy = jest.fn();
      
      render(
        <WorkflowManager 
          monthId="2024-01"
          supplierId="supplier-123"
          onAutoSave={saveSpy}
          autoSaveDebounce={1000}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Rapid changes
      for (let i = 0; i < 5; i++) {
        await user.click(checkboxes[i]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should not have saved yet
      expect(saveSpy).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });
    });
  });
});