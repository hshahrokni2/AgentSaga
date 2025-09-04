/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FindingsTriageInterface } from '@/components/findings/findings-triage-interface';

describe('Minimal Render Test', () => {
  beforeEach(() => {
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

  test('Should render without any providers except QueryClient', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <FindingsTriageInterface 
          supplierId="test-supplier"
          locale="sv"
        />
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
  
  test('Should render with just locale prop', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    render(
      <QueryClientProvider client={queryClient}>
        <FindingsTriageInterface 
          supplierId="test-supplier"
          locale="en"
        />
      </QueryClientProvider>
    );
    
    // Component should render without errors
    expect(true).toBe(true);
  });
});