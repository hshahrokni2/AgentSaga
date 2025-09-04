import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { mockApiResponses } from './insights-mocks';

export const handlers = [
  // Get insights list
  rest.get('/api/insights', (req, res, ctx) => {
    const params = {
      page: Number(req.url.searchParams.get('page')) || 1,
      pageSize: Number(req.url.searchParams.get('pageSize')) || 10,
      severity: req.url.searchParams.getAll('severity'),
      status: req.url.searchParams.getAll('status'),
      source: req.url.searchParams.getAll('source'),
      supplier: req.url.searchParams.get('supplier'),
      startMonth: req.url.searchParams.get('startMonth'),
      endMonth: req.url.searchParams.get('endMonth')
    };

    const response = mockApiResponses.getInsights(params);
    return res(ctx.status(200), ctx.json(response));
  }),

  // Explain insight
  rest.post('/api/insights/:id/explain', async (req, res, ctx) => {
    const { id } = req.params;
    const explanation = await mockApiResponses.explainInsight(id as string);
    return res(ctx.status(200), ctx.json(explanation));
  }),

  // Merge insights
  rest.post('/api/insights/merge', async (req, res, ctx) => {
    const { insightIds } = await req.json();
    const result = await mockApiResponses.mergeInsights(insightIds);
    return res(ctx.status(200), ctx.json(result));
  }),

  // Batch update status
  rest.post('/api/insights/batch-update', async (req, res, ctx) => {
    const { insightIds, status } = await req.json();
    const result = await mockApiResponses.batchUpdateStatus(insightIds, status);
    return res(ctx.status(200), ctx.json(result));
  }),

  // Toggle pin
  rest.post('/api/insights/toggle-pin', async (req, res, ctx) => {
    const { insightIds, pinned } = await req.json();
    const result = await mockApiResponses.togglePin(insightIds, pinned);
    return res(ctx.status(200), ctx.json(result));
  }),

  // Update single insight
  rest.patch('/api/insights/:id', async (req, res, ctx) => {
    const { id } = req.params;
    const updates = await req.json();
    return res(ctx.status(200), ctx.json({ success: true, id, ...updates }));
  }),

  // Get insight evidence
  rest.get('/api/insights/:id/evidence', (req, res, ctx) => {
    const { id } = req.params;
    const insight = mockApiResponses.getInsights().data.find((i: any) => i.id === id);
    
    if (!insight) {
      return res(ctx.status(404), ctx.json({ error: 'Insight not found' }));
    }

    return res(ctx.status(200), ctx.json(insight.evidence));
  }),

  // Download file
  rest.get('/api/files/:id/download', (req, res, ctx) => {
    const { id } = req.params;
    // Return mock file blob
    const blob = new Blob(['Mock file content'], { type: 'application/octet-stream' });
    return res(
      ctx.status(200),
      ctx.set('Content-Disposition', `attachment; filename="file-${id}.pdf"`),
      ctx.body(blob)
    );
  }),

  // Get suppliers
  rest.get('/api/suppliers', (req, res, ctx) => {
    const search = req.url.searchParams.get('search');
    let suppliers = [...mockApiResponses.mockSuppliers || []];
    
    if (search) {
      suppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return res(ctx.status(200), ctx.json({ data: suppliers }));
  })
];

export const server = setupServer(...handlers);