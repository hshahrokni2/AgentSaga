// Mock data for findings tests
import type {
  FindingData,
  FindingSeverity,
  FindingStatus,
  ViewMode,
  RuleData,
  ClusterData
} from '@/types/findings'

export const mockFindings: FindingData[] = [
  {
    id: 'FND-001',
    ruleId: 'RULE-001',
    ruleName: {
      sv: 'Saknad fakturadokumentation',
      en: 'Missing Invoice Documentation'
    },
    clusterId: 'CLUSTER-001',
    clusterName: 'Documentation Issues',
    severity: 'high',
    status: 'pending',
    confidence: 0.95,
    description: 'Invoice documentation is missing for transaction #12345',
    evidence: {
      transactionId: '12345',
      amount: 15000,
      date: '2024-01-15',
      supplier: 'Test Supplier AB'
    },
    metadata: {
      createdAt: '2024-01-20T10:00:00Z',
      updatedAt: '2024-01-20T10:00:00Z',
      source: 'automated_scan',
      tags: ['documentation', 'invoice']
    }
  },
  {
    id: 'FND-002',
    ruleId: 'RULE-002',
    ruleName: {
      sv: 'Dubblettbetalning upptäckt',
      en: 'Duplicate Payment Detection'
    },
    clusterId: 'CLUSTER-002',
    clusterName: 'Payment Anomalies',
    severity: 'critical',
    status: 'reviewing',
    confidence: 0.89,
    description: 'Potential duplicate payment detected',
    evidence: {
      transactionIds: ['12346', '12347'],
      totalAmount: 30000,
      dates: ['2024-01-16', '2024-01-17'],
      supplier: 'Another Supplier AB'
    },
    metadata: {
      createdAt: '2024-01-21T10:00:00Z',
      updatedAt: '2024-01-21T14:00:00Z',
      source: 'automated_scan',
      tags: ['payment', 'duplicate']
    }
  },
  {
    id: 'FND-003',
    ruleId: 'RULE-003',
    ruleName: {
      sv: 'Tröskelöverträdelse',
      en: 'Threshold Breach'
    },
    clusterId: 'CLUSTER-003',
    clusterName: 'Threshold Violations',
    severity: 'medium',
    status: 'pending',
    confidence: 0.75,
    description: 'Payment exceeds authorized threshold',
    evidence: {
      transactionId: '12348',
      amount: 50000,
      threshold: 40000,
      date: '2024-01-18',
      supplier: 'Big Supplier AB'
    },
    metadata: {
      createdAt: '2024-01-22T10:00:00Z',
      updatedAt: '2024-01-22T10:00:00Z',
      source: 'rule_engine',
      tags: ['threshold', 'authorization']
    }
  },
  {
    id: 'FND-004',
    ruleId: 'RULE-001',
    ruleName: {
      sv: 'Saknad fakturadokumentation',
      en: 'Missing Invoice Documentation'
    },
    clusterId: 'CLUSTER-001',
    clusterName: 'Documentation Issues',
    severity: 'low',
    status: 'resolved',
    confidence: 0.65,
    description: 'Receipt missing for small transaction',
    evidence: {
      transactionId: '12349',
      amount: 500,
      date: '2024-01-19',
      supplier: 'Small Supplier AB'
    },
    metadata: {
      createdAt: '2024-01-23T10:00:00Z',
      updatedAt: '2024-01-24T10:00:00Z',
      source: 'automated_scan',
      tags: ['documentation', 'receipt']
    }
  },
  {
    id: 'FND-005',
    ruleId: 'RULE-004',
    ruleName: {
      sv: 'Avtalsefterlevnad',
      en: 'Contract Compliance'
    },
    clusterId: 'CLUSTER-004',
    clusterName: 'Contract Issues',
    severity: 'high',
    status: 'pending',
    confidence: 0.92,
    description: 'Service delivered outside contract terms',
    evidence: {
      contractId: 'CONTRACT-123',
      transactionId: '12350',
      violation: 'Service date outside contract period',
      date: '2024-01-20',
      supplier: 'Contract Supplier AB'
    },
    metadata: {
      createdAt: '2024-01-25T10:00:00Z',
      updatedAt: '2024-01-25T10:00:00Z',
      source: 'contract_validation',
      tags: ['contract', 'compliance']
    }
  }
];

