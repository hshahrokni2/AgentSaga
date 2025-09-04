/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FindingsTriageInterface } from '@/components/findings/findings-triage-interface';

describe('Simple Render Test', () => {
  test('Should identify the undefined component', () => {
    const queryClient = new QueryClient({
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
    
    try {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <FindingsTriageInterface 
            supplierId="test-supplier"
            locale="sv"
          />
        </QueryClientProvider>
      );
      
      console.log('Render successful!');
    } catch (error: any) {
      console.error('Render error:', error.message);
      
      // Try to extract component name from error
      const match = error.message.match(/got: ([^.]+)/);
      if (match) {
        console.error('Problematic value:', match[1]);
      }
      
      // Re-throw to fail the test
      throw error;
    }
  });
});