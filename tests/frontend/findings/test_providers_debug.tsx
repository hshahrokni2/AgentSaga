/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FindingsTriageInterface } from '@/components/findings/findings-triage-interface';
import { ThemeProvider } from '@/lib/theme-provider';
import { MockWebSocketProvider } from '../__mocks__/insights-mocks';

// Simple mock for testing
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

describe('Debug Provider Tests', () => {
  test('Component renders with QueryClient only', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <FindingsTriageInterface supplierId="test-supplier" />
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
  
  test('Component renders with QueryClient + Theme', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FindingsTriageInterface supplierId="test-supplier" />
        </ThemeProvider>
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
  
  test('Component renders with all providers', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MockWebSocketProvider>
            <FindingsTriageInterface supplierId="test-supplier" />
          </MockWebSocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
});