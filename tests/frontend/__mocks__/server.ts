// @ts-ignore - Jest module resolution issue with MSW v2
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { mockApiResponses } from './insights-mocks';

export const handlers = [
  // Get insights list
  http.get('/api/insights', ({ request }) => {
    const url = new URL(request.url);
    const params = {
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 10,
      severity: url.searchParams.getAll('severity'),
      status: url.searchParams.getAll('status'),
      source: url.searchParams.getAll('source'),
      supplier: url.searchParams.get('supplier') || '',
      startMonth: url.searchParams.get('startMonth') || '',
      endMonth: url.searchParams.get('endMonth') || ''
    };

    const response = mockApiResponses.getInsights(params);
    return HttpResponse.json(response);
  }),

  // Get insight evidence
  http.get('/api/insights/:id/evidence', ({ params }) => {
    const { id } = params;
    const insight = mockApiResponses.getMockInsightById(String(id));
    
    if (!insight) {
      return HttpResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      rawRows: insight.evidence.rawRows,
      charts: insight.evidence.charts,
      linkedFiles: insight.linkedFiles
    });
  }),

  // Update insight status
  http.patch('/api/insights/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    
    return HttpResponse.json({
      success: true,
      id,
      ...body
    });
  }),

  // Batch update insights
  http.post('/api/insights/batch-update', async ({ request }) => {
    const body = await request.json();
    const { insightIds, status } = body as any;
    
    return HttpResponse.json({
      success: true,
      updated: insightIds.length,
      status
    });
  }),

  // Toggle pin status
  http.post('/api/insights/toggle-pin', async ({ request }) => {
    const body = await request.json();
    const { insightIds, pinned } = body as any;
    
    return HttpResponse.json({
      success: true,
      updated: insightIds.length,
      pinned
    });
  }),

  // Download file
  http.get('/api/files/:id/download', ({ params }) => {
    const { id } = params;
    const blob = new Blob(['Mock file content'], { type: 'application/pdf' });
    
    return new HttpResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="file-${id}.pdf"`
      }
    });
  }),

  // Get suppliers
  http.get('/api/suppliers', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    let suppliers = [...(mockApiResponses.mockSuppliers || [])];
    
    if (search) {
      suppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return HttpResponse.json({ data: suppliers });
  }),

  // Findings API endpoints
  http.get('/api/findings', ({ request }) => {
    const { mockFindings } = require('./findings-mocks');
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 50;
    const viewMode = url.searchParams.get('viewMode') || 'rule';
    
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return HttpResponse.json({
      data: mockFindings.slice(start, end),
      total: mockFindings.length,
      page,
      pageSize,
      totalPages: Math.ceil(mockFindings.length / pageSize)
    });
  }),
  
  http.get('/api/rules', () => {
    const { mockRules } = require('./findings-mocks');
    return HttpResponse.json(mockRules);
  }),
  
  http.get('/api/clusters', () => {
    const { mockClusters } = require('./findings-mocks');
    return HttpResponse.json(mockClusters);
  })
];

export const server = setupServer(...handlers);