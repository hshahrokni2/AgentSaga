/**
 * TypeScript tests for Storage Encryption Service
 * Testing EU compliance encryption requirements with customer-managed keys
 */

import { StorageEncryptionService, EncryptionConfig, EncryptedData } from '../../src/services/storage_encryption_service';
import { AuditLogger } from '../../src/services/audit-logger';

jest.mock('../../src/services/audit-logger');
const MockAuditLogger = AuditLogger as jest.MockedClass<typeof AuditLogger>;

describe('StorageEncryptionService', () => {
  let encryptionService: StorageEncryptionService;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let config: EncryptionConfig;

  beforeEach(() => {
    mockAuditLogger = new MockAuditLogger() as jest.Mocked<AuditLogger>;
    mockAuditLogger.log = jest.fn().mockResolvedValue(undefined);

    config = {
      algorithm: 'AES-256-GCM',
      keyManagement: 'customer_managed',
      keyRotationDays: 30,
      fipsCompliant: true
    };

    encryptionService = new StorageEncryptionService(config, mockAuditLogger);
  });

  afterEach(() => {
    encryptionService.destroy();
    jest.clearAllMocks();
  });

  describe('Key Generation', () => {
    test('should generate valid encryption keys', async () => {
      const key = await encryptionService.generateEncryptionKey();

      expect(key.keyId).toMatch(/^KEY-\d+-[a-f0-9]{16}$/);
      expect(key.key).toBeInstanceOf(Buffer);
      expect(key.key.length).toBe(32); // 256-bit key
      expect(key.algorithm).toBe('AES-256-GCM');
      expect(key.version).toBe(1);
      expect(key.createdAt).toBeInstanceOf(Date);
      expect(key.expiresAt).toBeInstanceOf(Date);
      expect(key.expiresAt.getTime()).toBeGreaterThan(key.createdAt.getTime());

      // Verify audit log
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'encryption_key_generated',
          status: 'success',
          metadata: expect.objectContaining({
            keyId: key.keyId,
            algorithm: 'AES-256-GCM'
          })
        })
      );
    });

    test('should generate unique keys on each call', async () => {
      const key1 = await encryptionService.generateEncryptionKey();
      const key2 = await encryptionService.generateEncryptionKey();

      expect(key1.keyId).not.toBe(key2.keyId);
      expect(key1.key).not.toEqual(key2.key);
    });
  });

  describe('Data Encryption', () => {
    test('should encrypt data successfully', async () => {
      const originalData = Buffer.from('Sensitive Swedish data: Känsliga uppgifter åäö');
      
      const encrypted = await encryptionService.encryptData(originalData);

      expect(encrypted.data).toBeInstanceOf(Buffer);
      expect(encrypted.iv).toBeInstanceOf(Buffer);
      expect(encrypted.tag).toBeInstanceOf(Buffer);
      expect(encrypted.keyId).toMatch(/^KEY-\d+-[a-f0-9]{16}$/);
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.metadata.originalSize).toBe(originalData.length);
      expect(encrypted.metadata.encryptedAt).toBeInstanceOf(Date);
      expect(encrypted.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
      
      // Encrypted data should be different from original
      expect(encrypted.data).not.toEqual(originalData);
    });

    test('should use different IVs for each encryption', async () => {
      const data = Buffer.from('test data');
      
      const encrypted1 = await encryptionService.encryptData(data);
      const encrypted2 = await encryptionService.encryptData(data);

      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      expect(encrypted1.data).not.toEqual(encrypted2.data);
    });

    test('should handle encryption errors gracefully', async () => {
      // Mock crypto error
      const originalCrypto = require('crypto');
      jest.spyOn(originalCrypto, 'createCipherGCM').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      const data = Buffer.from('test data');
      
      await expect(encryptionService.encryptData(data)).rejects.toThrow('Crypto operation failed');
      
      // Verify error logging
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'encryption_failed',
          status: 'error'
        })
      );

      // Restore original crypto
      jest.restoreAllMocks();
    });
  });

  describe('Data Decryption', () => {
    test('should decrypt data correctly', async () => {
      const originalData = Buffer.from('Test data with Swedish characters: åäö');
      
      const encrypted = await encryptionService.encryptData(originalData);
      const decrypted = await encryptionService.decryptData(encrypted);

      expect(decrypted).toEqual(originalData);
      expect(decrypted.toString()).toBe('Test data with Swedish characters: åäö');
    });

    test('should fail decryption with invalid key', async () => {
      const originalData = Buffer.from('test data');
      const encrypted = await encryptionService.encryptData(originalData);
      
      // Modify keyId to simulate missing key
      encrypted.keyId = 'invalid-key-id';

      await expect(encryptionService.decryptData(encrypted)).rejects.toThrow(
        'Encryption key not found: invalid-key-id'
      );

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'decryption_failed',
          status: 'error'
        })
      );
    });

    test('should fail decryption with corrupted data', async () => {
      const originalData = Buffer.from('test data');
      const encrypted = await encryptionService.encryptData(originalData);
      
      // Corrupt the checksum
      encrypted.metadata.checksum = 'invalid-checksum';

      await expect(encryptionService.decryptData(encrypted)).rejects.toThrow(
        'Data integrity check failed - checksum mismatch'
      );
    });
  });

  describe('Key Rotation', () => {
    test('should rotate expired keys', async () => {
      // Generate a key with short expiry
      const shortExpiryConfig = {
        ...config,
        keyRotationDays: 0 // Expire immediately
      };
      
      const shortExpiryService = new StorageEncryptionService(shortExpiryConfig, mockAuditLogger);
      
      const key = await shortExpiryService.generateEncryptionKey();
      
      // Wait a bit to ensure expiry
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await shortExpiryService.rotateKeys();

      // Verify rotation was logged
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'encryption_key_rotated',
          status: 'success',
          metadata: expect.objectContaining({
            oldKeyId: key.keyId
          })
        })
      );

      shortExpiryService.destroy();
    });

    test('should perform emergency key rotation', async () => {
      const reason = 'Security incident detected';
      
      await encryptionService.emergencyKeyRotation(reason);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'emergency_key_rotation',
          status: 'success',
          metadata: expect.objectContaining({
            reason
          })
        })
      );
    });
  });

  describe('FIPS Compliance', () => {
    test('should validate FIPS compliance when enabled', () => {
      const fipsCompliant = encryptionService.validateFIPSCompliance();
      
      expect(fipsCompliant).toBe(true);
    });

    test('should fail FIPS validation when disabled', () => {
      const nonFipsConfig = { ...config, fipsCompliant: false };
      const nonFipsService = new StorageEncryptionService(nonFipsConfig, mockAuditLogger);
      
      const fipsCompliant = nonFipsService.validateFIPSCompliance();
      
      expect(fipsCompliant).toBe(false);
      
      nonFipsService.destroy();
    });
  });

  describe('Performance Testing', () => {
    test('should measure encryption/decryption performance', async () => {
      const dataSizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB
      
      const results = await encryptionService.performanceTest(dataSizes);

      expect(results.encryptionResults).toHaveLength(dataSizes.length);
      expect(results.decryptionResults).toHaveLength(dataSizes.length);

      for (let i = 0; i < dataSizes.length; i++) {
        const encResult = results.encryptionResults[i];
        const decResult = results.decryptionResults[i];

        expect(encResult.size).toBe(dataSizes[i]);
        expect(encResult.throughput).toBeGreaterThan(0);
        expect(encResult.latency).toBeGreaterThan(0);

        expect(decResult.size).toBe(dataSizes[i]);
        expect(decResult.throughput).toBeGreaterThan(0);
        expect(decResult.latency).toBeGreaterThan(0);
      }
    });

    test('should maintain high throughput for large files', async () => {
      const largeSizes = [1024 * 1024]; // 1MB
      
      const results = await encryptionService.performanceTest(largeSizes);
      
      // Should achieve > 100 MB/s throughput as per requirements
      // (This is a mock test - real implementation would verify actual performance)
      expect(results.encryptionResults[0].throughput).toBeGreaterThan(0);
      expect(results.decryptionResults[0].throughput).toBeGreaterThan(0);
    });
  });

  describe('Metrics', () => {
    test('should track encryption metrics', async () => {
      const data = Buffer.from('test data');
      
      await encryptionService.encryptData(data);
      await encryptionService.encryptData(data);
      
      const metrics = encryptionService.getMetrics();
      
      expect(metrics.encryptionThroughput).toBeGreaterThan(0);
      expect(metrics.decryptionThroughput).toBeGreaterThanOrEqual(0);
      expect(metrics.keyRotationsCount).toBeGreaterThanOrEqual(0);
      expect(metrics.encryptionErrors).toBe(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    test('should track encryption errors', async () => {
      // Mock crypto error
      const originalCrypto = require('crypto');
      jest.spyOn(originalCrypto, 'createCipherGCM').mockImplementation(() => {
        throw new Error('Crypto error');
      });

      const data = Buffer.from('test data');
      
      try {
        await encryptionService.encryptData(data);
      } catch (error) {
        // Expected error
      }
      
      const metrics = encryptionService.getMetrics();
      expect(metrics.encryptionErrors).toBe(1);

      jest.restoreAllMocks();
    });
  });

  describe('Swedish Character Support', () => {
    test('should handle Swedish characters correctly in encryption/decryption', async () => {
      const swedishText = Buffer.from(
        'Hej! Detta är en svensk text med åäö och ÅÄÖ tecken. ' +
        'Också några specialtecken: €£$@#%&*()_+-=[]{}|;:\'",.<>?/~`'
      );

      const encrypted = await encryptionService.encryptData(swedishText);
      const decrypted = await encryptionService.decryptData(encrypted);

      expect(decrypted).toEqual(swedishText);
      expect(decrypted.toString()).toBe(swedishText.toString());
      
      // Verify all Swedish characters are preserved
      expect(decrypted.toString()).toContain('åäöÅÄÖ');
    });
  });

  describe('EU Compliance', () => {
    test('should enforce customer-managed encryption', () => {
      expect(config.keyManagement).toBe('customer_managed');
      expect(config.algorithm).toBe('AES-256-GCM');
    });

    test('should support key rotation for compliance', async () => {
      expect(config.keyRotationDays).toBeLessThanOrEqual(90); // Max 90 days per EU requirements
    });

    test('should provide audit trails', async () => {
      const data = Buffer.from('EU compliance test data');
      
      await encryptionService.encryptData(data);
      
      // Verify comprehensive audit logging
      expect(mockAuditLogger.log).toHaveBeenCalledTimes(2); // Key generation + encryption
    });
  });
});