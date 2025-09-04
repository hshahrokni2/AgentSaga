/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FindingsTriageInterface } from '@/components/findings/findings-triage-interface';
import { ThemeProvider } from '@/lib/theme-provider';
import { MockWebSocketProvider } from '../__mocks__/insights-mocks';

describe('Provider Tests', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    // Mock fetch
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
  });

  test('Should render with QueryClient + ThemeProvider', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FindingsTriageInterface 
            supplierId="test-supplier"
            locale="sv"
          />
        </ThemeProvider>
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
  
  test('Should render with QueryClient + MockWebSocketProvider', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MockWebSocketProvider>
          <FindingsTriageInterface 
            supplierId="test-supplier"
            locale="sv"
          />
        </MockWebSocketProvider>
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
  
  test('Should render with all providers', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MockWebSocketProvider>
            <FindingsTriageInterface 
              supplierId="test-supplier"
              locale="sv"
            />
          </MockWebSocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
  
  test('Should render with providers and cloneElement', () => {
    const component = <FindingsTriageInterface supplierId="test-supplier" />;
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MockWebSocketProvider>
            {React.cloneElement(component, { locale: 'sv' })}
          </MockWebSocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
});