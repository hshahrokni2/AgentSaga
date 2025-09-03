/**
 * @fileoverview Test suite for Granskad Comment System
 * Tests markdown input, validation, storage, and audit trail
 * 
 * CRITICAL: These tests MUST fail initially per TDD RED phase
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Component imports - These don't exist yet (RED phase)
import { CommentDrawer } from '@/components/granskad/CommentDrawer';
import { GranskadWorkflow } from '@/components/granskad/GranskadWorkflow';
import { CommentEditor } from '@/components/granskad/CommentEditor';
import { Comment, CommentType } from '@/types/granskad';
import { useCommentStore } from '@/stores/commentStore';

// Mock markdown renderer
jest.mock('@/lib/markdown', () => ({
  renderMarkdown: jest.fn((text: string) => `<p>${text}</p>`),
  sanitizeMarkdown: jest.fn((text: string) => text)
}));

describe('GranskadWorkflow - Comment System', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Comment Input & Editor', () => {
    test('should render markdown editor with toolbar', () => {
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          required={true}
        />
      );

      // Editor textarea
      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveAttribute('placeholder', expect.stringContaining('Markdown'));

      // Toolbar buttons
      const boldButton = screen.getByRole('button', { name: /fetstil/i });
      const italicButton = screen.getByRole('button', { name: /kursiv/i });
      const listButton = screen.getByRole('button', { name: /lista/i });
      const linkButton = screen.getByRole('button', { name: /länk/i });
      const codeButton = screen.getByRole('button', { name: /kod/i });

      expect(boldButton).toBeInTheDocument();
      expect(italicButton).toBeInTheDocument();
      expect(listButton).toBeInTheDocument();
      expect(linkButton).toBeInTheDocument();
      expect(codeButton).toBeInTheDocument();
    });

    test('should insert markdown formatting with toolbar buttons', async () => {
      const user = userEvent.setup();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          required={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      
      // Type some text
      await user.type(editor, 'Detta är text');
      
      // Select text
      await user.tripleClick(editor);
      
      // Click bold button
      const boldButton = screen.getByRole('button', { name: /fetstil/i });
      await user.click(boldButton);

      expect(editor).toHaveValue('**Detta är text**');
    });

    test('should support keyboard shortcuts for formatting', async () => {
      const user = userEvent.setup();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          required={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      
      await user.type(editor, 'Text');
      await user.tripleClick(editor); // Select all
      
      // Ctrl+B for bold
      await user.keyboard('{Control>}b{/Control}');
      expect(editor).toHaveValue('**Text**');

      // Ctrl+I for italic  
      await user.keyboard('{Control>}i{/Control}');
      expect(editor).toHaveValue('***Text***');
    });

    test('should show live markdown preview', async () => {
      const user = userEvent.setup();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          required={true}
          showPreview={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      const preview = screen.getByRole('region', { name: /förhandsgranskning/i });

      await user.type(editor, '# Rubrik\n\n**Fet text** och *kursiv*\n\n- Punkt 1\n- Punkt 2');

      await waitFor(() => {
        expect(preview).toContainHTML('<h1>Rubrik</h1>');
        expect(preview).toContainHTML('<strong>Fet text</strong>');
        expect(preview).toContainHTML('<em>kursiv</em>');
        expect(preview).toContainHTML('<ul>');
        expect(preview).toContainHTML('<li>Punkt 1</li>');
      });
    });

    test('should validate markdown syntax', async () => {
      const user = userEvent.setup();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          required={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      
      // Invalid markdown (unclosed bold)
      await user.type(editor, '**Unclosed bold');

      const validationError = await screen.findByRole('alert');
      expect(validationError).toHaveTextContent(/oavslutad markdown-formatering/i);
      expect(validationError).toHaveClass('text-amber-600');
    });
  });

  describe('Required Comment Validation', () => {
    test('should require comment before allowing state transition', () => {
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          requireComment={true}
        />
      );

      const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
      expect(completeButton).toBeDisabled();

      // Tooltip should mention required comment
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent(/kommentar krävs/i);
    });

    test('should enable completion when valid comment is added', async () => {
      const user = userEvent.setup();
      
      render(
        <GranskadWorkflow 
          monthId="2024-01"
          supplierId="supplier-123"
          requireComment={true}
          checklistComplete={true} // Assume checklist is done
        />
      );

      const commentButton = screen.getByRole('button', { name: /lägg till kommentar/i });
      await user.click(commentButton);

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      await user.type(editor, 'Granskningen visar att alla data är korrekta och uppfyller kraven.');

      const saveButton = screen.getByRole('button', { name: /spara kommentar/i });
      await user.click(saveButton);

      await waitFor(() => {
        const completeButton = screen.getByRole('button', { name: /markera som granskad/i });
        expect(completeButton).toBeEnabled();
      });
    });

    test('should validate minimum comment length', async () => {
      const user = userEvent.setup();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          required={true}
          minLength={50}
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      const submitButton = screen.getByRole('button', { name: /spara/i });

      // Too short comment
      await user.type(editor, 'Kort kommentar');
      await user.click(submitButton);

      const error = await screen.findByRole('alert');
      expect(error).toHaveTextContent(/minst 50 tecken krävs/i);

      // Character counter
      const counter = screen.getByText(/14 \/ 50/);
      expect(counter).toBeInTheDocument();
      expect(counter).toHaveClass('text-red-600');
    });

    test('should prevent empty or whitespace-only comments', async () => {
      const user = userEvent.setup();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          required={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      const submitButton = screen.getByRole('button', { name: /spara/i });

      // Only whitespace
      await user.type(editor, '   \n\n   \t');
      await user.click(submitButton);

      const error = await screen.findByRole('alert');
      expect(error).toHaveTextContent(/kommentar får inte vara tom/i);
    });
  });

  describe('Comment Storage & Persistence', () => {
    test('should save comments to database with metadata', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn();
      
      render(
        <CommentEditor 
          onSubmit={onSave}
          userId="user-123"
          userName="Anna Andersson"
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      await user.type(editor, '## Granskningsresultat\n\nAlla kontroller godkända.');

      const submitButton = screen.getByRole('button', { name: /spara/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          id: expect.any(String),
          content: '## Granskningsresultat\n\nAlla kontroller godkända.',
          markdown: true,
          userId: 'user-123',
          userName: 'Anna Andersson',
          createdAt: expect.any(String),
          type: 'review',
          metadata: expect.objectContaining({
            monthId: expect.any(String),
            supplierId: expect.any(String),
            checklistComplete: expect.any(Boolean)
          })
        });
      });
    });

    test('should persist comments to localStorage as backup', async () => {
      const user = userEvent.setup();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      await user.type(editor, 'Testkommentar för backup');

      // Auto-save should trigger
      await waitFor(() => {
        const draft = localStorage.getItem('comment-draft-2024-01-supplier-123');
        expect(draft).toBeTruthy();
        
        const parsed = JSON.parse(draft!);
        expect(parsed.content).toBe('Testkommentar för backup');
        expect(parsed.lastSaved).toBeTruthy();
      });
    });

    test('should restore draft comments on mount', () => {
      const draft = {
        content: 'Påbörjad kommentar som inte sparades',
        lastSaved: new Date().toISOString()
      };

      localStorage.setItem('comment-draft-2024-01-supplier-123', JSON.stringify(draft));

      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      expect(editor).toHaveValue('Påbörjad kommentar som inte sparades');

      // Should show draft indicator
      const draftBadge = screen.getByText(/utkast återställt/i);
      expect(draftBadge).toBeInTheDocument();
    });

    test('should handle comment versioning', async () => {
      const user = userEvent.setup();
      
      const existingComment = {
        id: 'comment-1',
        content: 'Original kommentar',
        version: 1,
        createdAt: '2024-01-15T10:00:00Z'
      };

      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          existingComment={existingComment}
          allowEdit={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /redigera kommentar/i });
      expect(editor).toHaveValue('Original kommentar');

      await user.clear(editor);
      await user.type(editor, 'Uppdaterad kommentar');

      const saveButton = screen.getByRole('button', { name: /spara ändringar/i });
      await user.click(saveButton);

      // Should show version history
      const versionBadge = screen.getByText(/version 2/i);
      expect(versionBadge).toBeInTheDocument();

      const historyButton = screen.getByRole('button', { name: /visa historik/i });
      await user.click(historyButton);

      const historyDialog = screen.getByRole('dialog', { name: /kommentarshistorik/i });
      expect(within(historyDialog).getByText(/version 1/i)).toBeInTheDocument();
      expect(within(historyDialog).getByText(/original kommentar/i)).toBeInTheDocument();
    });
  });

  describe('Comment Display & Thread', () => {
    test('should display comments in chronological order', () => {
      const comments: Comment[] = [
        {
          id: '1',
          content: 'Första kommentaren',
          createdAt: '2024-01-15T10:00:00Z',
          userName: 'Anna'
        },
        {
          id: '2',
          content: 'Andra kommentaren',
          createdAt: '2024-01-15T11:00:00Z',
          userName: 'Bengt'
        },
        {
          id: '3',
          content: 'Tredje kommentaren',
          createdAt: '2024-01-15T12:00:00Z',
          userName: 'Cecilia'
        }
      ];

      render(
        <CommentDrawer 
          comments={comments}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const commentElements = screen.getAllByRole('article');
      expect(commentElements).toHaveLength(3);

      // Check order
      expect(commentElements[0]).toHaveTextContent('Första kommentaren');
      expect(commentElements[1]).toHaveTextContent('Andra kommentaren');
      expect(commentElements[2]).toHaveTextContent('Tredje kommentaren');
    });

    test('should render markdown content properly', () => {
      const comment = {
        id: '1',
        content: '# Rubrik\n\n**Fet** och *kursiv*\n\n```javascript\nconst test = true;\n```',
        markdown: true,
        createdAt: '2024-01-15T10:00:00Z',
        userName: 'Anna'
      };

      render(
        <CommentDrawer 
          comments={[comment]}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const commentElement = screen.getByRole('article');
      
      // Check rendered markdown
      expect(commentElement.querySelector('h1')).toHaveTextContent('Rubrik');
      expect(commentElement.querySelector('strong')).toHaveTextContent('Fet');
      expect(commentElement.querySelector('em')).toHaveTextContent('kursiv');
      expect(commentElement.querySelector('pre code')).toHaveTextContent('const test = true;');
    });

    test('should show comment metadata', () => {
      const comment = {
        id: '1',
        content: 'Test kommentar',
        createdAt: '2024-01-15T14:30:00Z',
        userName: 'Anna Andersson',
        userId: 'user-123',
        edited: true,
        editedAt: '2024-01-15T15:00:00Z'
      };

      render(
        <CommentDrawer 
          comments={[comment]}
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      const commentElement = screen.getByRole('article');
      
      // Author
      expect(commentElement).toHaveTextContent('Anna Andersson');
      
      // Timestamp (Swedish format)
      expect(commentElement).toHaveTextContent('15 januari 2024 14:30');
      
      // Edited indicator
      expect(commentElement).toHaveTextContent(/redigerad 15:00/i);
    });

    test('should support comment replies/threads', async () => {
      const user = userEvent.setup();
      
      const parentComment = {
        id: '1',
        content: 'Huvudkommentar',
        createdAt: '2024-01-15T10:00:00Z',
        userName: 'Anna'
      };

      render(
        <CommentDrawer 
          comments={[parentComment]}
          monthId="2024-01"
          supplierId="supplier-123"
          allowReplies={true}
        />
      );

      const replyButton = screen.getByRole('button', { name: /svara/i });
      await user.click(replyButton);

      const replyEditor = screen.getByRole('textbox', { name: /skriv svar/i });
      await user.type(replyEditor, 'Detta är ett svar');

      const submitReply = screen.getByRole('button', { name: /skicka svar/i });
      await user.click(submitReply);

      await waitFor(() => {
        const reply = screen.getByText('Detta är ett svar');
        expect(reply).toBeInTheDocument();
        
        // Reply should be indented
        const replyContainer = reply.closest('[data-comment-reply]');
        expect(replyContainer).toHaveClass('ml-8'); // Indentation
      });
    });
  });

  describe('Audit Trail', () => {
    test('should create audit log for every comment action', async () => {
      const user = userEvent.setup();
      const auditLogger = jest.fn();
      
      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          onAudit={auditLogger}
          userId="user-123"
        />
      );

      const editor = screen.getByRole('textbox', { name: /skriv kommentar/i });
      await user.type(editor, 'Audit test comment');

      const submitButton = screen.getByRole('button', { name: /spara/i });
      await user.click(submitButton);

      expect(auditLogger).toHaveBeenCalledWith({
        action: 'COMMENT_CREATED',
        userId: 'user-123',
        timestamp: expect.any(String),
        details: expect.objectContaining({
          commentLength: 18,
          hasMarkdown: false
        })
      });
    });

    test('should log comment edits with diff', async () => {
      const user = userEvent.setup();
      const auditLogger = jest.fn();
      
      const originalComment = {
        id: 'comment-1',
        content: 'Original text',
        createdAt: '2024-01-15T10:00:00Z'
      };

      render(
        <CommentEditor 
          onSubmit={jest.fn()}
          onAudit={auditLogger}
          existingComment={originalComment}
          allowEdit={true}
          userId="user-123"
        />
      );

      const editor = screen.getByRole('textbox', { name: /redigera kommentar/i });
      await user.clear(editor);
      await user.type(editor, 'Updated text');

      const saveButton = screen.getByRole('button', { name: /spara ändringar/i });
      await user.click(saveButton);

      expect(auditLogger).toHaveBeenCalledWith({
        action: 'COMMENT_EDITED',
        userId: 'user-123',
        commentId: 'comment-1',
        timestamp: expect.any(String),
        details: expect.objectContaining({
          previousContent: 'Original text',
          newContent: 'Updated text',
          changeSize: expect.any(Number)
        })
      });
    });

    test('should log comment deletions', async () => {
      const user = userEvent.setup();
      const auditLogger = jest.fn();
      
      const comment = {
        id: 'comment-1',
        content: 'Comment to delete',
        createdAt: '2024-01-15T10:00:00Z',
        userName: 'Anna',
        userId: 'user-123'
      };

      render(
        <CommentDrawer 
          comments={[comment]}
          monthId="2024-01"
          supplierId="supplier-123"
          allowDelete={true}
          onAudit={auditLogger}
          currentUserId="user-123"
        />
      );

      const deleteButton = screen.getByRole('button', { name: /ta bort/i });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmDialog = screen.getByRole('dialog', { name: /bekräfta borttagning/i });
      const confirmButton = within(confirmDialog).getByRole('button', { name: /ta bort/i });
      await user.click(confirmButton);

      expect(auditLogger).toHaveBeenCalledWith({
        action: 'COMMENT_DELETED',
        userId: 'user-123',
        commentId: 'comment-1',
        timestamp: expect.any(String),
        details: expect.objectContaining({
          deletedContent: 'Comment to delete',
          reason: expect.any(String)
        })
      });
    });

    test('should maintain immutable audit trail', () => {
      const auditEntries = [
        {
          id: 'audit-1',
          action: 'COMMENT_CREATED',
          timestamp: '2024-01-15T10:00:00Z',
          userId: 'user-123'
        },
        {
          id: 'audit-2',
          action: 'COMMENT_EDITED',
          timestamp: '2024-01-15T11:00:00Z',
          userId: 'user-123'
        }
      ];

      render(
        <CommentDrawer 
          comments={[]}
          auditLog={auditEntries}
          monthId="2024-01"
          supplierId="supplier-123"
          showAuditLog={true}
        />
      );

      const auditSection = screen.getByRole('region', { name: /granskningslogg/i });
      const auditItems = within(auditSection).getAllByRole('listitem');

      expect(auditItems).toHaveLength(2);
      
      // Check immutability indicators
      auditItems.forEach(item => {
        expect(item).toHaveAttribute('data-immutable', 'true');
        const lockIcon = within(item).getByRole('img', { name: /låst post/i });
        expect(lockIcon).toBeInTheDocument();
      });
    });
  });

  describe('Comment Permissions', () => {
    test('should only allow comment owner to edit', () => {
      const comment = {
        id: 'comment-1',
        content: 'My comment',
        userId: 'user-123',
        userName: 'Anna',
        createdAt: '2024-01-15T10:00:00Z'
      };

      // Render as different user
      render(
        <CommentDrawer 
          comments={[comment]}
          currentUserId="user-456"
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      // Edit button should not be visible
      const editButton = screen.queryByRole('button', { name: /redigera/i });
      expect(editButton).not.toBeInTheDocument();
    });

    test('should allow admin to moderate any comment', () => {
      const comment = {
        id: 'comment-1',
        content: 'User comment',
        userId: 'user-123',
        userName: 'Anna',
        createdAt: '2024-01-15T10:00:00Z'
      };

      render(
        <CommentDrawer 
          comments={[comment]}
          currentUserId="admin-789"
          currentUserRole="admin"
          monthId="2024-01"
          supplierId="supplier-123"
        />
      );

      // Admin actions should be available
      const moderateButton = screen.getByRole('button', { name: /moderera/i });
      expect(moderateButton).toBeInTheDocument();
    });
  });
});