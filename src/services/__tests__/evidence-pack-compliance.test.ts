/**
 * Evidence Pack EU/EES Compliance Tests
 * Testing regulatory compliance, data residency, and security requirements
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  ComplianceValidator,
  DataResidencyManager,
  EncryptionService,
  AuditCompliance,
  GDPRHandler,
  EESValidator,
  RetentionManager,
  CrossBorderController,
  SecurityAuditor,
  ComplianceReporter
} from '../evidence-pack-compliance';
import { CryptoService } from '../crypto-service';

describe('EU/EES Compliance - Data Residency', () => {
  let residencyManager: DataResidencyManager;
  let complianceValidator: ComplianceValidator;

  beforeEach(() => {
    residencyManager = new DataResidencyManager({
      primaryRegion: 'eu-north-1',
      allowedRegions: ['eu-north-1', 'eu-west-1', 'eu-central-1'],
      strictMode: true
    });

    complianceValidator = new ComplianceValidator({
      framework: 'EU-EES',
      residencyManager
    });
  });

  describe('Regional Data Storage Validation', () => {
    it('should validate EU region storage compliance', async () => {
      const storageLocation = {
        bucket: 'svoa-evidence-packs',
        region: 'eu-north-1',
        endpoint: 's3.eu-north-1.amazonaws.com'
      };

      const validation = await residencyManager.validateStorage(storageLocation);

      expect(validation.compliant).toBe(true);
      expect(validation.region).toBe('eu-north-1');
      expect(validation.jurisdiction).toBe('EU');
      expect(validation.dataProtectionLevel).toBe('GDPR');
    });

    it('should reject non-EU storage regions', async () => {
      const nonEUStorage = {
        bucket: 'evidence-packs',
        region: 'us-east-1',
        endpoint: 's3.us-east-1.amazonaws.com'
      };

      await expect(
        residencyManager.validateStorage(nonEUStorage)
      ).rejects.toThrow('Storage region us-east-1 is not compliant with EU data residency requirements');
    });

    it('should track data lineage across regions', async () => {
      const dataLineage = await residencyManager.trackDataMovement({
        packId: 'EP-2024-11-001',
        originRegion: 'eu-north-1',
        processingRegions: ['eu-north-1', 'eu-west-1'],
        currentRegion: 'eu-north-1'
      });

      expect(dataLineage.compliant).toBe(true);
      expect(dataLineage.movements).toHaveLength(2);
      expect(dataLineage.violations).toHaveLength(0);
      expect(dataLineage.auditTrail).toBeDefined();
    });

    it('should enforce geo-fencing for sensitive data', async () => {
      const geoFence = await residencyManager.createGeoFence({
        dataClassification: 'sensitive',
        allowedCountries: ['SE', 'FI', 'DK', 'NO'],
        blockList: ['RU', 'CN', 'US']
      });

      const accessAttempt = {
        ip: '192.168.1.1',
        country: 'US',
        dataId: 'EP-2024-11-001'
      };

      await expect(
        geoFence.validateAccess(accessAttempt)
      ).rejects.toThrow('Access denied from blocked country: US');
    });
  });

  describe('Data Sovereignty Compliance', () => {
    it('should validate metadata sovereignty requirements', async () => {
      const metadata = {
        packId: 'EP-2024-11-001',
        processingLocation: 'Stockholm, Sweden',
        legalEntity: 'SVOA AB',
        dataController: 'controller@svoa.se',
        dataProcessor: 'processor@svoa.se'
      };

      const sovereignty = await complianceValidator.validateSovereignty(metadata);

      expect(sovereignty.hasController).toBe(true);
      expect(sovereignty.hasProcessor).toBe(true);
      expect(sovereignty.legalBasis).toBeDefined();
      expect(sovereignty.territorialScope).toBe('EU');
    });

    it('should ensure data localization requirements', async () => {
      const localization = await residencyManager.enforceLocalization({
        dataType: 'personal',
        requiredJurisdiction: 'EU',
        currentLocation: 'eu-north-1'
      });

      expect(localization.compliant).toBe(true);
      expect(localization.requiredMoves).toHaveLength(0);
    });
  });
});

describe('EU/EES Compliance - Encryption Standards', () => {
  let encryptionService: EncryptionService;
  let securityAuditor: SecurityAuditor;

  beforeEach(() => {
    encryptionService = new EncryptionService({
      algorithm: 'AES-256-GCM',
      keyManagement: 'AWS-KMS',
      keyRotation: true
    });

    securityAuditor = new SecurityAuditor({
      encryptionService,
      complianceLevel: 'HIGH'
    });
  });

  describe('Encryption at Rest', () => {
    it('should enforce AES-256 encryption for stored data', async () => {
      const data = Buffer.from('Sensitive evidence pack data');
      
      const encrypted = await encryptionService.encryptAtRest(data, {
        keyId: 'arn:aws:kms:eu-north-1:123456789:key/abc-def',
        context: { packId: 'EP-2024-11-001' }
      });

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.keyId).toContain('eu-north-1');
      expect(encrypted.iv).toHaveLength(32); // 16 bytes in hex
      expect(encrypted.authTag).toHaveLength(32);
    });

    it('should implement key rotation policies', async () => {
      const keyRotation = await encryptionService.getKeyRotationStatus({
        keyId: 'arn:aws:kms:eu-north-1:123456789:key/abc-def'
      });

      expect(keyRotation.enabled).toBe(true);
      expect(keyRotation.rotationPeriodDays).toBe(90);
      expect(keyRotation.lastRotation).toBeInstanceOf(Date);
      expect(keyRotation.nextRotation).toBeInstanceOf(Date);
    });

    it('should validate encryption strength compliance', async () => {
      const validation = await securityAuditor.validateEncryption({
        algorithm: 'AES-128-CBC', // Weaker algorithm
        keyLength: 128
      });

      expect(validation.compliant).toBe(false);
      expect(validation.issues).toContain('Minimum key length is 256 bits');
      expect(validation.recommendedAlgorithm).toBe('AES-256-GCM');
    });
  });

  describe('Encryption in Transit', () => {
    it('should enforce TLS 1.3 for data transmission', async () => {
      const tlsConfig = await encryptionService.getTLSConfiguration();

      expect(tlsConfig.minVersion).toBe('TLSv1.3');
      expect(tlsConfig.cipherSuites).toContain('TLS_AES_256_GCM_SHA384');
      expect(tlsConfig.certificatePinning).toBe(true);
      expect(tlsConfig.hsts.enabled).toBe(true);
      expect(tlsConfig.hsts.maxAge).toBeGreaterThanOrEqual(31536000); // 1 year
    });

    it('should implement certificate validation', async () => {
      const cert = {
        subject: 'CN=*.svoa.se',
        issuer: 'CN=DigiCert EU CA',
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2025-01-01'),
        fingerprint: 'SHA256:abc123...'
      };

      const validation = await encryptionService.validateCertificate(cert);

      expect(validation.valid).toBe(true);
      expect(validation.chainValid).toBe(true);
      expect(validation.notExpired).toBe(true);
      expect(validation.correctDomain).toBe(true);
    });

    it('should detect and prevent downgrade attacks', async () => {
      const connection = {
        requestedProtocol: 'TLSv1.1',
        clientCiphers: ['TLS_RSA_WITH_AES_128_CBC_SHA']
      };

      await expect(
        encryptionService.negotiateConnection(connection)
      ).rejects.toThrow('TLS version downgrade detected. Minimum TLSv1.3 required');
    });
  });

  describe('Key Management', () => {
    it('should implement secure key storage in EU regions', async () => {
      const keyStorage = await encryptionService.getKeyStorageInfo();

      expect(keyStorage.provider).toBe('AWS-KMS');
      expect(keyStorage.region).toMatch(/^eu-/);
      expect(keyStorage.hsm).toBe(true);
      expect(keyStorage.fips140Level).toBeGreaterThanOrEqual(2);
    });

    it('should enforce key access policies', async () => {
      const keyPolicy = await encryptionService.getKeyPolicy({
        keyId: 'arn:aws:kms:eu-north-1:123456789:key/abc-def'
      });

      expect(keyPolicy.principals).toBeDefined();
      expect(keyPolicy.conditions.IpAddress).toBeDefined();
      expect(keyPolicy.conditions.StringEquals['kms:ViaService']).toContain('s3.eu-north-1.amazonaws.com');
      expect(keyPolicy.allowedOperations).toContain('Decrypt');
      expect(keyPolicy.deniedOperations).toContain('ScheduleKeyDeletion');
    });

    it('should track key usage in audit logs', async () => {
      const keyUsage = await securityAuditor.getKeyUsageAudit({
        keyId: 'arn:aws:kms:eu-north-1:123456789:key/abc-def',
        period: { from: new Date('2024-11-01'), to: new Date('2024-11-30') }
      });

      expect(keyUsage.operations).toBeInstanceOf(Array);
      expect(keyUsage.totalOperations).toBeGreaterThanOrEqual(0);
      expect(keyUsage.uniqueUsers).toBeInstanceOf(Set);
      expect(keyUsage.suspiciousActivity).toHaveLength(0);
    });
  });
});

describe('EU/EES Compliance - GDPR Requirements', () => {
  let gdprHandler: GDPRHandler;
  let auditCompliance: AuditCompliance;

  beforeEach(() => {
    gdprHandler = new GDPRHandler({
      dataController: 'SVOA AB',
      dpo: 'dpo@svoa.se', // Data Protection Officer
      retentionPeriod: 5 * 365 * 24 * 60 * 60 * 1000 // 5 years in ms
    });

    auditCompliance = new AuditCompliance({
      gdprHandler,
      logRetention: 7 * 365 * 24 * 60 * 60 * 1000 // 7 years
    });
  });

  describe('Personal Data Handling', () => {
    it('should identify and classify personal data', async () => {
      const evidencePack = {
        id: 'EP-2024-11-001',
        data: {
          organizationName: 'Stockholm Waste Management',
          contactPerson: 'Anna Andersson',
          email: 'anna@example.se',
          phoneNumber: '+46701234567',
          wasteData: { total: 1000 }
        }
      };

      const classification = await gdprHandler.classifyData(evidencePack);

      expect(classification.containsPersonalData).toBe(true);
      expect(classification.personalDataFields).toContain('contactPerson');
      expect(classification.personalDataFields).toContain('email');
      expect(classification.personalDataFields).toContain('phoneNumber');
      expect(classification.sensitivityLevel).toBe('medium');
    });

    it('should implement data minimization principles', async () => {
      const exportRequest = {
        insightId: 'INS-2024-11-001',
        includePersonalData: true,
        purpose: 'statistical_analysis'
      };

      const minimized = await gdprHandler.minimizeData(exportRequest);

      expect(minimized.personalDataIncluded).toBe(false);
      expect(minimized.reason).toBe('Personal data not required for statistical analysis');
      expect(minimized.removedFields).toContain('contactPerson');
    });

    it('should pseudonymize personal data when required', async () => {
      const personalData = {
        name: 'Anna Andersson',
        email: 'anna.andersson@example.se',
        personnummer: '19800101-1234'
      };

      const pseudonymized = await gdprHandler.pseudonymize(personalData);

      expect(pseudonymized.name).not.toBe('Anna Andersson');
      expect(pseudonymized.name).toMatch(/^USER-[A-Z0-9]{8}$/);
      expect(pseudonymized.email).toMatch(/^[a-z0-9]{8}@example\.se$/);
      expect(pseudonymized.personnummer).toBe('[REDACTED]');
      expect(pseudonymized._reversible).toBe(true);
    });
  });

  describe('Data Subject Rights', () => {
    it('should handle right to access requests', async () => {
      const accessRequest = {
        dataSubject: 'anna@example.se',
        requestId: 'DSR-2024-11-001',
        scope: 'all_evidence_packs'
      };

      const response = await gdprHandler.handleAccessRequest(accessRequest);

      expect(response.status).toBe('completed');
      expect(response.dataProvided).toBeDefined();
      expect(response.format).toBe('machine_readable');
      expect(response.completedWithin).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000); // 30 days
    });

    it('should implement right to erasure (right to be forgotten)', async () => {
      const erasureRequest = {
        dataSubject: 'anna@example.se',
        requestId: 'DSR-2024-11-002',
        reason: 'withdrawal_of_consent'
      };

      const erasureResult = await gdprHandler.handleErasureRequest(erasureRequest);

      expect(erasureResult.status).toBe('completed');
      expect(erasureResult.dataErased).toBe(true);
      expect(erasureResult.retainedData).toBeDefined(); // Some data may be retained for legal obligations
      expect(erasureResult.retentionReason).toContain('legal_obligation');
    });

    it('should support data portability requests', async () => {
      const portabilityRequest = {
        dataSubject: 'anna@example.se',
        format: 'json',
        targetController: 'other-company@example.com'
      };

      const portable = await gdprHandler.handlePortabilityRequest(portabilityRequest);

      expect(portable.format).toBe('json');
      expect(portable.machineReadable).toBe(true);
      expect(portable.includesAllPersonalData).toBe(true);
      expect(portable.transferMethod).toBe('secure_api');
    });

    it('should manage consent and legal basis', async () => {
      const consent = {
        dataSubject: 'anna@example.se',
        purpose: 'evidence_pack_generation',
        granted: true,
        timestamp: new Date()
      };

      const consentRecord = await gdprHandler.recordConsent(consent);

      expect(consentRecord.id).toBeDefined();
      expect(consentRecord.lawfulBasis).toBe('consent');
      expect(consentRecord.withdrawable).toBe(true);
      expect(consentRecord.expiresAt).toBeDefined();
    });
  });

  describe('Data Protection Impact Assessment', () => {
    it('should conduct DPIA for high-risk processing', async () => {
      const processingActivity = {
        type: 'large_scale_data_export',
        dataVolume: 1000000,
        includesPersonalData: true,
        automated: true
      };

      const dpia = await gdprHandler.conductDPIA(processingActivity);

      expect(dpia.required).toBe(true);
      expect(dpia.riskLevel).toBe('high');
      expect(dpia.mitigations).toBeInstanceOf(Array);
      expect(dpia.residualRisk).toBeLessThanOrEqual('medium');
      expect(dpia.approved).toBeDefined();
    });

    it('should assess privacy risks and controls', async () => {
      const riskAssessment = await gdprHandler.assessPrivacyRisks({
        activity: 'evidence_pack_export',
        dataTypes: ['personal', 'sensitive'],
        recipients: ['internal', 'regulatory_authority']
      });

      expect(riskAssessment.identifiedRisks).toBeInstanceOf(Array);
      expect(riskAssessment.controls).toBeInstanceOf(Array);
      expect(riskAssessment.overallRisk).toBeDefined();
      expect(riskAssessment.recommendations).toBeInstanceOf(Array);
    });
  });
});

describe('EU/EES Compliance - Audit and Reporting', () => {
  let auditCompliance: AuditCompliance;
  let complianceReporter: ComplianceReporter;

  beforeEach(() => {
    auditCompliance = new AuditCompliance({
      retentionYears: 7,
      immutable: true,
      signedLogs: true
    });

    complianceReporter = new ComplianceReporter({
      auditCompliance,
      reportingFrequency: 'monthly'
    });
  });

  describe('Audit Trail Requirements', () => {
    it('should maintain comprehensive audit logs for 7 years', async () => {
      const auditEntry = {
        timestamp: new Date(),
        action: 'EVIDENCE_PACK_EXPORTED',
        actor: 'user@example.se',
        resource: 'EP-2024-11-001',
        details: {
          purpose: 'Regulatory reporting',
          destination: 'Swedish EPA'
        }
      };

      const logged = await auditCompliance.logEntry(auditEntry);

      expect(logged.id).toBeDefined();
      expect(logged.immutable).toBe(true);
      expect(logged.retentionExpiry).toEqual(
        new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
      );
      expect(logged.signature).toBeDefined();
    });

    it('should ensure audit log immutability', async () => {
      const logId = 'AUDIT-2024-11-001';
      
      await expect(
        auditCompliance.modifyLog(logId, { action: 'MODIFIED_ACTION' })
      ).rejects.toThrow('Audit logs are immutable and cannot be modified');

      await expect(
        auditCompliance.deleteLog(logId)
      ).rejects.toThrow('Audit logs cannot be deleted before retention period expires');
    });

    it('should implement audit log integrity verification', async () => {
      const logs = await auditCompliance.getLogs({
        from: new Date('2024-11-01'),
        to: new Date('2024-11-30')
      });

      const integrity = await auditCompliance.verifyIntegrity(logs);

      expect(integrity.valid).toBe(true);
      expect(integrity.tamperedLogs).toHaveLength(0);
      expect(integrity.chainValid).toBe(true);
      expect(integrity.signatures).toBeInstanceOf(Array);
    });

    it('should track regulatory access to evidence packs', async () => {
      const regulatoryAccess = {
        authority: 'Swedish Environmental Protection Agency',
        authorizedBy: 'Court Order 2024-11-001',
        accessedPacks: ['EP-2024-11-001', 'EP-2024-11-002'],
        purpose: 'Compliance investigation'
      };

      const tracked = await auditCompliance.trackRegulatoryAccess(regulatoryAccess);

      expect(tracked.logged).toBe(true);
      expect(tracked.notificationsSent).toContain('dpo@svoa.se');
      expect(tracked.retentionExtended).toBe(true);
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate monthly compliance reports', async () => {
      const report = await complianceReporter.generateMonthlyReport({
        month: '2024-11',
        organizationId: 'ORG-001'
      });

      expect(report.period).toBe('2024-11');
      expect(report.metrics.totalExports).toBeGreaterThanOrEqual(0);
      expect(report.metrics.gdprRequests).toBeDefined();
      expect(report.metrics.dataBreaches).toBe(0);
      expect(report.metrics.complianceScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics.complianceScore).toBeLessThanOrEqual(100);
    });

    it('should identify compliance violations', async () => {
      const violations = await complianceReporter.detectViolations({
        period: { from: new Date('2024-11-01'), to: new Date('2024-11-30') }
      });

      expect(violations).toBeInstanceOf(Array);
      violations.forEach(violation => {
        expect(violation.type).toBeDefined();
        expect(violation.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(violation.description).toBeDefined();
        expect(violation.remediation).toBeDefined();
      });
    });

    it('should generate regulatory submission packages', async () => {
      const submission = await complianceReporter.prepareRegulatorySubmission({
        authority: 'Swedish Data Protection Authority',
        reportType: 'annual_compliance',
        year: 2024
      });

      expect(submission.format).toBe('XML'); // Standard format for regulatory submissions
      expect(submission.signed).toBe(true);
      expect(submission.includes).toContain('audit_summary');
      expect(submission.includes).toContain('dpia_results');
      expect(submission.includes).toContain('incident_reports');
      expect(submission.validated).toBe(true);
    });
  });
});

describe('EU/EES Compliance - Cross-Border and Special Scenarios', () => {
  let crossBorderController: CrossBorderController;
  let eesValidator: EESValidator;

  beforeEach(() => {
    crossBorderController = new CrossBorderController({
      homeCountry: 'SE',
      euMemberState: true
    });

    eesValidator = new EESValidator({
      biometricDataHandling: true,
      interoperabilityRequired: true
    });
  });

  describe('Cross-Border Data Transfers', () => {
    it('should validate intra-EU data transfers', async () => {
      const transfer = {
        from: 'SE',
        to: 'FI',
        dataType: 'evidence_pack',
        volume: 1000
      };

      const validation = await crossBorderController.validateTransfer(transfer);

      expect(validation.allowed).toBe(true);
      expect(validation.basis).toBe('EU_FREE_MOVEMENT');
      expect(validation.additionalRequirements).toHaveLength(0);
    });

    it('should block unauthorized third-country transfers', async () => {
      const transfer = {
        from: 'SE',
        to: 'US',
        dataType: 'personal_data',
        adequacyDecision: false
      };

      await expect(
        crossBorderController.validateTransfer(transfer)
      ).rejects.toThrow('Transfer to US requires additional safeguards (SCC or BCR)');
    });

    it('should implement Standard Contractual Clauses for approved transfers', async () => {
      const scc = await crossBorderController.implementSCC({
        exporter: 'SVOA AB',
        importer: 'US Partner Inc',
        dataCategories: ['evidence_packs'],
        purposes: ['service_provision']
      });

      expect(scc.version).toBe('2021/914'); // Latest EU SCC version
      expect(scc.module).toBe('Controller-to-Processor');
      expect(scc.signed).toBe(true);
      expect(scc.safeguards).toBeInstanceOf(Array);
    });
  });

  describe('EES Specific Requirements', () => {
    it('should validate biometric data handling compliance', async () => {
      const biometricProcess = {
        dataType: 'fingerprint_hash',
        purpose: 'identity_verification',
        retention: 5 * 365 * 24 * 60 * 60 * 1000
      };

      const validation = await eesValidator.validateBiometric(biometricProcess);

      expect(validation.compliant).toBe(true);
      expect(validation.encryptionRequired).toBe(true);
      expect(validation.accessRestricted).toBe(true);
      expect(validation.auditingEnabled).toBe(true);
    });

    it('should ensure interoperability with EU systems', async () => {
      const interop = await eesValidator.testInteroperability({
        system: 'evidence_pack_export',
        euSystem: 'VIS', // Visa Information System
        dataFormat: 'XML'
      });

      expect(interop.compatible).toBe(true);
      expect(interop.schemaValid).toBe(true);
      expect(interop.securityProtocols).toContain('TLS1.3');
      expect(interop.authenticationMethod).toBe('mutual_TLS');
    });
  });

  describe('Emergency and Special Access', () => {
    it('should handle law enforcement access requests', async () => {
      const lawEnforcementRequest = {
        authority: 'Swedish Police',
        legalBasis: 'Court Order 2024-XYZ',
        urgency: 'high',
        packIds: ['EP-2024-11-001']
      };

      const access = await crossBorderController.handleLawEnforcementAccess(lawEnforcementRequest);

      expect(access.granted).toBe(true);
      expect(access.logged).toBe(true);
      expect(access.notifiedDPO).toBe(true);
      expect(access.temporaryAccess).toBe(true);
      expect(access.expiresIn).toBe(72 * 60 * 60 * 1000); // 72 hours
    });

    it('should implement data breach notification procedures', async () => {
      const breach = {
        detected: new Date(),
        type: 'unauthorized_access',
        affectedPacks: 150,
        personalDataAffected: true
      };

      const notification = await auditCompliance.handleDataBreach(breach);

      expect(notification.authoritiesNotified).toBe(true);
      expect(notification.notificationTime).toBeLessThanOrEqual(72 * 60 * 60 * 1000); // Within 72 hours
      expect(notification.affectedUsersNotified).toBe(true);
      expect(notification.mitigationSteps).toBeInstanceOf(Array);
    });
  });
});