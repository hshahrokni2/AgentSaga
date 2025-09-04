import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FindingsTriageInterface } from '@/components/findings/findings-triage-interface';

describe('Basic Import Test', () => {
  it('should import FindingsTriageInterface without error', () => {
    expect(FindingsTriageInterface).toBeDefined();
    expect(typeof FindingsTriageInterface).toBe('function');
  });
  
  it('should render with minimal providers', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <FindingsTriageInterface />
      </QueryClientProvider>
    );
    
    expect(container).toBeTruthy();
  });
});