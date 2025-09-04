import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';

// Mock insight data
export const mockInsights = Array.from({ length: 50 }, (_, i) => ({
  id: `INS-2024-03-${String(i + 1).padStart(3, '0')}`,
  title: {
    sv: `Insikt ${i + 1}: ${['Avvikande faktureringsmönster', 'Hög avfallskostnad', 'Saknad data', 'Ovanlig volymökning', 'Felaktig kategorisering'][i % 5]}`,
    en: `Insight ${i + 1}: ${['Anomalous billing pattern', 'High waste cost', 'Missing data', 'Unusual volume increase', 'Incorrect categorization'][i % 5]}`
  },
  description: {
    sv: `Detaljerad beskrivning av insikt ${i + 1}. Denna insikt identifierades genom automatisk analys.`,
    en: `Detailed description of insight ${i + 1}. This insight was identified through automatic analysis.`
  },
  severity: ['critical', 'high', 'medium', 'low', 'info'][i % 5] as InsightSeverity,
  status: ['new', 'reviewing', 'validated', 'resolved', 'false_positive'][i % 5] as InsightStatus,
  source: ['rule', 'ml', 'human', 'scenario', 'rule'][i % 5] as InsightSource,
  supplierId: [`supplier-${(i % 10) + 1}`],
  supplierName: ['Ragn-Sells', 'Stena Recycling', 'SUEZ', 'PreZero', 'Renewi', 'FTI', 'TMR', 'SRV', 'RenoNorden', 'IL Recycling'][i % 10],
  month: `2024-${String((i % 3) + 1).padStart(2, '0')}`,
  confidence: 0.5 + (i % 50) / 100,
  isPinned: i < 3,
  createdAt: new Date(2024, 2, i + 1).toISOString(),
  updatedAt: new Date(2024, 2, i + 1).toISOString(),
  linkedRows: 10 + (i % 20),
  linkedFiles: [
    { id: `file-1-${i}`, name: 'invoice_2024_03.pdf', size: 1024000, type: 'application/pdf' },
    { id: `file-2-${i}`, name: 'waste_report.xlsx', size: 512000, type: 'application/vnd.ms-excel' },
    { id: `file-3-${i}`, name: 'anomaly_evidence.png', size: 256000, type: 'image/png' }
  ],
  evidence: {
    rawRows: Array.from({ length: 10 }, (_, j) => ({
      id: `row-${i}-${j}`,
      date: `2024-03-${String(j + 1).padStart(2, '0')}`,
      supplier: ['Ragn-Sells', 'Stena Recycling'][j % 2],
      category: ['Household', 'Industrial', 'Recyclable'][j % 3],
      amount: 1000 + j * 100,
      unit: 'kg',
      flagged: j % 3 === 0
    })),
    charts: {
      trend: { type: 'line', data: Array.from({ length: 12 }, (_, m) => ({ month: m + 1, value: 100 + m * 10 })) },
      distribution: { type: 'bar', data: [{ category: 'A', value: 30 }, { category: 'B', value: 50 }, { category: 'C', value: 20 }] },
      correlation: { type: 'scatter', data: Array.from({ length: 20 }, (_, p) => ({ x: p, y: p * 2 + Math.random() * 10 })) }
    }
  }
}));

// Mock suppliers
export const mockSuppliers = [
  { id: 'supplier-1', name: 'Ragn-Sells', region: 'Stockholm' },
  { id: 'supplier-2', name: 'Stena Recycling', region: 'Göteborg' },
  { id: 'supplier-3', name: 'SUEZ', region: 'Malmö' },
  { id: 'supplier-4', name: 'PreZero', region: 'Uppsala' },
  { id: 'supplier-5', name: 'Renewi', region: 'Västerås' },
  { id: 'supplier-6', name: 'FTI', region: 'Örebro' },
  { id: 'supplier-7', name: 'TMR', region: 'Linköping' },
  { id: 'supplier-8', name: 'SRV', region: 'Helsingborg' },
  { id: 'supplier-9', name: 'RenoNorden', region: 'Jönköping' },
  { id: 'supplier-10', name: 'IL Recycling', region: 'Umeå' }
];

// Type definitions
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type InsightStatus = 'new' | 'reviewing' | 'validated' | 'resolved' | 'false_positive';
export type InsightSource = 'rule' | 'ml' | 'human' | 'scenario';

