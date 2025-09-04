/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FindingsTriageInterface } from '@/components/findings/findings-triage-interface';

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

describe('Simple Render Test', () => {
  test('Renders without crashing', () => {
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
});