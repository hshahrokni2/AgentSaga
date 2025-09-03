/**
 * Mock implementations for Archon API and services
 * Used for testing Granskad workflow components
 */
import React from 'react'

export interface MockArchonAPI {
  createAuditLog: jest.Mock;
  createSecurityLog: jest.Mock;
  createSnapshot: jest.Mock;
  getWorkflowState: jest.Mock;
  saveWorkflowState: jest.Mock;
  getClearanceStatus: jest.Mock;
  validateGreenStatus: jest.Mock;
  lockWorkflow: jest.Mock;
  unlockWorkflow: jest.Mock;
  sendNotification: jest.Mock;
}

export const mockArchonAPI = (): MockArchonAPI => {
  return {
    createAuditLog: jest.fn().mockResolvedValue({
      id: 'audit-' + Date.now(),
      success: true
    }),
    
    createSecurityLog: jest.fn().mockResolvedValue({
      id: 'security-' + Date.now(),
      success: true
    }),
    
    createSnapshot: jest.fn().mockResolvedValue({
      id: 'snapshot-' + Date.now(),
      hash: generateMockHash(),
      timestamp: new Date().toISOString(),
      success: true
    }),
    
    getWorkflowState: jest.fn().mockResolvedValue({
      status: 'Ogranskad',
      checklistProgress: 0,
      totalChecklistItems: 12,
      hasComment: false,
      greenStatus: false
    }),
    
    saveWorkflowState: jest.fn().mockResolvedValue({
      success: true,
      savedAt: new Date().toISOString()
    }),
    
    getClearanceStatus: jest.fn().mockResolvedValue({
      status: 'yellow',
      details: {
        missingData: [],
        anomalies: 1,
        unresolvedFindings: 0
      }
    }),
    
    validateGreenStatus: jest.fn().mockResolvedValue({
      isValid: false,
      reasons: ['Anomalier behöver lösas']
    }),
    
    lockWorkflow: jest.fn().mockResolvedValue({
      success: true,
      lockId: 'lock-' + Date.now(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    }),
    
    unlockWorkflow: jest.fn().mockResolvedValue({
      success: true
    }),
    
    sendNotification: jest.fn().mockResolvedValue({
      success: true,
      sentTo: [],
      timestamp: new Date().toISOString()
    })
  };
};

// Helper to generate mock SHA-256 hash
export const generateMockHash = (): string => {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * 16)];
  }
  return hash;
};

// Mock checklist data generator
export const generateMockChecklist = (categories: number = 3, itemsPerCategory: number = 4) => {
  const categoryNames = ['Datakvalitet', 'Regelefterlevnad', 'Validering', 'Dokumentation', 'Säkerhet'];
  const itemTemplates = [
    'Kontrollera {field}',
    'Validera {field}',
    'Granska {field}',
    'Verifiera {field}',
    'Bekräfta {field}'
  ];
  
  const fields = [
    'månadsdata', 'leverantörsuppgifter', 'avfallsmängder',
    'transportdokumentation', 'miljötillstånd', 'personnummer',
    'fakturauppgifter', 'kvalitetsdata'
  ];
  
  const result = [];
  
  for (let c = 0; c < categories; c++) {
    const items = [];
    for (let i = 0; i < itemsPerCategory; i++) {
      const template = itemTemplates[Math.floor(Math.random() * itemTemplates.length)];
      const field = fields[Math.floor(Math.random() * fields.length)];
      
      items.push({
        id: `item-${c}-${i}`,
        label: template.replace('{field}', field),
        required: Math.random() > 0.3, // 70% required
        completed: false
      });
    }
    
    result.push({
      id: `category-${c}`,
      name: categoryNames[c] || `Kategori ${c + 1}`,
      items
    });
  }
  
  return result;
};

// Mock findings generator
export const generateMockFindings = (count: number = 5) => {
  const types = ['Anomali', 'Avvikelse', 'Varning', 'Information'];
  const severities = ['high', 'medium', 'low'];
  const statuses = ['new', 'acknowledged', 'resolved', 'ignored'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `finding-${i}`,
    type: types[Math.floor(Math.random() * types.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    title: `${types[Math.floor(Math.random() * types.length)]} i ${['januari', 'februari', 'mars'][Math.floor(Math.random() * 3)]} data`,
    description: `Upptäckt avvikelse i data från leverantör ${Math.floor(Math.random() * 10) + 1}`,
    detectedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    confidence: 0.5 + Math.random() * 0.5
  }));
};

