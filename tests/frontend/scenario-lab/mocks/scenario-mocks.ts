/**
 * Mock data and API for Scenario Lab testing
 */

export interface MockScenarioResult {
  id: string;
  timestamp: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  kpis?: Array<{
    name: string;
    current: number;
    scenario: number;
    unit: string;
    change?: number;
    changePercent?: number;
  }>;
  flags?: Array<{
    name: string;
    current: number;
    scenario: number;
    change: number;
  }>;
  heatmap?: {
    data: number[][];
    labels: {
      x: string[];
      y: string[];
    };
    title?: string;
    unit?: string;
  };
}

export const mockScenarioAPI = () => {
  let runCount = 0;
  const results: Map<string, MockScenarioResult> = new Map();

  return {
    runScenario: jest.fn(async (params: any) => {
      runCount++;
      const resultId = `SCN-2024-03-${String(runCount).padStart(3, '0')}`;
      
      const result: MockScenarioResult = {
        id: resultId,
        timestamp: new Date().toISOString(),
        status: 'pending',
        progress: 0
      };

      results.set(resultId, result);

      // Simulate progressive loading
      setTimeout(() => {
        result.status = 'running';
        result.progress = 25;
      }, 100);

      setTimeout(() => {
        result.progress = 50;
        result.kpis = [
          { 
            name: 'Total kostnad', 
            current: 1500000, 
            scenario: 1725000, 
            unit: 'SEK',
            change: 225000,
            changePercent: 15
          },
          { 
            name: 'Återvinningsgrad', 
            current: 45, 
            scenario: 52, 
            unit: '%',
            change: 7,
            changePercent: 15.56
          },
          { 
            name: 'CO2-utsläpp', 
            current: 2500, 
            scenario: 2100, 
            unit: 'ton',
            change: -400,
            changePercent: -16
          }
        ];
      }, 200);

      setTimeout(() => {
        result.progress = 75;
        result.flags = [
          { name: 'Högrisk', current: 3, scenario: 5, change: 2 },
          { name: 'Mediumrisk', current: 8, scenario: 6, change: -2 },
          { name: 'Lågrisk', current: 12, scenario: 11, change: -1 }
        ];
      }, 300);

      setTimeout(() => {
        result.status = 'completed';
        result.progress = 100;
        result.heatmap = {
          data: [
            [0.2, 0.5, 0.8, 0.3],
            [0.7, 0.1, 0.4, 0.9],
            [0.3, 0.6, 0.2, 0.5]
          ],
          labels: {
            x: ['Jan', 'Feb', 'Mar', 'Apr'],
            y: ['Stockholm', 'Göteborg', 'Malmö']
          },
          title: 'Kostnadsförändring per region och månad',
          unit: '%'
        };
      }, 400);

      return resultId;
    }),

    getResult: jest.fn((resultId: string) => {
      return results.get(resultId);
    }),

    cancelScenario: jest.fn(async (resultId: string) => {
      const result = results.get(resultId);
      if (result) {
        result.status = 'failed';
        result.progress = 0;
      }
      return true;
    }),

    searchInsights: jest.fn(async (query: string) => {
      // Mock insight search
      const allInsights = [
        { 
          id: 'INS-2024-03-001', 
          title: 'Ökad återvinningsgrad Q1', 
          severity: 'high',
          description: 'Återvinningsgraden har ökat med 15% under Q1',
          createdAt: '2024-03-01T10:00:00Z'
        },
        { 
          id: 'INS-2024-03-002', 
          title: 'Kostnadsöverskridande transport', 
          severity: 'medium',
          description: 'Transportkostnader överskrider budget med 8%',
          createdAt: '2024-03-02T14:30:00Z'
        },
        { 
          id: 'INS-2024-02-015', 
          title: 'Säsongsvariation februari', 
          severity: 'low',
          description: 'Normal säsongsvariation observerad i februari',
          createdAt: '2024-02-15T09:15:00Z'
        },
        { 
          id: 'INS-2024-02-008', 
          title: 'Optimerad rutt Stockholm', 
          severity: 'medium',
          description: 'Ny ruttoptimering kan spara 12% i bränslekostnader',
          createdAt: '2024-02-08T11:45:00Z'
        }
      ];

      const filtered = allInsights.filter(insight => 
        insight.id.toLowerCase().includes(query.toLowerCase()) ||
        insight.title.toLowerCase().includes(query.toLowerCase())
      );

      return filtered;
    }),

    saveSnapshot: jest.fn(async (snapshot: any) => {
      const snapshotId = `SNAP-${Date.now()}`;
      return {
        id: snapshotId,
        ...snapshot,
        savedAt: new Date().toISOString()
      };
    }),

    createInsight: jest.fn(async (insight: any) => {
      const insightId = `INS-2024-03-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
      return {
        id: insightId,
        ...insight,
        createdAt: new Date().toISOString()
      };
    }),

    getSuppliers: jest.fn(async () => {
      return [
        { 
          id: 'SUP-001', 
          name: 'Stockholms Avfallshantering AB', 
          region: 'Stockholm',
          volume: 'high',
          status: 'active'
        },
        { 
          id: 'SUP-002', 
          name: 'Göteborgs Återvinning', 
          region: 'Göteborg',
          volume: 'high',
          status: 'active'
        },
        { 
          id: 'SUP-003', 
          name: 'Malmö Miljöservice', 
          region: 'Malmö',
          volume: 'medium',
          status: 'active'
        },
        { 
          id: 'SUP-004', 
          name: 'Uppsala Kretslopp', 
          region: 'Uppsala',
          volume: 'medium',
          status: 'active'
        },
        { 
          id: 'SUP-005', 
          name: 'Västerås Återvinning', 
          region: 'Västerås',
          volume: 'low',
          status: 'active'
        }
      ];
    }),

    exportResults: jest.fn(async (resultId: string, format: 'pdf' | 'excel' | 'json') => {
      return {
        url: `/api/export/${resultId}.${format}`,
        filename: `scenario_${resultId}.${format}`,
        size: 1024 * 50 // 50KB
      };
    })
  };
};

export const generateMockHeatmapData = (rows: number = 4, cols: number = 6) => {
  const data: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      // Generate realistic variation patterns
      const baseValue = Math.sin(i * 0.5) * Math.cos(j * 0.3);
      const noise = (Math.random() - 0.5) * 0.2;
      row.push(Math.max(-1, Math.min(1, baseValue + noise)));
    }
    data.push(row);
  }

  return {
    data,
    labels: {
      x: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun'].slice(0, cols),
      y: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro'].slice(0, rows)
    }
  };
};

export const MockScenarioLabProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
    </>
  );
};

// Mock WebSocket for real-time updates
export class MockScenarioWebSocket {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connected = false;

  connect() {
    this.connected = true;
    setTimeout(() => {
      this.emit('connected', { status: 'connected' });
    }, 100);
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnected', { status: 'disconnected' });
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  simulateProgressUpdate(scenarioId: string, progress: number) {
    this.emit('progress', { scenarioId, progress });
  }

  simulateKPIUpdate(scenarioId: string, kpis: any[]) {
    this.emit('kpis', { scenarioId, kpis });
  }

  simulateError(scenarioId: string, error: string) {
    this.emit('error', { scenarioId, error });
  }
}

// Mock validation functions
export const validateScenarioParams = (params: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!params.suppliers || params.suppliers.length === 0) {
    errors.push('Välj minst en leverantör');
  }

  if (params.costAdjustment !== undefined) {
    if (params.costAdjustment < -50 || params.costAdjustment > 50) {
      errors.push('Kostnadsjustering måste vara mellan -50% och +50%');
    }
  }

  if (params.volumeProjection !== undefined) {
    if (params.volumeProjection < -30 || params.volumeProjection > 30) {
      errors.push('Volymprognos måste vara mellan -30% och +30%');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Mock Swedish number formatter
export const formatSwedishNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

export const formatSwedishCurrency = (value: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const formatSwedishPercent = (value: number): string => {
  const formatted = formatSwedishNumber(Math.abs(value), 1);
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatted}%`;
};