/**
 * Email Webhook Processor for EU/EES Compliant Email Infrastructure
 * Handles SES webhook notifications, DKIM/DMARC validation, and attachment processing
 * Following Swedish regulatory requirements and GDPR compliance
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { AuditLogger, AuditEntry } from './audit-logger';
import { ObjectStorageClient } from './object-storage-client';
import { formatSwedishDate } from '../../lib/utils';

export interface WebhookPayload {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  UnsubscribeURL?: string;
}

export interface EmailMessage {
  messageId: string;
  timestamp: Date;
  source: string;
  destination: string[];
  subject: string;
  commonHeaders: Record<string, any>;
  content?: string;
  attachments?: EmailAttachment[];
  dkimVerdict?: DKIMVerdict;
  dmarcVerdict?: DMARCVerdict;
  spfVerdict?: SPFVerdict;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  checksum: string;
}

export interface DKIMVerdict {
  status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED';
  details?: string;
}

export interface DMARCVerdict {
  status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED';
  policy: 'none' | 'quarantine' | 'reject';
  alignment: 'strict' | 'relaxed';
}

export interface SPFVerdict {
  status: 'PASS' | 'FAIL' | 'GRAY' | 'PROCESSING_FAILED';
}

export interface ProcessingResult {
  success: boolean;
  messageId: string;
  attachmentCount: number;
  totalSize: number;
  processingTime: number;
  errors?: string[];
  storageKeys?: string[];
}

export class EmailWebhookProcessor {
  private auditLogger: AuditLogger;
  private storageClient: ObjectStorageClient;
  private allowedFileTypes: Set<string>;
  private maxAttachmentSize: number;
  private hmacSecret: string;
  private processedMessages: Set<string>;

  constructor(options: {
    auditLogger: AuditLogger;
    storageClient: ObjectStorageClient;
    allowedFileTypes?: string[];
    maxAttachmentSize?: number;
    hmacSecret: string;
  }) {
    this.auditLogger = options.auditLogger;
    this.storageClient = options.storageClient;
    this.allowedFileTypes = new Set(options.allowedFileTypes || ['xlsx', 'csv', 'xls']);
    this.maxAttachmentSize = options.maxAttachmentSize || 25 * 1024 * 1024; // 25MB
    this.hmacSecret = options.hmacSecret;
    this.processedMessages = new Set();
  }

  /**
   * Process webhook notification from SES
   */
  async processWebhook(payload: WebhookPayload, headers: Record<string, string>): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload, headers)) {
        throw new Error('Invalid webhook signature');
      }

      // Parse the SNS message
      const message = JSON.parse(payload.Message);
      
      // Check for idempotency
      if (this.processedMessages.has(message.mail.messageId)) {
        return {
          success: true,
          messageId: message.mail.messageId,
          attachmentCount: 0,
          totalSize: 0,
          processingTime: Date.now() - startTime
        };
      }

      // Extract email details
      const emailMessage = this.parseEmailMessage(message);
      
      // Validate DKIM/DMARC/SPF
      await this.validateEmailAuthentication(emailMessage);
      
      // Process attachments
      const attachmentResults = await this.processAttachments(emailMessage);
      
      // Store processed message ID for idempotency
      this.processedMessages.add(emailMessage.messageId);
      
      // Log successful processing
      await this.auditLogger.log({
        id: `EMAIL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        userId: 'system',
        action: 'email_processed',
        status: 'success',
        details: `Processed email from ${emailMessage.source} with ${attachmentResults.length} attachments`,
        metadata: {
          messageId: emailMessage.messageId,
          source: emailMessage.source,
          attachmentCount: attachmentResults.length,
          totalSize: attachmentResults.reduce((sum, att) => sum + att.size, 0)
        }
      });

      return {
        success: true,
        messageId: emailMessage.messageId,
        attachmentCount: attachmentResults.length,
        totalSize: attachmentResults.reduce((sum, att) => sum + att.size, 0),
        processingTime: Date.now() - startTime,
        storageKeys: attachmentResults.map(att => att.filename)
      };

    } catch (error) {
      // Log processing error
      await this.auditLogger.log({
        id: `EMAIL-ERROR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        userId: 'system',
        action: 'email_processing_failed',
        status: 'error',
        details: `Failed to process webhook: ${error.message}`,
        metadata: {
          error: error.message,
          payload: payload
        }
      });

      return {
        success: false,
        messageId: payload.MessageId,
        attachmentCount: 0,
        totalSize: 0,
        processingTime: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  /**
   * Verify HMAC signature of webhook
   */
  private verifyWebhookSignature(payload: WebhookPayload, headers: Record<string, string>): boolean {
    const signature = headers['x-amz-sns-message-signature'] || headers['X-Amz-Sns-Message-Signature'];
    if (!signature) {
      return false;
    }

    const timestamp = headers['x-amz-sns-timestamp'] || headers['X-Amz-Sns-Timestamp'];
    const timestampMs = new Date(timestamp).getTime();
    const now = Date.now();
    
    // Check timestamp tolerance (5 minutes)
    if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
      return false;
    }

    // Create signature payload
    const signaturePayload = [
      'Message', payload.Message,
      'MessageId', payload.MessageId,
      'Timestamp', payload.Timestamp,
      'TopicArn', payload.TopicArn,
      'Type', payload.Type
    ].join('\n') + '\n';

    const expectedSignature = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(signaturePayload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  }

  /**
   * Parse SES message into EmailMessage structure
   */
  private parseEmailMessage(sesMessage: any): EmailMessage {
    return {
      messageId: sesMessage.mail.messageId,
      timestamp: new Date(sesMessage.mail.timestamp),
      source: sesMessage.mail.source,
      destination: sesMessage.mail.destination,
      subject: sesMessage.mail.commonHeaders.subject,
      commonHeaders: sesMessage.mail.commonHeaders,
      dkimVerdict: sesMessage.receipt?.dkimVerdict,
      dmarcVerdict: sesMessage.receipt?.dmarcVerdict,
      spfVerdict: sesMessage.receipt?.spfVerdict
    };
  }

  /**
   * Validate email authentication (DKIM/DMARC/SPF)
   */
  private async validateEmailAuthentication(email: EmailMessage): Promise<void> {
    // Check DKIM verdict
    if (email.dkimVerdict?.status !== 'PASS') {
      throw new Error(`DKIM validation failed: ${email.dkimVerdict?.status}`);
    }

    // Check DMARC verdict
    if (email.dmarcVerdict?.status !== 'PASS') {
      // In strict mode, reject emails with DMARC failures
      if (email.dmarcVerdict?.policy === 'reject') {
        throw new Error(`DMARC validation failed with reject policy: ${email.dmarcVerdict?.status}`);
      }
    }

    // Check SPF verdict
    if (email.spfVerdict?.status !== 'PASS') {
      throw new Error(`SPF validation failed: ${email.spfVerdict?.status}`);
    }
  }

  /**
   * Process email attachments
   */
  private async processAttachments(email: EmailMessage): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    if (!email.attachments || email.attachments.length === 0) {
      return attachments;
    }

    for (const attachment of email.attachments) {
      // Validate file type
      const fileExtension = path.extname(attachment.filename).toLowerCase().slice(1);
      if (!this.allowedFileTypes.has(fileExtension)) {
        throw new Error(`File type not allowed: ${fileExtension}`);
      }

      // Validate file size
      if (attachment.size > this.maxAttachmentSize) {
        throw new Error(`File size exceeds limit: ${attachment.size} bytes`);
      }

      // Calculate checksum
      const checksum = crypto
        .createHash('sha256')
        .update(attachment.content)
        .digest('hex');

      // Store attachment in object storage
      const storageKey = `attachments/${email.messageId}/${attachment.filename}`;
      await this.storageClient.uploadEvidencePack(storageKey, attachment.content);

      attachments.push({
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        content: attachment.content,
        checksum
      });
    }

    return attachments;
  }

  /**
   * Extract text content from XLSX file for Swedish text processing
   */
  async extractXLSXContent(buffer: Buffer): Promise<string[][]> {
    // Mock implementation - in real code would use xlsx library
    return [
      ['Leverantör', 'Avfallstyp', 'Mängd (kg)', 'Datum'],
      ['Stockholms Renhållning', 'Hushållsavfall', '1250.5', formatSwedishDate(new Date())],
      ['Göteborg Stad', 'Återvinning', '850.0', formatSwedishDate(new Date())]
    ];
  }

  /**
   * Get processing metrics
   */
  getMetrics(): {
    totalProcessed: number;
    totalAttachments: number;
    averageProcessingTime: number;
    errorRate: number;
  } {
    return {
      totalProcessed: this.processedMessages.size,
      totalAttachments: 0, // Would track this in real implementation
      averageProcessingTime: 0, // Would calculate this in real implementation
      errorRate: 0 // Would calculate this in real implementation
    };
  }

  /**
   * Health check for email processing service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      // Check storage connectivity
      const storageMetrics = await this.storageClient.getStorageMetrics();
      
      // Check audit logger connectivity
      await this.auditLogger.log({
        id: `HEALTH-${Date.now()}`,
        timestamp: new Date(),
        userId: 'system',
        action: 'health_check',
        status: 'success',
        details: 'Email processor health check'
      });

      return {
        status: 'healthy',
        details: {
          storageConnected: true,
          auditLoggerConnected: true,
          processedMessagesCount: this.processedMessages.size,
          storageMetrics
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}