// Mock insights generator
export const generateMockInsights = (count: number = 3) => {
  const categories = ['Trend', 'Mönster', 'Prognos', 'Rekommendation'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `insight-${i}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    description: `AI-genererad insikt om ${['återvinningsgrad', 'avfallsmängder', 'kostnadseffektivitet'][Math.floor(Math.random() * 3)]}`,
    confidence: 0.6 + Math.random() * 0.4,
    impact: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
    suggestedAction: 'Granska närmare data för perioden',
    createdAt: new Date().toISOString()
  }));
};

// Mock comment generator
export const generateMockComment = (options: Partial<{
  markdown: boolean;
  author: string;
  timestamp: string;
}> = {}) => {
  const templates = [
    'Granskning genomförd utan anmärkningar.',
    'Noterade avvikelser har åtgärdats.',
    '## Sammanfattning\n\nAlla kontroller godkända.\n\n**Status:** Godkänd',
    'Behöver ytterligare granskning av leverantör X data.',
    '### Observationer\n\n- Punkt 1\n- Punkt 2\n- Punkt 3'
  ];
  
  return {
    id: 'comment-' + Date.now(),
    content: templates[Math.floor(Math.random() * templates.length)],
    markdown: options.markdown ?? Math.random() > 0.5,
    author: options.author ?? 'Test Användare',
    userId: 'user-' + Math.floor(Math.random() * 1000),
    createdAt: options.timestamp ?? new Date().toISOString(),
    edited: false
  };
};

// Mock audit entry generator
export const generateMockAuditEntry = (action: string, userId?: string) => {
  return {
    id: 'audit-' + Date.now() + '-' + Math.random(),
    timestamp: new Date().toISOString(),
    action,
    userId: userId ?? 'user-' + Math.floor(Math.random() * 1000),
    userName: ['Anna Andersson', 'Bengt Bengtsson', 'Cecilia Carlsson'][Math.floor(Math.random() * 3)],
    details: {
      monthId: '2024-' + String(Math.floor(Math.random() * 12) + 1).padStart(2, '0'),
      supplierId: 'supplier-' + Math.floor(Math.random() * 100),
      metadata: {
        ip: '192.168.1.' + Math.floor(Math.random() * 255),
        userAgent: 'Mozilla/5.0 Test Browser',
        sessionId: 'session-' + Date.now()
      }
    },
    hash: generateMockHash(),
    previousHash: generateMockHash()
  };
};

// Mock clearance status generator
export const generateMockClearanceStatus = (status?: 'green' | 'yellow' | 'red') => {
  const selectedStatus = status ?? ['green', 'yellow', 'red'][Math.floor(Math.random() * 3)] as any;
  
  const details: any = {
    lastChecked: new Date().toISOString(),
    totalSuppliers: 25,
    completeSuppliers: selectedStatus === 'green' ? 25 : selectedStatus === 'yellow' ? 20 : 15
  };
  
  if (selectedStatus !== 'green') {
    details.issues = [];
    
    if (selectedStatus === 'yellow' || selectedStatus === 'red') {
      details.issues.push({
        type: 'missing_data',
        suppliers: ['Leverantör A', 'Leverantör B'],
        severity: selectedStatus === 'red' ? 'high' : 'medium'
      });
    }
    
    if (selectedStatus === 'red') {
      details.issues.push({
        type: 'anomalies',
        count: 5,
        severity: 'high'
      });
    }
  }
  
  return {
    status: selectedStatus,
    details,
    canOverride: selectedStatus === 'yellow',
    requiredRole: selectedStatus === 'yellow' ? 'supervisor' : 'admin'
  };
};

// Mock state machine helper
export class MockStateMachine {
  private currentState: string;
  private history: Array<{ from: string; to: string; timestamp: string }> = [];
  
  constructor(initialState: string = 'Ogranskad') {
    this.currentState = initialState;
  }
  
  transition(to: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'Ogranskad': ['Pågående granskning'],
      'Pågående granskning': ['Helt granskad'],
      'Helt granskad': []
    };
    
    if (!validTransitions[this.currentState]?.includes(to)) {
      throw new Error(`Ogiltig övergång: ${this.currentState} → ${to}`);
    }
    
    this.history.push({
      from: this.currentState,
      to,
      timestamp: new Date().toISOString()
    });
    
    this.currentState = to;
    return true;
  }
  
  getState(): string {
    return this.currentState;
  }
  
  getHistory() {
    return [...this.history];
  }
  
  reset() {
    this.currentState = 'Ogranskad';
    this.history = [];
  }
}

// Export mock providers for testing
export const MockProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};