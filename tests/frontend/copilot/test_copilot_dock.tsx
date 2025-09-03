/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Non-existent imports - will fail
import { CopilotDock } from '@/components/copilot/CopilotDock';
import { CopilotProvider } from '@/providers/copilot-provider';
import { mockArchonAPI } from '../granskad/__mocks__/archon-mocks';
import type { 
  CopilotMessage, 
  ToolCall, 
  Proposal, 
  ConversationContext 
} from '@/components/copilot/types';

expect.extend(toHaveNoViolations);

describe('CopilotDock - Core Interface', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  describe('Dock Positioning and Visibility', () => {
    test('renders as right-side sheet dock with proper glassmorphism styling', () => {
      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const dock = screen.getByRole('dialog', { name: /ai copilot/i });
      expect(dock).toBeInTheDocument();
      expect(dock).toHaveClass('glass-morphism');
      expect(dock).toHaveStyle({
        position: 'fixed',
        right: '0',
        height: '100vh'
      });
    });

    test('animates slide-in from right when opening', async () => {
      const { rerender } = render(
        <CopilotProvider>
          <CopilotDock isOpen={false} onClose={jest.fn()} />
        </CopilotProvider>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const dock = await screen.findByRole('dialog');
      expect(dock).toHaveClass('animate-slide-in-right');
    });

    test('handles keyboard shortcut (Cmd/Ctrl + K) to toggle', async () => {
      const onToggle = jest.fn();
      render(
        <CopilotProvider>
          <CopilotDock isOpen={false} onClose={onToggle} />
        </CopilotProvider>
      );

      // Simulate Cmd+K on Mac
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(onToggle).toHaveBeenCalled();

      // Simulate Ctrl+K on Windows/Linux
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
      expect(onToggle).toHaveBeenCalledTimes(2);
    });
  });

  describe('Chat Interface Functionality', () => {
    test('displays message input with Swedish/English placeholder based on locale', () => {
      const { rerender } = render(
        <CopilotProvider locale="sv">
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      let input = screen.getByPlaceholderText(/ställ en fråga eller be om hjälp/i);
      expect(input).toBeInTheDocument();

      rerender(
        <CopilotProvider locale="en">
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      input = screen.getByPlaceholderText(/ask a question or request help/i);
      expect(input).toBeInTheDocument();
    });

    test('sends message when Enter is pressed', async () => {
      const onSendMessage = jest.fn();
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()} 
            onSendMessage={onSendMessage}
          />
        </CopilotProvider>
      );

      const input = screen.getByRole('textbox', { name: /message input/i });
      await user.type(input, 'Visa alla försenade fakturor');
      await user.keyboard('{Enter}');

      expect(onSendMessage).toHaveBeenCalledWith({
        content: 'Visa alla försenade fakturor',
        role: 'user',
        timestamp: expect.any(String)
      });
      expect(input).toHaveValue('');
    });

    test('supports multi-line input with Shift+Enter', async () => {
      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const input = screen.getByRole('textbox', { name: /message input/i });
      await user.type(input, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(input, 'Line 2');

      expect(input).toHaveValue('Line 1\nLine 2');
    });

    test('displays conversation history with proper message styling', () => {
      const messages: CopilotMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Analysera månadens avvikelser',
          timestamp: '2024-01-15T10:00:00Z'
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Jag har identifierat 3 avvikelser...',
          timestamp: '2024-01-15T10:00:15Z',
          toolCalls: []
        }
      ];

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()} 
            messages={messages}
          />
        </CopilotProvider>
      );

      const userMessage = screen.getByText('Analysera månadens avvikelser');
      expect(userMessage.closest('[role="article"]')).toHaveClass('message-user');

      const assistantMessage = screen.getByText(/jag har identifierat 3 avvikelser/i);
      expect(assistantMessage.closest('[role="article"]')).toHaveClass('message-assistant');
    });

    test('auto-scrolls to bottom when new message arrives', async () => {
      const { rerender } = render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[]} />
        </CopilotProvider>
      );

      const scrollContainer = screen.getByRole('log', { name: /conversation history/i });
      const scrollSpy = jest.spyOn(scrollContainer, 'scrollTo');

      const newMessage: CopilotMessage = {
        id: 'msg-new',
        role: 'assistant',
        content: 'New response',
        timestamp: new Date().toISOString()
      };

      rerender(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[newMessage]} />
        </CopilotProvider>
      );

      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalledWith({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      });
    });
  });

  describe('Tool Call Visualization', () => {
    test('displays tool calls with expandable details', async () => {
      const messageWithTools: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Analyzing data...',
        timestamp: new Date().toISOString(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'archon:perform_rag_query',
            arguments: { query: 'invoice anomalies', match_count: 5 },
            result: { success: true, results: [] }
          }
        ]
      };

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()} 
            messages={[messageWithTools]}
          />
        </CopilotProvider>
      );

      const toolCall = screen.getByRole('button', { name: /archon:perform_rag_query/i });
      expect(toolCall).toBeInTheDocument();
      expect(toolCall).toHaveAttribute('aria-expanded', 'false');

      await user.click(toolCall);
      expect(toolCall).toHaveAttribute('aria-expanded', 'true');

      const toolDetails = screen.getByRole('region', { name: /tool call details/i });
      expect(toolDetails).toBeInTheDocument();
      expect(within(toolDetails).getByText(/query.*invoice anomalies/i)).toBeInTheDocument();
    });

    test('shows tool call status indicators (pending/success/error)', () => {
      const messages: CopilotMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Processing...',
          timestamp: new Date().toISOString(),
          toolCalls: [
            { id: 't1', name: 'tool1', status: 'pending' },
            { id: 't2', name: 'tool2', status: 'success', result: {} },
            { id: 't3', name: 'tool3', status: 'error', error: 'Failed' }
          ]
        }
      ];

      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={messages} />
        </CopilotProvider>
      );

      const pendingTool = screen.getByRole('button', { name: /tool1/i });
      expect(pendingTool).toHaveClass('tool-pending');
      expect(within(pendingTool).getByRole('progressbar')).toBeInTheDocument();

      const successTool = screen.getByRole('button', { name: /tool2/i });
      expect(successTool).toHaveClass('tool-success');
      expect(within(successTool).getByTestId('check-icon')).toBeInTheDocument();

      const errorTool = screen.getByRole('button', { name: /tool3/i });
      expect(errorTool).toHaveClass('tool-error');
      expect(within(errorTool).getByTestId('alert-icon')).toBeInTheDocument();
    });

    test('formats JSON tool results with syntax highlighting', async () => {
      const messageWithResult: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Found results',
        timestamp: new Date().toISOString(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'search',
            result: {
              count: 3,
              items: ['item1', 'item2', 'item3'],
              metadata: { source: 'database' }
            }
          }
        ]
      };

      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[messageWithResult]} />
        </CopilotProvider>
      );

      const toolCall = screen.getByRole('button', { name: /search/i });
      await user.click(toolCall);

      const codeBlock = screen.getByRole('code');
      expect(codeBlock).toHaveClass('language-json');
      expect(codeBlock).toHaveAttribute('data-highlighted', 'true');
    });
  });

  describe('INS/SCN ID Citation System', () => {
    test('automatically detects and links INS/SCN IDs in messages', () => {
      const message: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Found issues in INS-2024-01-001 and scenario SCN-2024-01-042',
        timestamp: new Date().toISOString()
      };

      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[message]} />
        </CopilotProvider>
      );

      const insLink = screen.getByRole('link', { name: /INS-2024-01-001/i });
      expect(insLink).toHaveAttribute('href', '/insights/INS-2024-01-001');
      expect(insLink).toHaveClass('citation-link');

      const scnLink = screen.getByRole('link', { name: /SCN-2024-01-042/i });
      expect(scnLink).toHaveAttribute('href', '/scenarios/SCN-2024-01-042');
    });

    test('shows citation preview on hover', async () => {
      const message: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Review INS-2024-01-001',
        timestamp: new Date().toISOString(),
        citations: [
          {
            id: 'INS-2024-01-001',
            type: 'insight',
            title: 'Försenad betalning - Leverantör A',
            confidence: 0.95,
            severity: 'high'
          }
        ]
      };

      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[message]} />
        </CopilotProvider>
      );

      const link = screen.getByRole('link', { name: /INS-2024-01-001/i });
      await user.hover(link);

      const preview = await screen.findByRole('tooltip', { name: /citation preview/i });
      expect(preview).toBeInTheDocument();
      expect(within(preview).getByText('Försenad betalning - Leverantör A')).toBeInTheDocument();
      expect(within(preview).getByText('95%')).toBeInTheDocument();
    });

    test('groups multiple citations at message footer', () => {
      const message: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Analysis complete',
        timestamp: new Date().toISOString(),
        citations: [
          { id: 'INS-2024-01-001', type: 'insight' },
          { id: 'INS-2024-01-002', type: 'insight' },
          { id: 'SCN-2024-01-010', type: 'scenario' }
        ]
      };

      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[message]} />
        </CopilotProvider>
      );

      const citationsSection = screen.getByRole('region', { name: /citations/i });
      expect(citationsSection).toBeInTheDocument();
      
      const citationBadges = within(citationsSection).getAllByRole('link');
      expect(citationBadges).toHaveLength(3);
      expect(citationBadges[0]).toHaveTextContent('INS-2024-01-001');
      expect(citationBadges[2]).toHaveTextContent('SCN-2024-01-010');
    });
  });

  describe('Proposal Confirmation Workflow', () => {
    test('displays proposal card with accept/reject actions', async () => {
      const proposal: Proposal = {
        id: 'prop-1',
        type: 'data_modification',
        description: 'Update invoice status to "paid"',
        affectedEntities: ['INV-2024-001'],
        changes: [
          { field: 'status', from: 'pending', to: 'paid' }
        ],
        requiresConfirmation: true
      };

      const message: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'I can update this invoice for you',
        timestamp: new Date().toISOString(),
        proposal
      };

      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[message]} />
        </CopilotProvider>
      );

      const proposalCard = screen.getByRole('article', { name: /proposal/i });
      expect(proposalCard).toBeInTheDocument();
      expect(proposalCard).toHaveClass('proposal-card');

      expect(within(proposalCard).getByText(/update invoice status/i)).toBeInTheDocument();
      expect(within(proposalCard).getByText('INV-2024-001')).toBeInTheDocument();

      const acceptBtn = within(proposalCard).getByRole('button', { name: /accept|godkänn/i });
      const rejectBtn = within(proposalCard).getByRole('button', { name: /reject|avböj/i });
      
      expect(acceptBtn).toBeInTheDocument();
      expect(rejectBtn).toBeInTheDocument();
    });

    test('shows confirmation dialog before applying changes', async () => {
      const onConfirmProposal = jest.fn();
      const proposal: Proposal = {
        id: 'prop-1',
        type: 'bulk_update',
        description: 'Update 15 invoices',
        requiresConfirmation: true
      };

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            onConfirmProposal={onConfirmProposal}
            activeProposal={proposal}
          />
        </CopilotProvider>
      );

      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      await user.click(acceptBtn);

      const dialog = await screen.findByRole('dialog', { name: /confirm changes/i });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/are you sure you want to apply these changes/i)).toBeInTheDocument();

      const confirmBtn = within(dialog).getByRole('button', { name: /confirm/i });
      await user.click(confirmBtn);

      expect(onConfirmProposal).toHaveBeenCalledWith(proposal.id, true);
    });

    test('tracks proposal acceptance/rejection in audit log', async () => {
      const onAuditLog = jest.fn();
      const proposal: Proposal = {
        id: 'prop-1',
        type: 'deletion',
        description: 'Delete old records',
        requiresConfirmation: true
      };

      render(
        <CopilotProvider onAuditLog={onAuditLog}>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            activeProposal={proposal}
          />
        </CopilotProvider>
      );

      const rejectBtn = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectBtn);

      expect(onAuditLog).toHaveBeenCalledWith({
        action: 'proposal_rejected',
        proposalId: 'prop-1',
        timestamp: expect.any(String),
        userId: expect.any(String),
        reason: expect.any(String)
      });
    });
  });

  describe('Context Caching and Management', () => {
    test('maintains conversation context per month', () => {
      const context: ConversationContext = {
        month: '2024-01',
        supplierId: 'supplier-123',
        conversationId: 'conv-1',
        startedAt: '2024-01-15T10:00:00Z'
      };

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            context={context}
          />
        </CopilotProvider>
      );

      const contextBadge = screen.getByRole('status', { name: /context/i });
      expect(contextBadge).toHaveTextContent('January 2024');
      expect(contextBadge).toHaveTextContent('supplier-123');
    });

    test('shows context switch warning when changing months', async () => {
      const { rerender } = render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            context={{ month: '2024-01', supplierId: 'sup-1' }}
          />
        </CopilotProvider>
      );

      rerender(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            context={{ month: '2024-02', supplierId: 'sup-1' }}
          />
        </CopilotProvider>
      );

      const warning = await screen.findByRole('alert', { name: /context switch/i });
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveTextContent(/switching from january to february/i);
    });

    test('caches last 5 conversations with LRU eviction', async () => {
      const onLoadConversation = jest.fn();
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            onLoadConversation={onLoadConversation}
          />
        </CopilotProvider>
      );

      const historyBtn = screen.getByRole('button', { name: /conversation history/i });
      await user.click(historyBtn);

      const dropdown = await screen.findByRole('menu', { name: /recent conversations/i });
      const conversations = within(dropdown).getAllByRole('menuitem');
      
      expect(conversations).toHaveLength(5);
      expect(conversations[0]).toHaveTextContent(/most recent/i);
    });

    test('persists context to localStorage', () => {
      const context: ConversationContext = {
        month: '2024-01',
        supplierId: 'sup-123',
        conversationId: 'conv-1'
      };

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            context={context}
          />
        </CopilotProvider>
      );

      const stored = localStorage.getItem('copilot-context');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(expect.objectContaining({
        month: '2024-01',
        supplierId: 'sup-123'
      }));
    });
  });

  describe('Language Switching', () => {
    test('switches UI language between Swedish and English', async () => {
      const { rerender } = render(
        <CopilotProvider locale="sv">
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      expect(screen.getByRole('button', { name: /skicka/i })).toBeInTheDocument();
      expect(screen.getByText(/ai-assistent/i)).toBeInTheDocument();

      rerender(
        <CopilotProvider locale="en">
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
      expect(screen.getByText(/ai assistant/i)).toBeInTheDocument();
    });

    test('handles Swedish characters (åäö) in messages', async () => {
      render(
        <CopilotProvider locale="sv">
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Räkna försenade ärenden från Skåne');
      
      expect(input).toHaveValue('Räkna försenade ärenden från Skåne');
    });

    test('provides language toggle button in header', async () => {
      const onLocaleChange = jest.fn();
      render(
        <CopilotProvider locale="sv" onLocaleChange={onLocaleChange}>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const langToggle = screen.getByRole('button', { name: /language|språk/i });
      expect(langToggle).toHaveTextContent('SV');

      await user.click(langToggle);
      expect(onLocaleChange).toHaveBeenCalledWith('en');
    });
  });

  describe('Real-time Features', () => {
    test('shows typing indicator when assistant is processing', async () => {
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            isProcessing={true}
          />
        </CopilotProvider>
      );

      const indicator = screen.getByRole('status', { name: /typing/i });
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('typing-indicator');
      
      const dots = within(indicator).getAllByTestId('typing-dot');
      expect(dots).toHaveLength(3);
    });

    test('streams response content progressively', async () => {
      const { rerender } = render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[]} />
        </CopilotProvider>
      );

      // Start streaming
      const partialMessage: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Analyzing',
        isStreaming: true,
        timestamp: new Date().toISOString()
      };

      rerender(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[partialMessage]} />
        </CopilotProvider>
      );

      expect(screen.getByText('Analyzing')).toBeInTheDocument();
      expect(screen.getByTestId('cursor-blink')).toBeInTheDocument();

      // Update stream
      partialMessage.content = 'Analyzing your data...';
      rerender(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} messages={[partialMessage]} />
        </CopilotProvider>
      );

      expect(screen.getByText('Analyzing your data...')).toBeInTheDocument();
    });

    test('cancels ongoing stream when stop button is clicked', async () => {
      const onCancelStream = jest.fn();
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            onCancelStream={onCancelStream}
            isStreaming={true}
          />
        </CopilotProvider>
      );

      const stopBtn = screen.getByRole('button', { name: /stop|stoppa/i });
      expect(stopBtn).toBeInTheDocument();
      
      await user.click(stopBtn);
      expect(onCancelStream).toHaveBeenCalled();
    });
  });

  describe('Export Functionality', () => {
    test('exports conversation as markdown', async () => {
      const messages: CopilotMessage[] = [
        { id: '1', role: 'user', content: 'Question', timestamp: '2024-01-15T10:00:00Z' },
        { id: '2', role: 'assistant', content: 'Answer', timestamp: '2024-01-15T10:00:10Z' }
      ];

      const onExport = jest.fn();
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            messages={messages}
            onExport={onExport}
          />
        </CopilotProvider>
      );

      const exportBtn = screen.getByRole('button', { name: /export|exportera/i });
      await user.click(exportBtn);

      const mdOption = await screen.findByRole('menuitem', { name: /markdown/i });
      await user.click(mdOption);

      expect(onExport).toHaveBeenCalledWith('markdown', expect.stringContaining('# Conversation'));
      expect(onExport).toHaveBeenCalledWith('markdown', expect.stringContaining('Question'));
      expect(onExport).toHaveBeenCalledWith('markdown', expect.stringContaining('Answer'));
    });

    test('exports conversation as JSON with metadata', async () => {
      const messages: CopilotMessage[] = [
        { 
          id: '1', 
          role: 'assistant', 
          content: 'Response',
          timestamp: '2024-01-15T10:00:00Z',
          toolCalls: [{ id: 't1', name: 'search', result: {} }],
          citations: [{ id: 'INS-2024-01-001', type: 'insight' }]
        }
      ];

      const onExport = jest.fn();
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            messages={messages}
            onExport={onExport}
          />
        </CopilotProvider>
      );

      const exportBtn = screen.getByRole('button', { name: /export/i });
      await user.click(exportBtn);

      const jsonOption = await screen.findByRole('menuitem', { name: /json/i });
      await user.click(jsonOption);

      expect(onExport).toHaveBeenCalledWith('json', expect.objectContaining({
        messages,
        metadata: expect.objectContaining({
          exportedAt: expect.any(String),
          messageCount: 1,
          toolCallCount: 1,
          citationCount: 1
        })
      }));
    });

    test('copies conversation link to clipboard', async () => {
      const writeText = jest.fn();
      Object.assign(navigator, {
        clipboard: { writeText }
      });

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            conversationId="conv-123"
          />
        </CopilotProvider>
      );

      const shareBtn = screen.getByRole('button', { name: /share|dela/i });
      await user.click(shareBtn);

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/conversations/conv-123'));
      
      const toast = await screen.findByRole('status', { name: /copied/i });
      expect(toast).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('shows error message when message send fails', async () => {
      const onSendMessage = jest.fn().mockRejectedValue(new Error('Network error'));
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            onSendMessage={onSendMessage}
          />
        </CopilotProvider>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      const error = await screen.findByRole('alert');
      expect(error).toHaveTextContent(/failed to send message/i);
      expect(error).toHaveClass('error-message');
    });

    test('shows retry button for failed messages', async () => {
      const failedMessage: CopilotMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Failed message',
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: 'Network timeout'
      };

      const onRetry = jest.fn();
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            messages={[failedMessage]}
            onRetryMessage={onRetry}
          />
        </CopilotProvider>
      );

      const retryBtn = screen.getByRole('button', { name: /retry|försök igen/i });
      expect(retryBtn).toBeInTheDocument();
      
      await user.click(retryBtn);
      expect(onRetry).toHaveBeenCalledWith('msg-1');
    });

    test('handles rate limiting gracefully', async () => {
      const onSendMessage = jest.fn().mockRejectedValue({ 
        code: 'RATE_LIMIT',
        retryAfter: 30
      });

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            onSendMessage={onSendMessage}
          />
        </CopilotProvider>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Message');
      await user.keyboard('{Enter}');

      const warning = await screen.findByRole('alert');
      expect(warning).toHaveTextContent(/rate limit.*30 seconds/i);
      expect(input).toBeDisabled();

      // Should re-enable after timeout
      await waitFor(() => {
        expect(input).toBeEnabled();
      }, { timeout: 31000 });
    });
  });

  describe('Accessibility', () => {
    test('meets WCAG 2.1 Level AA standards', async () => {
      const { container } = render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('supports keyboard navigation throughout interface', async () => {
      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      // Tab through interface
      await user.tab();
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /export/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();

      // Escape closes dock
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('announces state changes to screen readers', async () => {
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            isProcessing={true}
          />
        </CopilotProvider>
      );

      const liveRegion = screen.getByRole('status', { name: /live updates/i });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveTextContent(/processing your request/i);
    });

    test('provides proper ARIA labels for all interactive elements', () => {
      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label');

      const sendBtn = screen.getByRole('button', { name: /send/i });
      expect(sendBtn).toHaveAttribute('aria-label');

      const dock = screen.getByRole('dialog');
      expect(dock).toHaveAttribute('aria-labelledby');
    });
  });

  describe('Performance', () => {
    test('virtualizes long conversation lists', async () => {
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString()
      })) as CopilotMessage[];

      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            messages={messages}
          />
        </CopilotProvider>
      );

      // Only visible messages should be rendered
      const renderedMessages = screen.getAllByRole('article');
      expect(renderedMessages.length).toBeLessThan(50); // Virtualization window
    });

    test('debounces rapid message input', async () => {
      jest.useFakeTimers();
      const onTyping = jest.fn();
      
      render(
        <CopilotProvider>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            onTypingIndicator={onTyping}
          />
        </CopilotProvider>
      );

      const input = screen.getByRole('textbox');
      
      // Rapid typing
      await user.type(input, 'Hello');
      
      // Should not fire immediately
      expect(onTyping).not.toHaveBeenCalled();
      
      // Fast-forward debounce timer
      jest.advanceTimersByTime(300);
      
      expect(onTyping).toHaveBeenCalledTimes(1);
      expect(onTyping).toHaveBeenCalledWith(true);
      
      jest.useRealTimers();
    });

    test('lazy loads tool call details', async () => {
      const loadToolDetails = jest.fn();
      const message: CopilotMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Processing',
        timestamp: new Date().toISOString(),
        toolCalls: [
          { id: 'tool-1', name: 'heavy-operation', lazy: true }
        ]
      };

      render(
        <CopilotProvider onLoadToolDetails={loadToolDetails}>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
            messages={[message]}
          />
        </CopilotProvider>
      );

      const toolCall = screen.getByRole('button', { name: /heavy-operation/i });
      
      // Details not loaded initially
      expect(loadToolDetails).not.toHaveBeenCalled();
      
      // Load on expand
      await user.click(toolCall);
      expect(loadToolDetails).toHaveBeenCalledWith('tool-1');
    });
  });

  describe('Integration with Platform', () => {
    test('integrates with existing GlassCard components', () => {
      render(
        <CopilotProvider>
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const glassCards = document.querySelectorAll('.glass-card');
      expect(glassCards.length).toBeGreaterThan(0);
      
      glassCards.forEach(card => {
        expect(card).toHaveStyle({
          backdropFilter: expect.stringContaining('blur'),
          background: expect.stringContaining('rgba')
        });
      });
    });

    test('respects platform theme settings', () => {
      render(
        <CopilotProvider theme="dark">
          <CopilotDock isOpen={true} onClose={jest.fn()} />
        </CopilotProvider>
      );

      const dock = screen.getByRole('dialog');
      expect(dock).toHaveClass('dark');
      expect(dock).toHaveStyle({
        colorScheme: 'dark'
      });
    });

    test('integrates with platform notification system', async () => {
      const onNotification = jest.fn();
      render(
        <CopilotProvider onNotification={onNotification}>
          <CopilotDock 
            isOpen={true} 
            onClose={jest.fn()}
          />
        </CopilotProvider>
      );

      // Trigger an action that creates notification
      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onNotification).toHaveBeenCalledWith({
          type: 'info',
          message: expect.stringContaining('Message sent'),
          duration: expect.any(Number)
        });
      });
    });
  });
});