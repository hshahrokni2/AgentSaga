// Simple mock server without MSW for testing
import { mockApiResponses } from './insights-mocks';

// Store handlers
const handlers: Map<string, any> = new Map();

// Mock fetch
global.fetch = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
  const urlObj = new URL(urlString, 'http://localhost');
  const path = urlObj.pathname;
  const searchParams = urlObj.searchParams;
  
  // Handle /api/findings
  if (path === '/api/findings') {
    const { mockFindings } = require('./findings-mocks');
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 50;
    const viewMode = searchParams.get('viewMode') || 'rule';
    
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      ok: true,
      json: async () => ({
        data: mockFindings.slice(start, end),
        total: mockFindings.length,
        page,
        pageSize,
        totalPages: Math.ceil(mockFindings.length / pageSize)
      })
    } as Response;
  }
  
  // Handle batch update
  if (path === '/api/findings/batch-update') {
    const body = options?.body ? JSON.parse(options.body as string) : {};
    return {
      ok: true,
      json: async () => ({
        success: true,
        updated: body.ids?.length || 0,
        status: body.status
      })
    } as Response;
  }
  
  // Handle /api/rules
  if (path === '/api/rules') {
    const { mockRules } = require('./findings-mocks');
    return {
      ok: true,
      json: async () => mockRules
    } as Response;
  }
  
  // Handle /api/clusters
  if (path === '/api/clusters') {
    const { mockClusters } = require('./findings-mocks');
    return {
      ok: true,
      json: async () => mockClusters
    } as Response;
  }
  
  // Handle /api/insights
  if (path === '/api/insights') {
    const params = {
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('pageSize')) || 10,
      severity: searchParams.getAll('severity'),
      status: searchParams.getAll('status'),
      source: searchParams.getAll('source'),
      supplier: searchParams.get('supplier') || '',
      startMonth: searchParams.get('startMonth') || '',
      endMonth: searchParams.get('endMonth') || ''
    };
    
    const response = mockApiResponses.getInsights(params);
    return {
      ok: true,
      json: async () => response
    } as Response;
  }
  
  // Default 404
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not found' })
  } as Response;
}) as jest.Mock;

export const server = {
  listen: () => {},
  close: () => {},
  resetHandlers: () => {
    handlers.clear();
  },
  use: (...newHandlers: any[]) => {
    // Not implemented for simplicity
  }
};