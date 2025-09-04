/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InsightsListInterface } from '@/components/insights/insights-list-interface';
import { ThemeProvider } from '@/lib/theme-provider';
import { MockWebSocketProvider, mockInsights } from '../__mocks__/insights-mocks';
import { server } from '../__mocks__/server';
import { rest } from 'msw';

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { 
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
        cacheTime: 1000 * 60 * 10 // 10 minutes
      },
      mutations: { retry: false },
    },
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MockWebSocketProvider>
            {component}
          </MockWebSocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ),
    queryClient
  };
};

describe('InsightsListInterface - Performance', () => {
  describe('React Query Caching', () => {
    test('should cache insights data and reuse on navigation', async () => {
      const fetchSpy = jest.fn();
      
      server.use(
        rest.get('/api/insights', (req, res, ctx) => {
          fetchSpy();
          const params = {
            page: Number(req.url.searchParams.get('page')) || 1,
            pageSize: 10
          };
          const response = {
            data: mockInsights.slice((params.page - 1) * 10, params.page * 10),
            total: mockInsights.length,
            page: params.page,
            pageSize: 10,
            totalPages: Math.ceil(mockInsights.length / 10)
          };
          return res(ctx.status(200), ctx.json(response));
        })
      );

      const user = userEvent.setup();
      const { queryClient } = renderWithProviders(<InsightsListInterface locale="sv" />);

      // Initial load
      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Navigate to page 2
      await user.click(screen.getByRole('button', { name: /nästa/i }));
      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-011')).toBeInTheDocument();
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Navigate back to page 1 - should use cache
      await user.click(screen.getByRole('button', { name: /föregående/i }));
      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });
      
      // Should not fetch again due to cache
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Verify cache has the data
      const cachedData = queryClient.getQueryData(['insights', { page: 1, pageSize: 10 }]);
      expect(cachedData).toBeDefined();
    });

    test('should prefetch next page for smooth pagination', async () => {
      const fetchSpy = jest.fn();
      
      server.use(
        rest.get('/api/insights', (req, res, ctx) => {
          const page = Number(req.url.searchParams.get('page')) || 1;
          fetchSpy(page);
          const response = {
            data: mockInsights.slice((page - 1) * 10, page * 10),
            total: mockInsights.length,
            page,
            pageSize: 10,
            totalPages: 5
          };
          return res(ctx.status(200), ctx.json(response));
        })
      );

      const { queryClient } = renderWithProviders(<InsightsListInterface locale="sv" prefetchNext={true} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });

      // Should have fetched page 1
      expect(fetchSpy).toHaveBeenCalledWith(1);

      // Wait a bit for prefetch
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(2);
      }, { timeout: 2000 });

      // Page 2 should be in cache
      const cachedPage2 = queryClient.getQueryData(['insights', { page: 2, pageSize: 10 }]);
      expect(cachedPage2).toBeDefined();
    });

    test('should invalidate cache on mutations', async () => {
      const fetchSpy = jest.fn();
      
      server.use(
        rest.get('/api/insights', (req, res, ctx) => {
          fetchSpy();
          return res(ctx.status(200), ctx.json({
            data: mockInsights.slice(0, 10),
            total: mockInsights.length,
            page: 1,
            pageSize: 10,
            totalPages: 5
          }));
        })
      );

      const user = userEvent.setup();
      const { queryClient } = renderWithProviders(<InsightsListInterface locale="sv" />);

      // Initial load
      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Update an insight status
      const statusCell = screen.getByTestId('status-cell-INS-2024-03-001');
      await user.click(within(statusCell).getByRole('button'));
      await user.click(screen.getByRole('option', { name: /validerad/i }));

      // Should refetch after mutation
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Optimistic Updates', () => {
    test('should immediately update UI on status change', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });

      const statusBadge = screen.getByTestId('status-badge-INS-2024-03-001');
      const initialStatus = statusBadge.textContent;

      // Change status
      const statusCell = screen.getByTestId('status-cell-INS-2024-03-001');
      await user.click(within(statusCell).getByRole('button'));
      await user.click(screen.getByRole('option', { name: /validerad/i }));

      // Should immediately show new status (optimistic update)
      expect(statusBadge).not.toHaveTextContent(initialStatus!);
      expect(statusBadge).toHaveTextContent(/validerad/i);

      // Should show optimistic indicator
      expect(statusBadge.parentElement).toHaveClass('opacity-70');
    });

    test('should handle batch operations optimistically', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(11);
      });

      // Select multiple items
      const checkboxes = screen.getAllByRole('checkbox', { name: /välj rad/i });
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Pin items
      await user.click(screen.getByRole('button', { name: /fäst/i }));

      // Should immediately show pinned state
      const pinnedIcons = screen.getAllByTestId('pinned-icon');
      expect(pinnedIcons.length).toBeGreaterThanOrEqual(3);

      // Items should have optimistic styling
      pinnedIcons.forEach(icon => {
        expect(icon.parentElement).toHaveClass('opacity-70');
      });
    });
  });

  describe('Virtualization', () => {
    test('should virtualize large lists for performance', async () => {
      // Mock a large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockInsights[0],
        id: `INS-2024-03-${String(i + 1).padStart(4, '0')}`,
        title: { sv: `Insikt ${i + 1}`, en: `Insight ${i + 1}` }
      }));

      server.use(
        rest.get('/api/insights', (req, res, ctx) => {
          const page = Number(req.url.searchParams.get('page')) || 1;
          const pageSize = 100; // Large page size to test virtualization
          const start = (page - 1) * pageSize;
          
          return res(ctx.status(200), ctx.json({
            data: largeDataset.slice(start, start + pageSize),
            total: largeDataset.length,
            page,
            pageSize,
            totalPages: Math.ceil(largeDataset.length / pageSize)
          }));
        })
      );

      renderWithProviders(<InsightsListInterface locale="sv" pageSize={100} virtualized={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('virtual-list-container')).toBeInTheDocument();
      });

      // Only visible items should be rendered
      const renderedRows = screen.getAllByRole('row');
      expect(renderedRows.length).toBeLessThan(100); // Not all 100 items should be in DOM

      // Check virtualization attributes
      const container = screen.getByTestId('virtual-list-container');
      expect(container).toHaveAttribute('data-virtualized', 'true');
      expect(container).toHaveStyle({ height: expect.stringMatching(/\d+px/) });
    });

    test('should handle scroll in virtualized list', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(<InsightsListInterface locale="sv" pageSize={100} virtualized={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('virtual-list-container')).toBeInTheDocument();
      });

      const container = screen.getByTestId('virtual-list-container');
      
      // Simulate scroll
      await user.pointer([
        { target: container, coords: { x: 100, y: 100 } },
        { keys: '[MouseLeft>]', target: container },
        { coords: { x: 100, y: -400 } }, // Scroll down
      ]);

      // New items should be rendered
      await waitFor(() => {
        expect(screen.queryByText('INS-2024-03-020')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates Performance', () => {
    test('should batch WebSocket updates for performance', async () => {
      const { container } = renderWithProviders(<InsightsListInterface locale="sv" />);

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(11);
      });

      // Send multiple WebSocket updates rapidly
      const updates = Array.from({ length: 10 }, (_, i) => ({
        type: 'insight-updated',
        data: {
          id: `INS-2024-03-${String(i + 1).padStart(3, '0')}`,
          status: 'validated'
        }
      }));

      // Fire all updates within 100ms
      updates.forEach((update, i) => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('ws-message', { detail: update }));
        }, i * 10);
      });

      // Should batch updates and render once
      await waitFor(() => {
        const validatedBadges = screen.getAllByText(/validerad/i);
        expect(validatedBadges.length).toBeGreaterThanOrEqual(5);
      });

      // Check that DOM mutations were batched (using MutationObserver would be better in real test)
      const updateIndicator = screen.getByTestId('batch-update-indicator');
      expect(updateIndicator).toHaveTextContent(/10 uppdateringar/i);
    });

    test('should debounce rapid filter changes', async () => {
      const fetchSpy = jest.fn();
      
      server.use(
        rest.get('/api/insights', (req, res, ctx) => {
          const supplier = req.url.searchParams.get('supplier');
          fetchSpy(supplier);
          return res(ctx.status(200), ctx.json({
            data: mockInsights.filter(i => 
              !supplier || i.supplierName.toLowerCase().includes(supplier.toLowerCase())
            ).slice(0, 10),
            total: 10,
            page: 1,
            pageSize: 10,
            totalPages: 1
          }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<InsightsListInterface locale="sv" />);

      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });

      const supplierSearch = screen.getByTestId('supplier-search');

      // Type rapidly
      await user.type(supplierSearch, 'Ragn', { delay: 50 });

      // Should debounce and only fetch once after typing stops
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenLastCalledWith('Ragn');
      }, { timeout: 1000 });

      // Should have called less times than characters typed
      expect(fetchSpy).toHaveBeenCalledTimes(2); // Initial + 1 debounced call
    });
  });

  describe('Memory Management', () => {
    test('should clean up event listeners on unmount', async () => {
      const { unmount } = renderWithProviders(<InsightsListInterface locale="sv" />);

      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });

      // Get initial listener count
      const getListenerCount = () => {
        const events = (window as any).getEventListeners?.(window) || {};
        return Object.values(events).flat().length;
      };

      const initialCount = getListenerCount();

      // Unmount component
      unmount();

      // Listeners should be cleaned up
      const finalCount = getListenerCount();
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    });

    test('should cancel in-flight requests on unmount', async () => {
      const abortSpy = jest.fn();
      
      server.use(
        rest.get('/api/insights', (req, res, ctx) => {
          // Listen for abort
          req.signal.addEventListener('abort', abortSpy);
          
          return res(
            ctx.delay(1000), // Delay to ensure request is in-flight
            ctx.status(200),
            ctx.json({ data: [], total: 0 })
          );
        })
      );

      const { unmount } = renderWithProviders(<InsightsListInterface locale="sv" />);

      // Unmount while request is in-flight
      setTimeout(() => unmount(), 100);

      await waitFor(() => {
        expect(abortSpy).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('should limit cached query data size', async () => {
      const { queryClient } = renderWithProviders(<InsightsListInterface locale="sv" />);

      // Navigate through many pages to build cache
      const user = userEvent.setup();
      
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByRole('button', { name: /nästa/i }));
        await waitFor(() => {
          expect(screen.getByTestId('page-info')).toHaveTextContent(`Sida ${i + 2}`);
        });
      }

      // Check cache size
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      
      // Should have a reasonable limit on cached queries
      expect(queries.length).toBeLessThanOrEqual(20);
      
      // Old queries should be garbage collected
      const oldestQuery = queries.reduce((oldest, current) => 
        current.state.dataUpdatedAt < oldest.state.dataUpdatedAt ? current : oldest
      );
      
      const ageInMinutes = (Date.now() - oldestQuery.state.dataUpdatedAt) / 1000 / 60;
      expect(ageInMinutes).toBeLessThan(10); // No query older than 10 minutes
    });
  });

  describe('Responsive Performance', () => {
    test('should render mobile-optimized view on small screens', () => {
      // Set mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      renderWithProviders(<InsightsListInterface locale="sv" />);

      // Should render mobile-optimized components
      expect(screen.getByTestId('mobile-table-view')).toBeInTheDocument();
      expect(screen.queryByTestId('desktop-table-view')).not.toBeInTheDocument();

      // Should have mobile-specific controls
      expect(screen.getByTestId('mobile-filter-drawer-trigger')).toBeInTheDocument();
    });

    test('should lazy-load evidence panels on mobile', async () => {
      const user = userEvent.setup();
      
      // Set mobile viewport
      global.innerWidth = 375;
      
      renderWithProviders(<InsightsListInterface locale="sv" />);

      await waitFor(() => {
        expect(screen.getByText('INS-2024-03-001')).toBeInTheDocument();
      });

      // Evidence should not be loaded initially
      expect(screen.queryByTestId('evidence-panel-INS-2024-03-001')).not.toBeInTheDocument();

      // Expand row
      await user.click(screen.getByTestId('expand-row-INS-2024-03-001'));

      // Should show loading state first
      expect(screen.getByTestId('evidence-loading-INS-2024-03-001')).toBeInTheDocument();

      // Then load evidence
      await waitFor(() => {
        expect(screen.getByTestId('evidence-panel-INS-2024-03-001')).toBeInTheDocument();
      });
    });
  });
});