export const mockRules: RuleData[] = [
  {
    id: 'RULE-001',
    name: 'Missing Invoice Documentation',
    description: 'Validates that all transactions have proper invoice documentation',
    severity: 'high',
    category: 'documentation',
    findingsCount: 2,
    enabled: true
  },
  {
    id: 'RULE-002',
    name: 'Duplicate Payment Detection',
    description: 'Detects potential duplicate payments',
    severity: 'critical',
    category: 'payment',
    findingsCount: 1,
    enabled: true
  },
  {
    id: 'RULE-003',
    name: 'Threshold Breach',
    description: 'Identifies payments exceeding authorized thresholds',
    severity: 'medium',
    category: 'authorization',
    findingsCount: 1,
    enabled: true
  },
  {
    id: 'RULE-004',
    name: 'Contract Compliance',
    description: 'Validates transactions against contract terms',
    severity: 'high',
    category: 'contract',
    findingsCount: 1,
    enabled: true
  }
];

export const mockClusters: ClusterData[] = [
  {
    id: 'CLUSTER-001',
    name: 'Documentation Issues',
    description: 'Findings related to missing or incomplete documentation',
    severity: 'high',
    findingsCount: 2,
    commonPatterns: ['Missing invoices', 'Incomplete receipts']
  },
  {
    id: 'CLUSTER-002',
    name: 'Payment Anomalies',
    description: 'Unusual payment patterns detected',
    severity: 'critical',
    findingsCount: 1,
    commonPatterns: ['Duplicate transactions', 'Unusual amounts']
  },
  {
    id: 'CLUSTER-003',
    name: 'Threshold Violations',
    description: 'Transactions exceeding defined limits',
    severity: 'medium',
    findingsCount: 1,
    commonPatterns: ['Amount exceeds limit', 'Frequency violations']
  },
  {
    id: 'CLUSTER-004',
    name: 'Contract Issues',
    description: 'Violations of contractual terms',
    severity: 'high',
    findingsCount: 1,
    commonPatterns: ['Outside contract period', 'Unauthorized services']
  }
];

// Helper function to filter findings
export function filterFindings(
  findings: FindingData[],
  filters: {
    severity?: FindingSeverity[];
    status?: FindingStatus[];
    ruleId?: string[];
    clusterId?: string[];
  }
) {
  return findings.filter(finding => {
    if (filters.severity?.length && !filters.severity.includes(finding.severity)) {
      return false;
    }
    if (filters.status?.length && !filters.status.includes(finding.status)) {
      return false;
    }
    if (filters.ruleId?.length && !filters.ruleId.includes(finding.ruleId)) {
      return false;
    }
    if (filters.clusterId?.length && !filters.clusterId.includes(finding.clusterId)) {
      return false;
    }
    return true;
  });
}

// Helper to generate more findings for pagination testing
export function generateMockFindings(count: number): FindingData[] {
  const findings: FindingData[] = [];
  const severities: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];
  const statuses: FindingStatus[] = ['pending', 'reviewing', 'resolved', 'dismissed'];
  
  for (let i = 0; i < count; i++) {
    findings.push({
      id: `FND-${String(i + 1).padStart(3, '0')}`,
      ruleId: `RULE-${String((i % 4) + 1).padStart(3, '0')}`,
      ruleName: {
        sv: `${mockRules[i % 4].name} (SV)`,
        en: mockRules[i % 4].name
      },
      clusterId: `CLUSTER-${String((i % 4) + 1).padStart(3, '0')}`,
      clusterName: mockClusters[i % 4].name,
      severity: severities[i % 4],
      status: statuses[i % 4],
      confidence: 0.5 + (Math.random() * 0.5),
      description: `Test finding ${i + 1}`,
      evidence: {
        transactionId: String(10000 + i),
        amount: Math.floor(Math.random() * 100000),
        date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
        supplier: `Supplier ${i + 1} AB`
      },
      metadata: {
        createdAt: new Date(2024, 0, (i % 28) + 1).toISOString(),
        updatedAt: new Date(2024, 0, (i % 28) + 1).toISOString(),
        source: i % 2 === 0 ? 'automated_scan' : 'manual_review',
        tags: ['test', `finding-${i}`]
      }
    });
  }
  
  return findings;
}