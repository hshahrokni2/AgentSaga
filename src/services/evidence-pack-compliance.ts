/**
 * Evidence Pack Compliance System
 * EU/EES regulatory compliance validation for Swedish waste management
 * data handling, GDPR compliance, and cross-border data controls.
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFile } from 'fs/promises';
import { generateHumanFriendlyId, validatePersonnummer, maskPersonnummer } from '../../lib/utils';
import { EvidencePackManifest } from './evidence-pack-export';
import { AuditLogger } from './audit-logger';

export interface ComplianceCheck {
  id: string;
  type: 'data_residency' | 'encryption' | 'gdpr' | 'retention' | 'audit' | 'cross_border';
  status: 'passed' | 'failed' | 'warning';
  description: string;
  details: string;
  recommendation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  regulatoryReference: string;
}

export interface GDPRAssessment {
  dataSubjectRights: {
    rightOfAccess: boolean;
    rightOfRectification: boolean;
    rightOfErasure: boolean;
    rightOfPortability: boolean;
    rightToRestrict: boolean;
    rightToObject: boolean;
  };
  lawfulBasis: string[];
  dataMinimization: boolean;
  purposeLimitation: boolean;
  accuracyPrinciple: boolean;
  retentionCompliance: boolean;
  securityMeasures: string[];
  dpaNotification: boolean;
  privacyByDesign: boolean;
}

export interface EESCompliance {
  biometricDataHandling: boolean;
  crossBorderTransfer: boolean;
  interoperabilityStandards: string[];
  memberStateCoordination: boolean;
  dataSharing: {
    authorizedAgencies: string[];
    purposes: string[];
    retentionPeriods: number[];
  };
  qualityStandards: {
    accuracy: number;
    completeness: number;
    consistency: number;
  };
}

export interface DataResidencyValidation {
  currentRegion: string;
  allowedRegions: string[];
  dataLocation: {
    primary: string;
    backups: string[];
    replicas: string[];
  };
  crossBorderRestrictions: boolean;
  sovereigntyCompliance: boolean;
  jurisdictionalRisks: string[];
}

export interface EncryptionCompliance {
  atRest: {
    algorithm: string;
    keyLength: number;
    keyRotation: boolean;
    fipsCompliant: boolean;
  };
  inTransit: {
    protocol: string;
    version: string;
    cipherSuites: string[];
    certificateValidation: boolean;
  };
  keyManagement: {
    provider: string;
    hsmProtected: boolean;
    accessControls: string[];
    auditLogging: boolean;
  };
}

export interface PIIDetectionResult {
  detected: boolean;
  types: Array<{
    type: 'personnummer' | 'email' | 'phone' | 'address' | 'name' | 'organization_number';
    count: number;
    confidence: number;
    samples: string[]; // Masked samples for audit
    locations: Array<{ file: string; line: number; column: number }>;
  }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export class EvidencePackComplianceValidator {
  private auditLogger: AuditLogger;
  private allowedRegions: string[];
  private encryptionStandards: any;

  constructor(
    auditLogger: AuditLogger,
    options: {
      allowedRegions?: string[];
      encryptionStandards?: any;
      enableStrictMode?: boolean;
    } = {}
  ) {
    this.auditLogger = auditLogger;
    this.allowedRegions = options.allowedRegions || [
      'eu-north-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3'
    ];
    this.encryptionStandards = options.encryptionStandards || {
      minKeyLength: 256,
      approvedAlgorithms: ['AES-256-GCM', 'AES-256-CBC'],
      tlsVersion: '1.3'
    };
  }

  async validateFullCompliance(
    manifest: EvidencePackManifest,
    options: {
      userId: string;
      strictMode?: boolean;
      includeRecommendations?: boolean;
    }
  ): Promise<{
    overallStatus: 'compliant' | 'non_compliant' | 'warning';
    checks: ComplianceCheck[];
    gdprAssessment: GDPRAssessment;
    eesCompliance: EESCompliance;
    summary: {
      passed: number;
      failed: number;
      warnings: number;
      critical: number;
    };
  }> {
    const startTime = new Date();
    const checks: ComplianceCheck[] = [];

    try {
      // Data Residency Check
      const residencyCheck = await this.validateDataResidency(manifest);
      checks.push(residencyCheck);

      // Encryption Compliance
      const encryptionCheck = await this.validateEncryption(manifest);
      checks.push(encryptionCheck);

      // GDPR Compliance
      const gdprChecks = await this.validateGDPR(manifest);
      checks.push(...gdprChecks.checks);

      // Retention Policy Compliance
      const retentionCheck = await this.validateRetentionPolicy(manifest);
      checks.push(retentionCheck);

      // Audit Trail Compliance
      const auditCheck = await this.validateAuditTrail(manifest);
      checks.push(auditCheck);

      // Cross-Border Transfer Validation
      const crossBorderCheck = await this.validateCrossBorderTransfer(manifest);
      checks.push(crossBorderCheck);

      // EES Compliance Assessment
      const eesCompliance = await this.assessEESCompliance(manifest);

      // Calculate summary
      const summary = this.calculateComplianceSummary(checks);
      const overallStatus = this.determineOverallStatus(checks, options.strictMode);

      // Log compliance validation
      await this.auditLogger.log({
        id: generateHumanFriendlyId('COMP', Date.now()),
        packId: manifest.id,
        timestamp: new Date(),
        userId: options.userId,
        action: 'compliance_validation',
        status: overallStatus === 'compliant' ? 'success' : 'failure',
        details: `Compliance validation completed: ${summary.passed}/${checks.length} checks passed`,
        metadata: {
          duration: Date.now() - startTime.getTime(),
          overallStatus,
          summary,
          strictMode: options.strictMode
        }
      });

      return {
        overallStatus,
        checks,
        gdprAssessment: gdprChecks.assessment,
        eesCompliance,
        summary
      };

    } catch (error) {
      await this.auditLogger.log({
        id: generateHumanFriendlyId('COMP', Date.now()),
        packId: manifest.id,
        timestamp: new Date(),
        userId: options.userId,
        action: 'compliance_validation',
        status: 'failure',
        details: `Compliance validation failed: ${error.message}`,
        metadata: { error: error.toString() }
      });

      throw error;
    }
  }

  async detectPIIInArtifacts(
    manifest: EvidencePackManifest
  ): Promise<PIIDetectionResult> {
    const detectionResult: PIIDetectionResult = {
      detected: false,
      types: [],
      riskLevel: 'low',
      recommendations: []
    };

    try {
      for (const artifact of manifest.artifacts) {
        if (artifact.type === 'csv') {
          const content = await readFile(artifact.path, 'utf8');
          const piiFound = await this.scanContentForPII(content, artifact.filename);
          
          if (piiFound.length > 0) {
            detectionResult.detected = true;
            detectionResult.types.push(...piiFound);
          }
        }
      }

      // Determine risk level
      detectionResult.riskLevel = this.calculatePIIRisk(detectionResult.types);

      // Generate recommendations
      detectionResult.recommendations = this.generatePIIRecommendations(detectionResult.types);

      return detectionResult;

    } catch (error) {
      throw new Error(`PII detection failed: ${error.message}`);
    }
  }

  async validateDataResidency(manifest: EvidencePackManifest): Promise<ComplianceCheck> {
    const region = manifest.compliance.dataResidency.region;
    
    if (!this.allowedRegions.includes(region)) {
      return {
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'data_residency',
        status: 'failed',
        description: 'Data Residency Validation',
        details: `Data stored in unauthorized region: ${region}`,
        recommendation: `Move data to EU region: ${this.allowedRegions.join(', ')}`,
        severity: 'critical',
        regulatoryReference: 'GDPR Art. 44-49, EES Regulation (EU) 2017/2226'
      };
    }

    return {
      id: generateHumanFriendlyId('CHK', Date.now()),
      type: 'data_residency',
      status: 'passed',
      description: 'Data Residency Validation',
      details: `Data properly stored in EU region: ${region}`,
      severity: 'low',
      regulatoryReference: 'GDPR Art. 44-49'
    };
  }

  async validateEncryption(manifest: EvidencePackManifest): Promise<ComplianceCheck> {
    const encryption = manifest.compliance.encryption;
    
    if (!this.encryptionStandards.approvedAlgorithms.includes(encryption.algorithm)) {
      return {
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'encryption',
        status: 'failed',
        description: 'Encryption Standards Validation',
        details: `Unapproved encryption algorithm: ${encryption.algorithm}`,
        recommendation: `Use approved algorithm: ${this.encryptionStandards.approvedAlgorithms.join(', ')}`,
        severity: 'high',
        regulatoryReference: 'GDPR Art. 32, ISO 27001'
      };
    }

    return {
      id: generateHumanFriendlyId('CHK', Date.now()),
      type: 'encryption',
      status: 'passed',
      description: 'Encryption Standards Validation',
      details: `Approved encryption algorithm in use: ${encryption.algorithm}`,
      severity: 'low',
      regulatoryReference: 'GDPR Art. 32'
    };
  }

  async validateGDPR(manifest: EvidencePackManifest): Promise<{
    checks: ComplianceCheck[];
    assessment: GDPRAssessment;
  }> {
    const checks: ComplianceCheck[] = [];
    
    // Retention Period Check
    if (manifest.compliance.retention.years < 5) {
      checks.push({
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'gdpr',
        status: 'failed',
        description: 'GDPR Retention Period',
        details: 'Retention period below legal minimum for waste management data',
        recommendation: 'Set retention period to minimum 5 years',
        severity: 'high',
        regulatoryReference: 'Swedish Waste Management Act, GDPR Art. 5(1)(e)'
      });
    } else {
      checks.push({
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'gdpr',
        status: 'passed',
        description: 'GDPR Retention Period',
        details: `Retention period compliant: ${manifest.compliance.retention.years} years`,
        severity: 'low',
        regulatoryReference: 'GDPR Art. 5(1)(e)'
      });
    }

    // PII Detection
    const piiResult = await this.detectPIIInArtifacts(manifest);
    if (piiResult.detected && piiResult.riskLevel === 'critical') {
      checks.push({
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'gdpr',
        status: 'failed',
        description: 'Personal Data Protection',
        details: 'Critical level PII detected without proper safeguards',
        recommendation: 'Implement data anonymization or explicit consent mechanisms',
        severity: 'critical',
        regulatoryReference: 'GDPR Art. 6, Art. 9'
      });
    }

    const assessment: GDPRAssessment = {
      dataSubjectRights: {
        rightOfAccess: true,
        rightOfRectification: true,
        rightOfErasure: manifest.compliance.retention.policy !== 'never',
        rightOfPortability: true,
        rightToRestrict: true,
        rightToObject: false // Waste management is public interest
      },
      lawfulBasis: ['public_task', 'legitimate_interest'],
      dataMinimization: piiResult.riskLevel !== 'critical',
      purposeLimitation: true,
      accuracyPrinciple: true,
      retentionCompliance: manifest.compliance.retention.years >= 5,
      securityMeasures: ['encryption', 'access_controls', 'audit_logging'],
      dpaNotification: false, // Would be determined by actual processing
      privacyByDesign: true
    };

    return { checks, assessment };
  }

  async validateRetentionPolicy(manifest: EvidencePackManifest): Promise<ComplianceCheck> {
    const retention = manifest.compliance.retention;
    const wasteManagementMinimum = 5; // years

    if (retention.years < wasteManagementMinimum) {
      return {
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'retention',
        status: 'failed',
        description: 'Retention Policy Compliance',
        details: `Retention period ${retention.years} years below minimum ${wasteManagementMinimum} years`,
        recommendation: `Increase retention period to ${wasteManagementMinimum} years`,
        severity: 'high',
        regulatoryReference: 'Swedish Environmental Code, Waste Management Act'
      };
    }

    return {
      id: generateHumanFriendlyId('CHK', Date.now()),
      type: 'retention',
      status: 'passed',
      description: 'Retention Policy Compliance',
      details: `Retention period compliant: ${retention.years} years`,
      severity: 'low',
      regulatoryReference: 'Swedish Environmental Code'
    };
  }

  async validateAuditTrail(manifest: EvidencePackManifest): Promise<ComplianceCheck> {
    const auditTrail = manifest.auditTrail;
    
    if (!auditTrail.created.timestamp || !auditTrail.created.userId) {
      return {
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'audit',
        status: 'failed',
        description: 'Audit Trail Completeness',
        details: 'Incomplete audit trail information',
        recommendation: 'Ensure all operations are logged with user and timestamp',
        severity: 'medium',
        regulatoryReference: 'GDPR Art. 30, ISO 27001'
      };
    }

    return {
      id: generateHumanFriendlyId('CHK', Date.now()),
      type: 'audit',
      status: 'passed',
      description: 'Audit Trail Completeness',
      details: 'Complete audit trail present',
      severity: 'low',
      regulatoryReference: 'GDPR Art. 30'
    };
  }

  async validateCrossBorderTransfer(manifest: EvidencePackManifest): Promise<ComplianceCheck> {
    const region = manifest.compliance.dataResidency.region;
    const isEURegion = region.startsWith('eu-');

    if (!isEURegion) {
      return {
        id: generateHumanFriendlyId('CHK', Date.now()),
        type: 'cross_border',
        status: 'failed',
        description: 'Cross-Border Transfer Validation',
        details: 'Data transfer outside EU without adequate safeguards',
        recommendation: 'Implement Standard Contractual Clauses or move to EU region',
        severity: 'critical',
        regulatoryReference: 'GDPR Art. 44-49'
      };
    }

    return {
      id: generateHumanFriendlyId('CHK', Date.now()),
      type: 'cross_border',
      status: 'passed',
      description: 'Cross-Border Transfer Validation',
      details: 'Data remains within EU jurisdiction',
      severity: 'low',
      regulatoryReference: 'GDPR Art. 44-49'
    };
  }

  async assessEESCompliance(manifest: EvidencePackManifest): Promise<EESCompliance> {
    return {
      biometricDataHandling: false, // No biometric data in waste management
      crossBorderTransfer: manifest.compliance.dataResidency.region.startsWith('eu-'),
      interoperabilityStandards: ['ISO 27001', 'ISO 14001'],
      memberStateCoordination: true,
      dataSharing: {
        authorizedAgencies: ['Swedish EPA', 'EU Commission'],
        purposes: ['environmental_monitoring', 'waste_tracking'],
        retentionPeriods: [5] // years
      },
      qualityStandards: {
        accuracy: 95,
        completeness: 98,
        consistency: 92
      }
    };
  }

  private async scanContentForPII(content: string, filename: string): Promise<Array<{
    type: 'personnummer' | 'email' | 'phone' | 'address' | 'name' | 'organization_number';
    count: number;
    confidence: number;
    samples: string[];
    locations: Array<{ file: string; line: number; column: number }>;
  }>> {
    const results: any[] = [];
    const lines = content.split('\n');

    // Swedish personnummer detection
    const personnummerPattern = /\b\d{6,8}[-\s]?\d{4}\b/g;
    let match;
    const personnummerMatches: string[] = [];
    const personnummerLocations: any[] = [];

    lines.forEach((line, lineIndex) => {
      let lineMatch;
      while ((lineMatch = personnummerPattern.exec(line)) !== null) {
        if (validatePersonnummer(lineMatch[0])) {
          personnummerMatches.push(maskPersonnummer(lineMatch[0]));
          personnummerLocations.push({
            file: filename,
            line: lineIndex + 1,
            column: lineMatch.index + 1
          });
        }
      }
    });

    if (personnummerMatches.length > 0) {
      results.push({
        type: 'personnummer',
        count: personnummerMatches.length,
        confidence: 0.95,
        samples: personnummerMatches.slice(0, 3),
        locations: personnummerLocations
      });
    }

    // Email detection
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = content.match(emailPattern) || [];
    if (emailMatches.length > 0) {
      results.push({
        type: 'email',
        count: emailMatches.length,
        confidence: 0.90,
        samples: emailMatches.slice(0, 3).map(email => 
          email.replace(/(.{2}).*(@.*)/, '$1***$2')
        ),
        locations: []
      });
    }

    return results;
  }

  private calculatePIIRisk(types: any[]): 'low' | 'medium' | 'high' | 'critical' {
    if (types.length === 0) return 'low';
    
    const hasPersonnummer = types.some(t => t.type === 'personnummer');
    const totalCount = types.reduce((sum, t) => sum + t.count, 0);

    if (hasPersonnummer || totalCount > 100) return 'critical';
    if (totalCount > 20) return 'high';
    if (totalCount > 5) return 'medium';
    
    return 'low';
  }

  private generatePIIRecommendations(types: any[]): string[] {
    const recommendations: string[] = [];
    
    if (types.some(t => t.type === 'personnummer')) {
      recommendations.push('Implement personnummer masking or hashing');
      recommendations.push('Obtain explicit consent for personal data processing');
    }
    
    if (types.some(t => t.type === 'email')) {
      recommendations.push('Consider email domain replacement for privacy');
    }
    
    if (types.length > 0) {
      recommendations.push('Conduct Data Protection Impact Assessment (DPIA)');
      recommendations.push('Implement data minimization techniques');
      recommendations.push('Review lawful basis for personal data processing');
    }
    
    return recommendations;
  }

  private calculateComplianceSummary(checks: ComplianceCheck[]): {
    passed: number;
    failed: number;
    warnings: number;
    critical: number;
  } {
    return {
      passed: checks.filter(c => c.status === 'passed').length,
      failed: checks.filter(c => c.status === 'failed').length,
      warnings: checks.filter(c => c.status === 'warning').length,
      critical: checks.filter(c => c.severity === 'critical').length
    };
  }

  private determineOverallStatus(
    checks: ComplianceCheck[],
    strictMode?: boolean
  ): 'compliant' | 'non_compliant' | 'warning' {
    const hasCritical = checks.some(c => c.severity === 'critical' && c.status !== 'passed');
    const hasFailed = checks.some(c => c.status === 'failed');
    const hasWarnings = checks.some(c => c.status === 'warning');

    if (hasCritical) return 'non_compliant';
    if (hasFailed) return strictMode ? 'non_compliant' : 'warning';
    if (hasWarnings) return 'warning';
    
    return 'compliant';
  }
}

export default EvidencePackComplianceValidator;