export interface InsightData {
  id: string;
  title: { sv: string; en: string };
  description: { sv: string; en: string };
  severity: InsightSeverity;
  status: InsightStatus;
  source: InsightSource;
  supplierId: string[];
  supplierName: string;
  month: string;
  confidence: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  linkedRows: number;
  linkedFiles: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
  }>;
  evidence: {
    rawRows: Array<{
      id: string;
      date: string;
      supplier: string;
      category: string;
      amount: number;
      unit: string;
      flagged: boolean;
    }>;
    charts: {
      trend: any;
      distribution: any;
      correlation: any;
    };
  };
}

// Mock WebSocket context
interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string, callback: (data: any) => void) => void;
  send: (event: string, data: any) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  subscribe: () => {},
  unsubscribe: () => {},
  send: () => {}
});

export const MockWebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [subscribers, setSubscribers] = useState<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    // Listen for custom WebSocket events
    const handleMessage = (event: CustomEvent) => {
      const { type, data } = event.detail;
      const callbacks = subscribers.get(type);
      if (callbacks) {
        callbacks.forEach(callback => callback(data));
      }
    };

    window.addEventListener('ws-message', handleMessage as EventListener);

    return () => {
      window.removeEventListener('ws-message', handleMessage as EventListener);
    };
  }, [subscribers]);

  const subscribe = (event: string, callback: (data: any) => void) => {
    setSubscribers(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(event)) {
        newMap.set(event, new Set());
      }
      newMap.get(event)!.add(callback);
      return newMap;
    });
  };

  const unsubscribe = (event: string, callback: (data: any) => void) => {
    setSubscribers(prev => {
      const newMap = new Map(prev);
      const callbacks = newMap.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          newMap.delete(event);
        }
      }
      return newMap;
    });
  };

  const send = (event: string, data: any) => {
    // Mock send - could trigger server responses
    console.log('WebSocket send:', event, data);
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, unsubscribe, send }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);

// Mock API responses
export const mockApiResponses = {
  getInsights: (params: any = {}) => {
    const { page = 1, pageSize = 10, severity, status, source, supplier, startMonth, endMonth } = params;
    
    let filtered = [...mockInsights];

    // Apply filters
    if (severity) {
      const severities = Array.isArray(severity) ? severity : [severity];
      filtered = filtered.filter(i => severities.includes(i.severity));
    }
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      filtered = filtered.filter(i => statuses.includes(i.status));
    }
    if (source) {
      const sources = Array.isArray(source) ? source : [source];
      filtered = filtered.filter(i => sources.includes(i.source));
    }
    if (supplier) {
      filtered = filtered.filter(i => 
        i.supplierName.toLowerCase().includes(supplier.toLowerCase())
      );
    }
    if (startMonth && endMonth) {
      filtered = filtered.filter(i => i.month >= startMonth && i.month <= endMonth);
    }

    // Pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return {
      data: paginated,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize)
    };
  },

  explainInsight: async (insightId: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      explanation: {
        sv: `Denna insikt (${insightId}) indikerar en avvikelse i normal datamönster. Baserat på historisk data och tröskelvärden har systemet identifierat detta som potentiellt problem som kräver granskning.`,
        en: `This insight (${insightId}) indicates a deviation from normal data patterns. Based on historical data and thresholds, the system has identified this as a potential issue requiring review.`
      },
      suggestedActions: {
        sv: ['Granska underliggande data', 'Kontakta leverantör', 'Skapa uppföljningsscenario'],
        en: ['Review underlying data', 'Contact supplier', 'Create follow-up scenario']
      },
      confidence: 0.85
    };
  },

  mergeInsights: async (insightIds: string[]) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      mergedInsight: {
        id: `INS-2024-03-${String(mockInsights.length + 1).padStart(3, '0')}`,
        title: {
          sv: `Sammanslagna insikter (${insightIds.length} st)`,
          en: `Merged insights (${insightIds.length} items)`
        },
        sourceInsights: insightIds
      }
    };
  },

  batchUpdateStatus: async (insightIds: string[], status: InsightStatus) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      updated: insightIds.length,
      status
    };
  },

  togglePin: async (insightIds: string[], pinned: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      success: true,
      updated: insightIds.length,
      pinned
    };
  }
};

// Utility functions for testing
export const waitForTableToLoad = () => {
  return new Promise(resolve => {
    const checkInterval = setInterval(() => {
      const rows = document.querySelectorAll('[role="row"]');
      if (rows.length > 1) { // More than just header row
        clearInterval(checkInterval);
        resolve(true);
      }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(false);
    }, 5000);
  });
};

export const getMockInsightById = (id: string) => {
  return mockInsights.find(i => i.id === id);
};

export const generateMockWebSocketMessage = (type: string, data: any) => {
  return new CustomEvent('ws-message', { detail: { type, data } });
};