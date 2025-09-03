/**
 * @jest-environment jsdom
 * Markdown Renderer Tests for AI Copilot
 * RED Phase - Testing markdown rendering with tool responses
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Non-existent imports - will fail
import { MarkdownRenderer } from '@/components/copilot/MarkdownRenderer';
import { renderMarkdown } from '@/lib/markdown';
import type { MarkdownContent } from '@/components/copilot/types';

describe('MarkdownRenderer - Tool Response Formatting', () => {
  describe('Basic Markdown Rendering', () => {
    test('renders headings with proper hierarchy', () => {
      const content = `
# Main Heading
## Subheading
### Sub-subheading
Regular text
      `;

      render(<MarkdownRenderer content={content} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Heading');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Subheading');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Sub-subheading');
      expect(screen.getByText('Regular text')).toBeInTheDocument();
    });

    test('renders lists with Swedish content', () => {
      const content = `
**Försenade fakturor:**
- Leverantör A: 45,000 SEK
- Leverantör B: 23,500 SEK
- Leverantör C: 12,750 SEK

**Åtgärder:**
1. Kontakta leverantörer
2. Granska betalningsvillkor
3. Uppdatera förfallodatum
      `;

      render(<MarkdownRenderer content={content} />);

      const lists = screen.getAllByRole('list');
      expect(lists).toHaveLength(2);

      const bulletList = lists[0];
      expect(within(bulletList).getByText(/Leverantör A: 45,000 SEK/)).toBeInTheDocument();
      
      const orderedList = lists[1];
      expect(within(orderedList).getByText(/Kontakta leverantörer/)).toBeInTheDocument();
    });

    test('renders tables with sortable headers', async () => {
      const content = `
| Leverantör | Förfallodatum | Belopp (SEK) | Status |
|------------|---------------|--------------|---------|
| Skåne AB | 2024-01-15 | 45,000 | Försenad |
| Malmö Trading | 2024-01-20 | 23,500 | Betald |
| Göteborg Logistics | 2024-01-25 | 12,750 | Pågående |
      `;

      render(<MarkdownRenderer content={content} enableTableSort={true} />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      const headers = within(table).getAllByRole('columnheader');
      expect(headers).toHaveLength(4);
      expect(headers[0]).toHaveTextContent('Leverantör');

      // Test sorting
      const user = userEvent.setup();
      const sortButton = within(headers[2]).getByRole('button', { name: /sort/i });
      await user.click(sortButton);

      const rows = within(table).getAllByRole('row');
      expect(rows[1]).toHaveTextContent('12,750'); // Sorted ascending
    });

    test('renders inline code and code blocks', () => {
      const content = `
Use the \`archon:perform_rag_query\` function to search.

\`\`\`json
{
  "query": "invoice anomalies",
  "match_count": 5,
  "source_domain": "finance.se"
}
\`\`\`

\`\`\`python
def calculate_total(invoices):
    return sum(inv.amount for inv in invoices)
\`\`\`
      `;

      render(<MarkdownRenderer content={content} />);

      const inlineCode = screen.getByText('archon:perform_rag_query');
      expect(inlineCode.tagName).toBe('CODE');
      expect(inlineCode).toHaveClass('inline-code');

      const codeBlocks = screen.getAllByRole('code');
      expect(codeBlocks[0]).toHaveClass('language-json');
      expect(codeBlocks[1]).toHaveClass('language-python');
    });
  });

  describe('Enhanced Features', () => {
    test('auto-links URLs and email addresses', () => {
      const content = `
Visit https://example.com for more info.
Contact: support@company.se
Documentation: [API Docs](https://api.example.com/docs)
      `;

      render(<MarkdownRenderer content={content} />);

      const autoLink = screen.getByRole('link', { name: 'https://example.com' });
      expect(autoLink).toHaveAttribute('href', 'https://example.com');
      expect(autoLink).toHaveAttribute('target', '_blank');
      expect(autoLink).toHaveAttribute('rel', 'noopener noreferrer');

      const emailLink = screen.getByRole('link', { name: 'support@company.se' });
      expect(emailLink).toHaveAttribute('href', 'mailto:support@company.se');

      const namedLink = screen.getByRole('link', { name: 'API Docs' });
      expect(namedLink).toHaveAttribute('href', 'https://api.example.com/docs');
    });

    test('highlights INS/SCN IDs as clickable citations', () => {
      const content = `
Found anomalies in:
- INS-2024-01-001: Payment delay
- INS-2024-01-002: Amount mismatch
- SCN-2024-01-010: Scenario for bulk update
      `;

      const onCitationClick = jest.fn();
      render(
        <MarkdownRenderer 
          content={content} 
          onCitationClick={onCitationClick}
        />
      );

      const ins1 = screen.getByRole('button', { name: /INS-2024-01-001/ });
      expect(ins1).toHaveClass('citation-link');
      
      const scn1 = screen.getByRole('button', { name: /SCN-2024-01-010/ });
      expect(scn1).toHaveClass('citation-link');
    });

    test('renders collapsible sections for long content', async () => {
      const content = `
<details>
<summary>Detailed Analysis Results</summary>

Here is a comprehensive analysis of the invoice data...
[Long content here]

Total findings: 42
</details>
      `;

      render(<MarkdownRenderer content={content} />);

      const summary = screen.getByText('Detailed Analysis Results');
      expect(summary.closest('details')).toBeInTheDocument();
      
      const details = summary.closest('details')!;
      expect(details).toHaveAttribute('open', '');

      const user = userEvent.setup();
      await user.click(summary);
      expect(details).not.toHaveAttribute('open');
    });

    test('renders alerts and callouts with appropriate styling', () => {
      const content = `
> [!WARNING]
> Critical issue detected in payment processing

> [!INFO]
> Last updated: 2024-01-15

> [!SUCCESS]
> All validations passed
      `;

      render(<MarkdownRenderer content={content} />);

      const warning = screen.getByRole('alert');
      expect(warning).toHaveClass('alert-warning');
      expect(warning).toHaveTextContent('Critical issue detected');

      const info = screen.getByText(/Last updated/).closest('[role="note"]');
      expect(info).toHaveClass('alert-info');

      const success = screen.getByText(/validations passed/).closest('[role="status"]');
      expect(success).toHaveClass('alert-success');
    });

    test('supports math expressions with KaTeX', () => {
      const content = `
The total amount is calculated as:

$$\\sum_{i=1}^{n} invoice_i = 125,750 \\text{ SEK}$$

Where the variance is $\\sigma^2 = 2,500$.
      `;

      render(<MarkdownRenderer content={content} enableMath={true} />);

      const blockMath = document.querySelector('.katex-display');
      expect(blockMath).toBeInTheDocument();
      expect(blockMath).toHaveTextContent('125,750 SEK');

      const inlineMath = document.querySelector('.katex:not(.katex-display)');
      expect(inlineMath).toBeInTheDocument();
    });

    test('renders mermaid diagrams for process flows', async () => {
      const content = `
\`\`\`mermaid
graph TD
    A[Invoice Received] --> B{Amount > 50,000?}
    B -->|Yes| C[Manager Approval]
    B -->|No| D[Auto-approve]
    C --> E[Process Payment]
    D --> E
\`\`\`
      `;

      render(<MarkdownRenderer content={content} enableDiagrams={true} />);

      await screen.findByTestId('mermaid-diagram');
      const diagram = screen.getByTestId('mermaid-diagram');
      expect(diagram.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Tool Response Formatting', () => {
    test('formats JSON tool responses with syntax highlighting', () => {
      const toolResponse = {
        tool: 'archon:perform_rag_query',
        result: {
          success: true,
          results: [
            { id: 'doc-1', content: 'Content 1', score: 0.95 },
            { id: 'doc-2', content: 'Content 2', score: 0.87 }
          ],
          count: 2
        }
      };

      const content = `
Tool: \`${toolResponse.tool}\`

Result:
\`\`\`json
${JSON.stringify(toolResponse.result, null, 2)}
\`\`\`
      `;

      render(<MarkdownRenderer content={content} />);

      const codeBlock = screen.getByRole('code');
      expect(codeBlock).toHaveClass('language-json');
      
      // Check for syntax highlighting spans
      const highlightedElements = codeBlock.querySelectorAll('.hljs-string, .hljs-number, .hljs-literal');
      expect(highlightedElements.length).toBeGreaterThan(0);
    });

    test('formats SQL query results as tables', () => {
      const content = `
Query executed successfully:

\`\`\`sql
SELECT supplier, COUNT(*) as invoice_count, SUM(amount) as total
FROM invoices
WHERE status = 'overdue'
GROUP BY supplier
\`\`\`

Results:
| supplier | invoice_count | total |
|----------|---------------|--------|
| Skåne AB | 5 | 125,750 |
| Malmö Trading | 3 | 67,500 |
| Göteborg Logistics | 2 | 45,000 |

Total overdue: **238,250 SEK**
      `;

      render(<MarkdownRenderer content={content} />);

      const sqlBlock = screen.getByText(/SELECT supplier/);
      expect(sqlBlock.closest('code')).toHaveClass('language-sql');

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(4); // header + 3 data rows

      const totalText = screen.getByText('238,250 SEK');
      expect(totalText.closest('strong')).toBeInTheDocument();
    });

    test('creates interactive charts from data', async () => {
      const content = `
\`\`\`chart
{
  "type": "bar",
  "data": {
    "labels": ["Jan", "Feb", "Mar"],
    "datasets": [{
      "label": "Försenade fakturor",
      "data": [12, 19, 8]
    }]
  }
}
\`\`\`
      `;

      render(<MarkdownRenderer content={content} enableCharts={true} />);

      const chart = await screen.findByTestId('chart-container');
      expect(chart).toBeInTheDocument();
      expect(chart.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Copy and Export Features', () => {
    test('provides copy button for code blocks', async () => {
      const content = `
\`\`\`python
def process_invoice(invoice_id):
    # Process Swedish invoice
    return {"status": "processed", "id": invoice_id}
\`\`\`
      `;

      render(<MarkdownRenderer content={content} />);

      const user = userEvent.setup();
      const copyButton = screen.getByRole('button', { name: /copy/i });
      
      const writeText = jest.fn();
      Object.assign(navigator, {
        clipboard: { writeText }
      });

      await user.click(copyButton);
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('def process_invoice'));
      
      // Button should show success state
      expect(copyButton).toHaveTextContent(/copied/i);
    });

    test('allows selective text export', async () => {
      const content = `
# Report Summary

Key findings:
- Finding 1
- Finding 2

## Details
[Detailed content here]
      `;

      const onExport = jest.fn();
      render(
        <MarkdownRenderer 
          content={content} 
          enableExport={true}
          onExport={onExport}
        />
      );

      const user = userEvent.setup();
      
      // Select text
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.selectNodeContents(screen.getByText('Key findings:'));
      selection.removeAllRanges();
      selection.addRange(range);

      // Export button appears on selection
      const exportBtn = await screen.findByRole('button', { name: /export selected/i });
      await user.click(exportBtn);

      expect(onExport).toHaveBeenCalledWith({
        format: 'markdown',
        content: expect.stringContaining('Key findings:'),
        selection: true
      });
    });
  });

  describe('Swedish Locale Support', () => {
    test('formats numbers and dates according to Swedish locale', () => {
      const content = `
Invoice total: {{format:number:125750.50}}
Due date: {{format:date:2024-01-15}}
Percentage: {{format:percent:0.125}}
      `;

      render(<MarkdownRenderer content={content} locale="sv-SE" />);

      expect(screen.getByText('125 750,50')).toBeInTheDocument();
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
      expect(screen.getByText('12,5 %')).toBeInTheDocument();
    });

    test('handles Swedish characters in all contexts', () => {
      const content = `
# Översikt över försenade ärenden

**Leverantörer från Skåne:**
- Åkerströms AB
- Östergötlands Logistik
- Änglaviks Transport

\`försenade_ärenden = ["Åkerströms", "Östergötlands"]\`

> Observera: Alla belopp är i SEK inklusive moms.
      `;

      render(<MarkdownRenderer content={content} />);

      expect(screen.getByRole('heading')).toHaveTextContent('Översikt över försenade ärenden');
      expect(screen.getByText('Åkerströms AB')).toBeInTheDocument();
      expect(screen.getByText(/försenade_ärenden/)).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    test('lazy renders long content with virtualization', () => {
      const longContent = Array.from({ length: 1000 }, (_, i) => 
        `## Section ${i}\nContent for section ${i}\n`
      ).join('\n');

      render(<MarkdownRenderer content={longContent} virtualizeThreshold={50} />);

      // Only visible sections should be rendered
      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings.length).toBeLessThan(100);
    });

    test('memoizes parsed markdown to avoid re-parsing', () => {
      const parseSpy = jest.spyOn(renderMarkdown as any, 'parse');
      const content = '# Test Content';

      const { rerender } = render(
        <MarkdownRenderer content={content} theme="light" />
      );

      expect(parseSpy).toHaveBeenCalledTimes(1);

      // Re-render with same content but different prop
      rerender(
        <MarkdownRenderer content={content} theme="dark" />
      );

      // Should not re-parse
      expect(parseSpy).toHaveBeenCalledTimes(1);
    });

    test('debounces live preview updates', async () => {
      jest.useFakeTimers();
      const onRender = jest.fn();

      const { rerender } = render(
        <MarkdownRenderer 
          content="Initial" 
          livePreview={true}
          onRender={onRender}
        />
      );

      // Rapid updates
      rerender(<MarkdownRenderer content="Update 1" livePreview={true} onRender={onRender} />);
      rerender(<MarkdownRenderer content="Update 2" livePreview={true} onRender={onRender} />);
      rerender(<MarkdownRenderer content="Update 3" livePreview={true} onRender={onRender} />);

      expect(onRender).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(onRender).toHaveBeenCalledTimes(1);
      expect(onRender).toHaveBeenCalledWith('Update 3');

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    test('handles malformed markdown gracefully', () => {
      const malformed = `
# Unclosed heading [link
**Unclosed bold
\`\`\`
Unclosed code block
      `;

      render(<MarkdownRenderer content={malformed} />);

      // Should still render something
      expect(screen.getByText(/Unclosed heading/)).toBeInTheDocument();
      
      // Error boundary should not trigger
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('sanitizes dangerous HTML to prevent XSS', () => {
      const dangerous = `
<script>alert('XSS')</script>
<img src="x" onerror="alert('XSS')">
<a href="javascript:alert('XSS')">Click</a>
      `;

      render(<MarkdownRenderer content={dangerous} />);

      expect(document.querySelector('script')).not.toBeInTheDocument();
      
      const img = document.querySelector('img');
      expect(img).not.toHaveAttribute('onerror');
      
      const link = screen.getByText('Click');
      expect(link).not.toHaveAttribute('href', 'javascript:alert(\'XSS\')');
    });

    test('shows error message for failed chart rendering', async () => {
      const invalidChart = `
\`\`\`chart
{ invalid json }
\`\`\`
      `;

      render(<MarkdownRenderer content={invalidChart} enableCharts={true} />);

      const error = await screen.findByRole('alert');
      expect(error).toHaveTextContent(/failed to render chart/i);
      expect(error).toHaveClass('chart-error');
    });
  });
});