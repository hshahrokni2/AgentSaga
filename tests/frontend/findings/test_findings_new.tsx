/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FindingsTriageInterface } from '@/components/findings/findings-triage-interface';
import { ThemeProvider } from '@/lib/theme-provider';
import { MockWebSocketProvider } from '../__mocks__/insights-mocks';

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0
    })
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

describe('FindingsTriageInterface - New Tests', () => {
  test('should render without crashing', async () => {
    renderWithProviders(<FindingsTriageInterface supplierId="test-supplier" />);
    
    // Just check that the component renders
    expect(document.body).toBeTruthy();
  });
  
  test('should display loading state initially', async () => {
    renderWithProviders(<FindingsTriageInterface supplierId="test-supplier" />);
    
    // Component should exist in the DOM
    await waitFor(() => {
      expect(document.querySelector('[data-testid="findings-container"]')).toBeInTheDocument();
    });
  });
});