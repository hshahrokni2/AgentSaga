/**
 * Evidence Pack Export System Tests
 * EU/EES Compliant Export System for SVOA Lea Platform
 * 
 * Requirements:
 * - Immutable evidence packs with 5-year retention
 * - Complete data extraction (CSV, charts, artifacts)
 * - ZIP packaging with manifest generation
 * - Signed URL security with expiration
 * - Full audit trail tracking
 * - EU/EES data residency compliance
 * - Object store versioning + lifecycle policies
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  EvidencePackExporter,
  EvidencePackManifest,
  ExportAuditEntry,
  SignedUrlConfig,
  RetentionPolicy,
  StorageProvider,
  EvidenceArtifact,
  ExportBatch,
  DataIntegrityValidator,
  ComplianceValidator
} from '../evidence-pack-export';
import { ObjectStorageClient } from '../object-storage-client';
import { AuditLogger } from '../audit-logger';
import { createHash } from 'crypto';
import { Readable } from 'stream';

// Swedish waste management test data
const mockSwedishWasteData = {
  organizationId: 'ORG-2024-001',
  facilityName: 'Stockholms Återvinningscentral',
  month: '2024-11',
  insightId: 'INS-2024-11-042',
  scenarioId: 'SCN-2024-11-015',
  wasteCategories: [
    { category: 'Restavfall', amount: 15230, unit: 'kg' },
    { category: 'Matavfall', amount: 8750, unit: 'kg' },
    { category: 'Återvinning', amount: 22100, unit: 'kg' },
    { category: 'Farligt avfall', amount: 450, unit: 'kg' }
  ],
  monthlyOverview: {
    title: 'Månadsöversikt November 2024',
    totalWaste: 46530,
    recyclingRate: 47.5,
    description: 'Ökad återvinning jämfört med föregående månad'
  }
};

describe('Evidence Pack Export System - Core Functionality', () => {
  let exporter: EvidencePackExporter;
  let storageClient: ObjectStorageClient;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    storageClient = new ObjectStorageClient({
      region: 'eu-north-1',
      bucket: 'svoa-evidence-packs',
      encryption: 'AES-256'
    });
    
    auditLogger = new AuditLogger({
      service: 'evidence-pack-export',
      region: 'eu-north-1'
    });
    
    exporter = new EvidencePackExporter({
      storageClient,
      auditLogger,
      retentionYears: 5,
      complianceMode: 'EU-EES'
    });

    jest.clearAllMocks();
  });

  describe('Evidence Pack Generation', () => {
    it('should generate complete evidence pack with all required components', async () => {
      const exportRequest = {
        insightId: mockSwedishWasteData.insightId,
        scenarioId: mockSwedishWasteData.scenarioId,
        includeCSV: true,
        includeCharts: true,
        includeArtifacts: true,
        metadata: {
          requestedBy: 'user@example.se',
          requestedAt: new Date('2024-11-15T10:00:00Z'),
          purpose: 'Månadsrapport till styrelsen'
        }
      };

      const evidencePack = await exporter.generateEvidencePack(exportRequest);

      expect(evidencePack).toBeDefined();
      expect(evidencePack.id).toMatch(/^EP-\d{4}-\d{2}-\d{6}$/);
      expect(evidencePack.components).toContain('data.csv');
      expect(evidencePack.components).toContain('charts/');
      expect(evidencePack.components).toContain('artifacts/');
      expect(evidencePack.manifest).toBeDefined();
      expect(evidencePack.checksum).toBeDefined();
      expect(evidencePack.sizeBytes).toBeGreaterThan(0);
    });

    it('should extract CSV data with proper Swedish character encoding', async () => {
      const csvData = await exporter.extractCSVData({
        data: mockSwedishWasteData,
        encoding: 'utf-8',
        delimiter: ';' // Swedish standard
      });

      const csvContent = csvData.toString();
      expect(csvContent).toContain('Återvinningscentral');
      expect(csvContent).toContain('Månadsöversikt');
      expect(csvContent).toContain('Ökad återvinning');
      expect(csvContent).toMatch(/Kategori;Mängd;Enhet/);
      
      // Verify Swedish characters are properly encoded
      expect(Buffer.from(csvContent).includes(Buffer.from('å'))).toBe(true);
      expect(Buffer.from(csvContent).includes(Buffer.from('ä'))).toBe(true);
      expect(Buffer.from(csvContent).includes(Buffer.from('ö'))).toBe(true);
    });

    it('should generate chart images from visualization data', async () => {
      const chartRequest = {
        type: 'waste-distribution',
        data: mockSwedishWasteData.wasteCategories,
        title: 'Avfallsfördelning November 2024',
        format: 'png',
        dimensions: { width: 800, height: 600 }
      };

      const chartArtifact = await exporter.generateChart(chartRequest);

      expect(chartArtifact).toBeDefined();
      expect(chartArtifact.filename).toBe('waste-distribution.png');
      expect(chartArtifact.mimeType).toBe('image/png');
      expect(chartArtifact.sizeBytes).toBeGreaterThan(10000);
      expect(chartArtifact.checksum).toBeDefined();
    });

    it('should collect all related artifacts for an insight', async () => {
      const artifacts = await exporter.collectArtifacts({
        insightId: mockSwedishWasteData.insightId,
        includeTypes: ['reports', 'images', 'documents']
      });

      expect(artifacts).toBeInstanceOf(Array);
      expect(artifacts.length).toBeGreaterThan(0);
      
      artifacts.forEach(artifact => {
        expect(artifact.id).toBeDefined();
        expect(artifact.filename).toBeDefined();
        expect(artifact.type).toMatch(/^(report|image|document)$/);
        expect(artifact.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('ZIP Packaging and Manifest Generation', () => {
    it('should create ZIP package with proper structure', async () => {
      const components = {
        csvData: Buffer.from('test csv data'),
        charts: [
          { name: 'chart1.png', data: Buffer.from('chart1 data') },
          { name: 'chart2.png', data: Buffer.from('chart2 data') }
        ],
        artifacts: [
          { name: 'report.pdf', data: Buffer.from('report data') }
        ]
      };

      const zipPackage = await exporter.createZipPackage(components);

      expect(zipPackage).toBeDefined();
      expect(zipPackage.buffer).toBeInstanceOf(Buffer);
      expect(zipPackage.sizeBytes).toBeGreaterThan(0);
      expect(zipPackage.entries).toContain('data.csv');
      expect(zipPackage.entries).toContain('charts/chart1.png');
      expect(zipPackage.entries).toContain('charts/chart2.png');
      expect(zipPackage.entries).toContain('artifacts/report.pdf');
      expect(zipPackage.entries).toContain('manifest.json');
    });

    it('should generate comprehensive manifest.json', async () => {
      const manifest = await exporter.generateManifest({
        packId: 'EP-2024-11-000042',
        insightId: mockSwedishWasteData.insightId,
        scenarioId: mockSwedishWasteData.scenarioId,
        components: ['data.csv', 'charts/', 'artifacts/'],
        metadata: {
          organization: 'Stockholms Återvinningscentral',
          generatedAt: new Date('2024-11-15T10:00:00Z'),
          generatedBy: 'user@example.se',
          purpose: 'Månadsrapport',
          swedishContext: {
            month: 'November 2024',
            facility: 'Huvudanläggningen'
          }
        }
      });

      expect(manifest).toBeDefined();
      expect(manifest.version).toBe('1.0');
      expect(manifest.packId).toBe('EP-2024-11-000042');
      expect(manifest.insightId).toBe(mockSwedishWasteData.insightId);
      expect(manifest.scenarioId).toBe(mockSwedishWasteData.scenarioId);
      expect(manifest.checksums).toBeDefined();
      expect(manifest.metadata.swedishContext).toBeDefined();
      expect(manifest.retentionPolicy.expiresAt).toBeDefined();
      expect(manifest.retentionPolicy.years).toBe(5);
    });

    it('should calculate checksums for all package components', async () => {
      const components = {
        'data.csv': Buffer.from('csv content'),
        'charts/chart1.png': Buffer.from('chart1 content'),
        'artifacts/report.pdf': Buffer.from('report content')
      };

      const checksums = await exporter.calculateChecksums(components);

      expect(checksums['data.csv']).toMatch(/^[a-f0-9]{64}$/); // SHA-256
      expect(checksums['charts/chart1.png']).toMatch(/^[a-f0-9]{64}$/);
      expect(checksums['artifacts/report.pdf']).toMatch(/^[a-f0-9]{64}$/);
      expect(checksums['manifest.json']).toBeDefined();
    });
  });

  describe('Retention Policy Compliance', () => {
    it('should enforce 5-year minimum retention policy', async () => {
      const retentionPolicy = await exporter.applyRetentionPolicy({
        packId: 'EP-2024-11-000042',
        createdAt: new Date('2024-11-15'),
        policyType: 'COMPLIANCE_HOLD'
      });

      expect(retentionPolicy.retentionYears).toBe(5);
      expect(retentionPolicy.earliestDeletionDate).toEqual(new Date('2029-11-15'));
      expect(retentionPolicy.immutable).toBe(true);
      expect(retentionPolicy.legalHold).toBe(false);
    });

    it('should prevent deletion before retention period expires', async () => {
      const packId = 'EP-2024-11-000042';
      await exporter.uploadEvidencePack(packId, Buffer.from('test data'));

      await expect(
        exporter.deleteEvidencePack(packId)
      ).rejects.toThrow('Cannot delete: retention policy active until 2029-11-15');
    });

    it('should support legal hold extension beyond standard retention', async () => {
      const legalHold = await exporter.applyLegalHold({
        packId: 'EP-2024-11-000042',
        reason: 'Regulatory investigation',
        appliedBy: 'legal@example.se',
        indefinite: true
      });

      expect(legalHold.active).toBe(true);
      expect(legalHold.indefinite).toBe(true);
      expect(legalHold.preventsDeletion).toBe(true);
      expect(legalHold.appliedAt).toBeInstanceOf(Date);
    });
  });

  describe('Signed URL Generation and Security', () => {
    it('should generate signed URLs with expiration', async () => {
      const signedUrl = await exporter.generateSignedUrl({
        packId: 'EP-2024-11-000042',
        expiresIn: 3600, // 1 hour
        accessLevel: 'read-only',
        requestedBy: 'user@example.se'
      });

      expect(signedUrl.url).toMatch(/^https:\/\/.+\.s3\.eu-north-1\.amazonaws\.com\/.+/);
      expect(signedUrl.expiresAt).toBeInstanceOf(Date);
      expect(signedUrl.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(signedUrl.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3600000);
      expect(signedUrl.signature).toBeDefined();
    });

    it('should validate signed URL expiration', async () => {
      const expiredUrl = {
        url: 'https://example.com/expired',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        signature: 'abc123'
      };

      const isValid = await exporter.validateSignedUrl(expiredUrl);
      expect(isValid).toBe(false);
    });

    it('should track signed URL usage in audit log', async () => {
      const packId = 'EP-2024-11-000042';
      const signedUrl = await exporter.generateSignedUrl({
        packId,
        expiresIn: 3600,
        requestedBy: 'user@example.se'
      });

      const auditEntries = await auditLogger.getEntries({
        resourceId: packId,
        action: 'SIGNED_URL_GENERATED'
      });

      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].actor).toBe('user@example.se');
      expect(auditEntries[0].metadata.expiresAt).toBeDefined();
    });

    it('should enforce access control based on permissions', async () => {
      await expect(
        exporter.generateSignedUrl({
          packId: 'EP-2024-11-000042',
          expiresIn: 3600,
          requestedBy: 'unauthorized@example.se',
          accessLevel: 'read-write'
        })
      ).rejects.toThrow('Insufficient permissions for read-write access');
    });
  });

  describe('Batch Export Functionality', () => {
    it('should handle batch export of multiple evidence packs', async () => {
      const batchRequest = {
        insightIds: [
          'INS-2024-11-042',
          'INS-2024-11-043',
          'INS-2024-11-044'
        ],
        format: 'zip',
        compression: 'gzip',
        maxConcurrent: 3
      };

      const batchResult = await exporter.exportBatch(batchRequest);

      expect(batchResult.totalPacks).toBe(3);
      expect(batchResult.successful).toBe(3);
      expect(batchResult.failed).toBe(0);
      expect(batchResult.packs).toHaveLength(3);
      expect(batchResult.processingTime).toBeGreaterThan(0);
    });

    it('should optimize performance for large batch exports', async () => {
      const largeBatch = {
        insightIds: Array.from({ length: 100 }, (_, i) => `INS-2024-11-${i.toString().padStart(3, '0')}`),
        format: 'zip',
        compression: 'gzip',
        maxConcurrent: 10
      };

      const startTime = Date.now();
      const batchResult = await exporter.exportBatch(largeBatch);
      const processingTime = Date.now() - startTime;

      expect(batchResult.totalPacks).toBe(100);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(batchResult.performance.avgPackTime).toBeLessThan(1000); // Each pack < 1 second
    });

    it('should handle partial batch failures gracefully', async () => {
      const batchWithErrors = {
        insightIds: [
          'INS-2024-11-042',
          'INS-INVALID-001', // Will fail
          'INS-2024-11-044'
        ],
        continueOnError: true
      };

      const batchResult = await exporter.exportBatch(batchWithErrors);

      expect(batchResult.totalPacks).toBe(3);
      expect(batchResult.successful).toBe(2);
      expect(batchResult.failed).toBe(1);
      expect(batchResult.errors).toHaveLength(1);
      expect(batchResult.errors[0].insightId).toBe('INS-INVALID-001');
    });
  });

  describe('Automated Archival Process', () => {
    it('should automatically archive evidence packs after specified period', async () => {
      const archivalPolicy = {
        activeStorageDays: 90,
        archiveStorage: 'glacier',
        autoArchive: true
      };

      const packId = 'EP-2024-08-000001'; // Created 3+ months ago
      const archivalResult = await exporter.checkAndArchive(packId, archivalPolicy);

      expect(archivalResult.archived).toBe(true);
      expect(archivalResult.storageClass).toBe('glacier');
      expect(archivalResult.retrievalTime).toBe('3-5 hours');
      expect(archivalResult.costSavings).toBeGreaterThan(0);
    });

    it('should maintain index of archived packs for retrieval', async () => {
      const archivedPacks = await exporter.getArchivedPacks({
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-06-30')
        }
      });

      expect(archivedPacks).toBeInstanceOf(Array);
      archivedPacks.forEach(pack => {
        expect(pack.id).toBeDefined();
        expect(pack.archivedAt).toBeInstanceOf(Date);
        expect(pack.storageClass).toBe('glacier');
        expect(pack.retrievable).toBe(true);
      });
    });

    it('should handle retrieval requests from archive storage', async () => {
      const retrievalRequest = await exporter.requestRetrieval({
        packId: 'EP-2024-01-000042',
        tier: 'expedited', // 1-5 minutes
        notifyEmail: 'user@example.se'
      });

      expect(retrievalRequest.status).toBe('initiated');
      expect(retrievalRequest.estimatedTime).toBe('1-5 minutes');
      expect(retrievalRequest.requestId).toBeDefined();
      expect(retrievalRequest.notificationSent).toBe(true);
    });
  });

  describe('Data Integrity Verification', () => {
    it('should verify checksum integrity on download', async () => {
      const packId = 'EP-2024-11-000042';
      const downloadedPack = await exporter.downloadEvidencePack(packId);

      const integrityCheck = await exporter.verifyIntegrity({
        data: downloadedPack.buffer,
        expectedChecksum: downloadedPack.manifest.checksum,
        algorithm: 'sha256'
      });

      expect(integrityCheck.valid).toBe(true);
      expect(integrityCheck.actualChecksum).toBe(downloadedPack.manifest.checksum);
    });

    it('should detect and report data corruption', async () => {
      const corruptedData = Buffer.from('corrupted data');
      const expectedChecksum = 'abc123def456'; // Wrong checksum

      const integrityCheck = await exporter.verifyIntegrity({
        data: corruptedData,
        expectedChecksum,
        algorithm: 'sha256'
      });

      expect(integrityCheck.valid).toBe(false);
      expect(integrityCheck.error).toBe('Checksum mismatch: data may be corrupted');
      expect(integrityCheck.actualChecksum).not.toBe(expectedChecksum);
    });

    it('should implement versioning for evidence pack updates', async () => {
      const packId = 'EP-2024-11-000042';
      
      // Create initial version
      const v1 = await exporter.createVersion(packId, { data: 'version 1' });
      
      // Create updated version
      const v2 = await exporter.createVersion(packId, { data: 'version 2' });

      const versions = await exporter.getVersionHistory(packId);

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
      expect(versions[1].previousVersion).toBe(1);
      expect(versions[1].immutable).toBe(true);
    });
  });

  describe('Export Audit Trail and Tracking', () => {
    it('should log all export operations in audit trail', async () => {
      const packId = 'EP-2024-11-000042';
      
      // Perform various operations
      await exporter.generateEvidencePack({ insightId: mockSwedishWasteData.insightId });
      await exporter.generateSignedUrl({ packId, expiresIn: 3600 });
      await exporter.downloadEvidencePack(packId);

      const auditTrail = await auditLogger.getFullTrail(packId);

      expect(auditTrail).toHaveLength(3);
      expect(auditTrail.map(e => e.action)).toContain('PACK_GENERATED');
      expect(auditTrail.map(e => e.action)).toContain('SIGNED_URL_GENERATED');
      expect(auditTrail.map(e => e.action)).toContain('PACK_DOWNLOADED');

      auditTrail.forEach(entry => {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.actor).toBeDefined();
        expect(entry.ipAddress).toBeDefined();
        expect(entry.userAgent).toBeDefined();
      });
    });

    it('should track export statistics and metrics', async () => {
      const metrics = await exporter.getExportMetrics({
        period: 'monthly',
        month: '2024-11'
      });

      expect(metrics.totalExports).toBeGreaterThanOrEqual(0);
      expect(metrics.totalSizeBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.averagePackSize).toBeGreaterThanOrEqual(0);
      expect(metrics.mostActiveUsers).toBeInstanceOf(Array);
      expect(metrics.exportsByDay).toBeInstanceOf(Object);
      expect(metrics.performanceMetrics).toBeDefined();
    });

    it('should maintain chain of custody for legal compliance', async () => {
      const packId = 'EP-2024-11-000042';
      const chainOfCustody = await exporter.getChainOfCustody(packId);

      expect(chainOfCustody).toBeInstanceOf(Array);
      expect(chainOfCustody[0].event).toBe('CREATED');
      
      chainOfCustody.forEach(event => {
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.actor).toBeDefined();
        expect(event.hash).toMatch(/^[a-f0-9]{64}$/);
        expect(event.previousHash).toBeDefined();
      });

      // Verify chain integrity
      const isValidChain = await exporter.verifyChainOfCustody(chainOfCustody);
      expect(isValidChain).toBe(true);
    });
  });

  describe('Storage Lifecycle Management', () => {
    it('should apply lifecycle policies based on data classification', async () => {
      const lifecyclePolicies = await exporter.applyLifecyclePolicies({
        packId: 'EP-2024-11-000042',
        classification: 'sensitive',
        policies: {
          transitions: [
            { days: 30, storageClass: 'STANDARD_IA' },
            { days: 90, storageClass: 'GLACIER' },
            { days: 365, storageClass: 'DEEP_ARCHIVE' }
          ],
          expiration: { days: 1825 } // 5 years
        }
      });

      expect(lifecyclePolicies.applied).toBe(true);
      expect(lifecyclePolicies.currentClass).toBe('STANDARD');
      expect(lifecyclePolicies.nextTransition).toBeDefined();
      expect(lifecyclePolicies.expirationDate).toBeDefined();
    });

    it('should optimize storage costs through intelligent tiering', async () => {
      const costAnalysis = await exporter.analyzeStorageCosts({
        period: 'yearly',
        year: 2024
      });

      expect(costAnalysis.totalCost).toBeGreaterThan(0);
      expect(costAnalysis.breakdown.standard).toBeDefined();
      expect(costAnalysis.breakdown.standardIA).toBeDefined();
      expect(costAnalysis.breakdown.glacier).toBeDefined();
      expect(costAnalysis.savings.fromTiering).toBeGreaterThan(0);
      expect(costAnalysis.recommendations).toBeInstanceOf(Array);
    });

    it('should handle storage quota management', async () => {
      const quotaStatus = await exporter.checkStorageQuota({
        organizationId: 'ORG-2024-001'
      });

      expect(quotaStatus.used).toBeGreaterThanOrEqual(0);
      expect(quotaStatus.limit).toBeGreaterThan(0);
      expect(quotaStatus.percentage).toBeLessThanOrEqual(100);
      expect(quotaStatus.warning).toBeDefined();
      
      if (quotaStatus.percentage > 80) {
        expect(quotaStatus.warning).toBe('Approaching storage limit');
      }
    });
  });

  describe('EU Region Compliance Validation', () => {
    it('should validate EU data residency requirements', async () => {
      const complianceCheck = await exporter.validateEUCompliance({
        packId: 'EP-2024-11-000042'
      });

      expect(complianceCheck.dataResidency.region).toMatch(/^eu-(north|west|central)-\d$/);
      expect(complianceCheck.dataResidency.compliant).toBe(true);
      expect(complianceCheck.encryption.atRest).toBe(true);
      expect(complianceCheck.encryption.inTransit).toBe(true);
      expect(complianceCheck.encryption.algorithm).toBe('AES-256-GCM');
    });

    it('should ensure GDPR compliance for personal data', async () => {
      const gdprCompliance = await exporter.validateGDPRCompliance({
        packId: 'EP-2024-11-000042',
        containsPersonalData: true
      });

      expect(gdprCompliance.lawfulBasis).toBeDefined();
      expect(gdprCompliance.dataMinimization).toBe(true);
      expect(gdprCompliance.rightToErasure).toBe(true);
      expect(gdprCompliance.dataPortability).toBe(true);
      expect(gdprCompliance.privacyByDesign).toBe(true);
    });

    it('should validate EES (Entry/Exit System) requirements', async () => {
      const eesCompliance = await exporter.validateEESCompliance({
        packId: 'EP-2024-11-000042'
      });

      expect(eesCompliance.biometricDataHandling).toBe('compliant');
      expect(eesCompliance.retentionCompliance).toBe(true);
      expect(eesCompliance.interoperability).toBe(true);
      expect(eesCompliance.auditLogRetention).toBeGreaterThanOrEqual(5);
    });

    it('should handle cross-border data transfer restrictions', async () => {
      await expect(
        exporter.transferToRegion({
          packId: 'EP-2024-11-000042',
          targetRegion: 'us-east-1'
        })
      ).rejects.toThrow('Cross-border transfer to non-EU region requires additional approval');
    });
  });
});

describe('Evidence Pack Export System - Advanced Features', () => {
  let exporter: EvidencePackExporter;

  beforeEach(() => {
    exporter = new EvidencePackExporter({
      region: 'eu-north-1',
      retentionYears: 5
    });
  });

  describe('Multi-language Support', () => {
    it('should support Swedish language in all metadata fields', async () => {
      const swedishMetadata = {
        title: 'Årsrapport för återvinning',
        description: 'Översikt över månadens avfallshantering',
        tags: ['återvinning', 'miljö', 'hållbarhet'],
        customFields: {
          ansvarig: 'Örjan Åkesson',
          område: 'Södra Stockholm'
        }
      };

      const pack = await exporter.createPackWithMetadata(swedishMetadata);
      
      expect(pack.metadata.title).toBe('Årsrapport för återvinning');
      expect(pack.metadata.tags).toContain('hållbarhet');
      expect(pack.metadata.customFields.ansvarig).toBe('Örjan Åkesson');
    });
  });

  describe('Performance Optimization', () => {
    it('should use streaming for large file processing', async () => {
      const largeDataStream = Readable.from(Buffer.alloc(100 * 1024 * 1024)); // 100MB
      
      const processingResult = await exporter.processLargeFile({
        stream: largeDataStream,
        useStreaming: true,
        chunkSize: 1024 * 1024 // 1MB chunks
      });

      expect(processingResult.processed).toBe(true);
      expect(processingResult.memoryUsage).toBeLessThan(50 * 1024 * 1024); // Less than 50MB RAM
    });

    it('should implement caching for frequently accessed packs', async () => {
      const packId = 'EP-2024-11-000042';
      
      // First access - cache miss
      const firstAccess = await exporter.getPackWithCache(packId);
      expect(firstAccess.cacheHit).toBe(false);
      
      // Second access - cache hit
      const secondAccess = await exporter.getPackWithCache(packId);
      expect(secondAccess.cacheHit).toBe(true);
      expect(secondAccess.responseTime).toBeLessThan(firstAccess.responseTime);
    });
  });

  describe('Disaster Recovery', () => {
    it('should support multi-region replication', async () => {
      const replicationConfig = await exporter.configureReplication({
        primaryRegion: 'eu-north-1',
        replicaRegions: ['eu-west-1', 'eu-central-1'],
        replicationMode: 'async'
      });

      expect(replicationConfig.enabled).toBe(true);
      expect(replicationConfig.regions).toHaveLength(3);
      expect(replicationConfig.rpo).toBeLessThanOrEqual(60); // RPO <= 60 seconds
    });

    it('should handle automatic failover', async () => {
      const failoverTest = await exporter.testFailover({
        simulateFailure: 'eu-north-1',
        targetRegion: 'eu-west-1'
      });

      expect(failoverTest.successful).toBe(true);
      expect(failoverTest.failoverTime).toBeLessThan(30000); // < 30 seconds
      expect(failoverTest.dataLoss).toBe(0);
    });
  });

  describe('Integration with External Systems', () => {
    it('should integrate with Archon-inspired UI components', async () => {
      const uiExport = await exporter.prepareForUI({
        packId: 'EP-2024-11-000042',
        format: 'archon',
        includePreview: true
      });

      expect(uiExport.format).toBe('archon');
      expect(uiExport.preview).toBeDefined();
      expect(uiExport.downloadUrl).toBeDefined();
      expect(uiExport.metadata.displayName).toContain('Månadsöversikt');
    });

    it('should provide webhook notifications for export events', async () => {
      const webhookConfig = {
        url: 'https://api.example.se/webhooks/export',
        events: ['pack.created', 'pack.downloaded', 'pack.archived'],
        secret: 'webhook-secret-key'
      };

      const webhook = await exporter.configureWebhook(webhookConfig);
      
      expect(webhook.configured).toBe(true);
      expect(webhook.events).toHaveLength(3);
      expect(webhook.signature).toBeDefined();
    });
  });
});

describe('Evidence Pack Export System - Error Handling', () => {
  let exporter: EvidencePackExporter;

  beforeEach(() => {
    exporter = new EvidencePackExporter({
      region: 'eu-north-1',
      retentionYears: 5
    });
  });

  describe('Network Resilience', () => {
    it('should retry failed uploads with exponential backoff', async () => {
      const mockFailingUpload = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ success: true });

      const result = await exporter.uploadWithRetry({
        data: Buffer.from('test data'),
        maxRetries: 3,
        backoffMultiplier: 2
      });

      expect(result.success).toBe(true);
      expect(mockFailingUpload).toHaveBeenCalledTimes(3);
    });

    it('should handle partial upload failures', async () => {
      const multipartUpload = await exporter.uploadLargeFile({
        file: Buffer.alloc(100 * 1024 * 1024), // 100MB
        partSize: 10 * 1024 * 1024, // 10MB parts
        simulatePartialFailure: true
      });

      expect(multipartUpload.completed).toBe(true);
      expect(multipartUpload.retriedParts).toBeGreaterThan(0);
      expect(multipartUpload.finalChecksum).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    it('should validate required fields before pack generation', async () => {
      const invalidRequest = {
        insightId: null, // Missing required field
        scenarioId: 'SCN-2024-11-015'
      };

      await expect(
        exporter.generateEvidencePack(invalidRequest)
      ).rejects.toThrow('Required field missing: insightId');
    });

    it('should sanitize user inputs to prevent injection attacks', async () => {
      const maliciousInput = {
        insightId: '../../../etc/passwd',
        metadata: {
          script: '<script>alert("xss")</script>'
        }
      };

      const sanitized = await exporter.sanitizeInput(maliciousInput);
      
      expect(sanitized.insightId).not.toContain('../');
      expect(sanitized.metadata.script).not.toContain('<script>');
    });
  });

  describe('Resource Management', () => {
    it('should clean up temporary files after processing', async () => {
      const tempFiles = await exporter.createTempFiles({
        count: 5,
        prefix: 'evidence-temp-'
      });

      const cleanupResult = await exporter.cleanupTempFiles(tempFiles);
      
      expect(cleanupResult.deleted).toBe(5);
      expect(cleanupResult.errors).toHaveLength(0);
    });

    it('should handle memory limits for large operations', async () => {
      const memoryLimitedOperation = await exporter.processWithMemoryLimit({
        operation: 'large-export',
        memoryLimit: 512 * 1024 * 1024, // 512MB
        data: Buffer.alloc(1024 * 1024 * 1024) // 1GB
      });

      expect(memoryLimitedOperation.completed).toBe(true);
      expect(memoryLimitedOperation.usedStreaming).toBe(true);
      expect(memoryLimitedOperation.peakMemory).toBeLessThan(512 * 1024 * 1024);
    });
  });
});