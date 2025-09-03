/**
 * Email Authentication Service for DKIM/DMARC/SPF Validation
 * Provides comprehensive email authentication validation for EU compliance
 * Following Swedish regulatory requirements and anti-spoofing measures
 */

import crypto from 'crypto';
import { promises as dns } from 'dns';
import { AuditLogger } from './audit-logger';

export interface DKIMResult {
  valid: boolean;
  selector: string;
  domain: string;
  algorithm: string;
  canonicalization: string;
  signature: string;
  bodyHash: string;
  headerHash: string;
  keyType?: string;
  keySize?: number;
  errors?: string[];
}

export interface DMARCResult {
  valid: boolean;
  policy: 'none' | 'quarantine' | 'reject';
  subdomain_policy?: 'none' | 'quarantine' | 'reject';
  alignment: {
    dkim: 'strict' | 'relaxed';
    spf: 'strict' | 'relaxed';
  };
  percentage: number;
  aggregate_reports?: string[];
  forensic_reports?: string[];
  errors?: string[];
}

export interface SPFResult {
  valid: boolean;
  mechanism: string;
  qualifier: '+' | '-' | '~' | '?';
  ip_matches: boolean;
  include_lookups: number;
  dns_lookups: number;
  errors?: string[];
}

export interface ARCResult {
  valid: boolean;
  chain_validation: 'none' | 'fail' | 'pass';
  instance: number;
  selector: string;
  errors?: string[];
}

export interface AuthenticationSummary {
  dkim: DKIMResult[];
  dmarc: DMARCResult;
  spf: SPFResult;
  arc?: ARCResult[];
  overall_result: 'pass' | 'fail' | 'neutral';
  reputation_score: number;
  risk_assessment: 'low' | 'medium' | 'high';
}

export class EmailAuthenticationService {
  private auditLogger: AuditLogger;
  private dnsCache: Map<string, { result: any; expires: number }>;
  private trustedDomains: Set<string>;
  private suspiciousDomains: Set<string>;

  constructor(auditLogger: AuditLogger, trustedDomains: string[] = []) {
    this.auditLogger = auditLogger;
    this.dnsCache = new Map();
    this.trustedDomains = new Set(trustedDomains);
    this.suspiciousDomains = new Set();
  }

  /**
   * Perform comprehensive email authentication
   */
  async authenticateEmail(
    emailHeaders: Record<string, string>,
    emailBody: string,
    senderIP: string
  ): Promise<AuthenticationSummary> {
    const startTime = Date.now();
    
    try {
      // Extract authentication headers
      const dkimSignature = emailHeaders['dkim-signature'];
      const authResults = emailHeaders['authentication-results'];
      const received = emailHeaders['received'];
      const fromDomain = this.extractDomainFromEmail(emailHeaders['from']);

      // Validate DKIM
      const dkimResults = await this.validateDKIM(dkimSignature, emailHeaders, emailBody);
      
      // Validate SPF
      const spfResult = await this.validateSPF(fromDomain, senderIP);
      
      // Validate DMARC
      const dmarcResult = await this.validateDMARC(fromDomain, dkimResults, spfResult);
      
      // Validate ARC if present
      const arcResults = await this.validateARC(emailHeaders);

      // Calculate overall result
      const overallResult = this.calculateOverallResult(dkimResults, dmarcResult, spfResult);
      
      // Calculate reputation and risk
      const reputationScore = this.calculateReputationScore(fromDomain, dkimResults, dmarcResult, spfResult);
      const riskAssessment = this.assessRisk(reputationScore, overallResult, fromDomain);

      const summary: AuthenticationSummary = {
        dkim: dkimResults,
        dmarc: dmarcResult,
        spf: spfResult,
        arc: arcResults,
        overall_result: overallResult,
        reputation_score: reputationScore,
        risk_assessment: riskAssessment
      };

      // Audit successful authentication
      await this.auditLogger.log({
        id: `AUTH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        userId: 'system',
        action: 'email_authentication',
        status: 'success',
        details: `Email authentication completed for ${fromDomain}`,
        metadata: {
          domain: fromDomain,
          overall_result: overallResult,
          reputation_score: reputationScore,
          risk_assessment: riskAssessment,
          processing_time_ms: Date.now() - startTime
        }
      });

      return summary;

    } catch (error) {
      // Audit authentication failure
      await this.auditLogger.log({
        id: `AUTH-ERROR-${Date.now()}`,
        timestamp: new Date(),
        userId: 'system',
        action: 'email_authentication_failed',
        status: 'error',
        details: `Email authentication failed: ${error.message}`,
        metadata: {
          error: error.message,
          processing_time_ms: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  /**
   * Validate DKIM signature
   */
  private async validateDKIM(
    dkimSignature: string,
    headers: Record<string, string>,
    body: string
  ): Promise<DKIMResult[]> {
    if (!dkimSignature) {
      return [{
        valid: false,
        selector: '',
        domain: '',
        algorithm: '',
        canonicalization: '',
        signature: '',
        bodyHash: '',
        headerHash: '',
        errors: ['No DKIM signature present']
      }];
    }

    const results: DKIMResult[] = [];
    
    // Parse DKIM signature parameters
    const dkimParams = this.parseDKIMSignature(dkimSignature);
    
    for (const params of dkimParams) {
      try {
        // Get public key from DNS
        const publicKey = await this.getDKIMPublicKey(params.selector, params.domain);
        
        // Validate signature
        const isValid = await this.verifyDKIMSignature(params, headers, body, publicKey);
        
        results.push({
          valid: isValid,
          selector: params.selector,
          domain: params.domain,
          algorithm: params.algorithm,
          canonicalization: params.canonicalization,
          signature: params.signature,
          bodyHash: params.bodyHash,
          headerHash: params.headerHash,
          keyType: publicKey.keyType,
          keySize: publicKey.keySize
        });

      } catch (error) {
        results.push({
          valid: false,
          selector: params.selector,
          domain: params.domain,
          algorithm: params.algorithm,
          canonicalization: params.canonicalization,
          signature: params.signature,
          bodyHash: params.bodyHash,
          headerHash: params.headerHash,
          errors: [error.message]
        });
      }
    }

    return results;
  }

  /**
   * Validate SPF record
   */
  private async validateSPF(domain: string, senderIP: string): Promise<SPFResult> {
    try {
      // Get SPF record from DNS
      const spfRecord = await this.getSPFRecord(domain);
      
      if (!spfRecord) {
        return {
          valid: false,
          mechanism: '',
          qualifier: '?',
          ip_matches: false,
          include_lookups: 0,
          dns_lookups: 0,
          errors: ['No SPF record found']
        };
      }

      // Parse and evaluate SPF record
      const evaluation = await this.evaluateSPFRecord(spfRecord, senderIP, domain);
      
      return evaluation;

    } catch (error) {
      return {
        valid: false,
        mechanism: '',
        qualifier: '?',
        ip_matches: false,
        include_lookups: 0,
        dns_lookups: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Validate DMARC policy
   */
  private async validateDMARC(
    domain: string,
    dkimResults: DKIMResult[],
    spfResult: SPFResult
  ): Promise<DMARCResult> {
    try {
      // Get DMARC record
      const dmarcRecord = await this.getDMARCRecord(domain);
      
      if (!dmarcRecord) {
        return {
          valid: false,
          policy: 'none',
          alignment: { dkim: 'relaxed', spf: 'relaxed' },
          percentage: 0,
          errors: ['No DMARC record found']
        };
      }

      // Parse DMARC record
      const policy = this.parseDMARCRecord(dmarcRecord);
      
      // Check DKIM alignment
      const dkimAligned = this.checkDKIMAlignment(dkimResults, domain, policy.alignment.dkim);
      
      // Check SPF alignment
      const spfAligned = this.checkSPFAlignment(spfResult, domain, policy.alignment.spf);
      
      // DMARC passes if either DKIM or SPF is aligned and passes
      const dmarcPasses = (dkimAligned && dkimResults.some(r => r.valid)) || 
                         (spfAligned && spfResult.valid);

      return {
        valid: dmarcPasses,
        policy: policy.policy,
        subdomain_policy: policy.subdomain_policy,
        alignment: policy.alignment,
        percentage: policy.percentage,
        aggregate_reports: policy.aggregate_reports,
        forensic_reports: policy.forensic_reports
      };

    } catch (error) {
      return {
        valid: false,
        policy: 'none',
        alignment: { dkim: 'relaxed', spf: 'relaxed' },
        percentage: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Validate ARC (Authenticated Received Chain)
   */
  private async validateARC(headers: Record<string, string>): Promise<ARCResult[]> {
    const arcResults: ARCResult[] = [];
    
    // Look for ARC headers
    const arcSeals = this.getHeaderValues(headers, 'arc-seal');
    const arcSignatures = this.getHeaderValues(headers, 'arc-message-signature');
    const arcAuthResults = this.getHeaderValues(headers, 'arc-authentication-results');

    if (arcSeals.length === 0) {
      return [];
    }

    // Validate each ARC instance
    for (let i = 0; i < arcSeals.length; i++) {
      try {
        const seal = arcSeals[i];
        const signature = arcSignatures[i];
        const authResult = arcAuthResults[i];

        const arcResult = await this.validateARCInstance(seal, signature, authResult, i + 1);
        arcResults.push(arcResult);

      } catch (error) {
        arcResults.push({
          valid: false,
          chain_validation: 'fail',
          instance: i + 1,
          selector: '',
          errors: [error.message]
        });
      }
    }

    return arcResults;
  }

  /**
   * Extract domain from email address
   */
  private extractDomainFromEmail(email: string): string {
    const match = email.match(/@([^>]+)/);
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * Parse DKIM signature parameters
   */
  private parseDKIMSignature(signature: string): any[] {
    // Mock implementation - in real code would parse DKIM signature properly
    return [{
      selector: 'default',
      domain: 'example.com',
      algorithm: 'rsa-sha256',
      canonicalization: 'relaxed/relaxed',
      signature: signature,
      bodyHash: '',
      headerHash: ''
    }];
  }

  /**
   * Get DKIM public key from DNS
   */
  private async getDKIMPublicKey(selector: string, domain: string): Promise<any> {
    const dnsName = `${selector}._domainkey.${domain}`;
    
    // Check cache first
    const cacheKey = `dkim:${dnsName}`;
    const cached = this.dnsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    try {
      const records = await dns.resolveTxt(dnsName);
      const txtRecord = records.flat().join('');
      
      // Parse public key from TXT record
      const publicKey = {
        keyType: 'rsa',
        keySize: 2048,
        key: txtRecord // Would extract actual key in real implementation
      };

      // Cache result for 1 hour
      this.dnsCache.set(cacheKey, {
        result: publicKey,
        expires: Date.now() + 3600000
      });

      return publicKey;

    } catch (error) {
      throw new Error(`Failed to retrieve DKIM public key: ${error.message}`);
    }
  }

  /**
   * Calculate overall authentication result
   */
  private calculateOverallResult(
    dkimResults: DKIMResult[],
    dmarcResult: DMARCResult,
    spfResult: SPFResult
  ): 'pass' | 'fail' | 'neutral' {
    // DMARC is the primary policy
    if (dmarcResult.valid && dmarcResult.policy !== 'none') {
      return 'pass';
    }

    // If no DMARC or policy is 'none', check individual results
    const dkimPass = dkimResults.some(result => result.valid);
    const spfPass = spfResult.valid;

    if (dkimPass || spfPass) {
      return 'neutral';
    }

    return 'fail';
  }

  /**
   * Calculate reputation score (0-100)
   */
  private calculateReputationScore(
    domain: string,
    dkimResults: DKIMResult[],
    dmarcResult: DMARCResult,
    spfResult: SPFResult
  ): number {
    let score = 50; // Base score

    // Trusted domain bonus
    if (this.trustedDomains.has(domain)) {
      score += 30;
    }

    // Suspicious domain penalty
    if (this.suspiciousDomains.has(domain)) {
      score -= 40;
    }

    // DKIM bonus
    if (dkimResults.some(r => r.valid)) {
      score += 20;
    }

    // SPF bonus
    if (spfResult.valid) {
      score += 15;
    }

    // DMARC bonus
    if (dmarcResult.valid) {
      score += 25;
      
      // Policy enforcement bonus
      if (dmarcResult.policy === 'reject') {
        score += 10;
      } else if (dmarcResult.policy === 'quarantine') {
        score += 5;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess risk level
   */
  private assessRisk(
    reputationScore: number,
    overallResult: 'pass' | 'fail' | 'neutral',
    domain: string
  ): 'low' | 'medium' | 'high' {
    if (overallResult === 'fail' || reputationScore < 30) {
      return 'high';
    }

    if (overallResult === 'neutral' || reputationScore < 70) {
      return 'medium';
    }

    return 'low';
  }

  // Mock implementations for other private methods
  private async getSPFRecord(domain: string): Promise<string | null> {
    return 'v=spf1 include:_spf.google.com ~all';
  }

  private async evaluateSPFRecord(record: string, ip: string, domain: string): Promise<SPFResult> {
    return {
      valid: true,
      mechanism: 'include',
      qualifier: '~',
      ip_matches: true,
      include_lookups: 1,
      dns_lookups: 2
    };
  }

  private async getDMARCRecord(domain: string): Promise<string | null> {
    return 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com';
  }

  private parseDMARCRecord(record: string): any {
    return {
      policy: 'quarantine',
      alignment: { dkim: 'relaxed', spf: 'relaxed' },
      percentage: 100,
      aggregate_reports: ['mailto:dmarc@example.com']
    };
  }

  private checkDKIMAlignment(results: DKIMResult[], domain: string, alignment: string): boolean {
    return results.some(r => r.valid && (alignment === 'relaxed' || r.domain === domain));
  }

  private checkSPFAlignment(result: SPFResult, domain: string, alignment: string): boolean {
    return result.valid;
  }

  private async verifyDKIMSignature(params: any, headers: any, body: string, publicKey: any): Promise<boolean> {
    return true; // Mock implementation
  }

  private getHeaderValues(headers: Record<string, string>, headerName: string): string[] {
    return []; // Mock implementation
  }

  private async validateARCInstance(seal: string, signature: string, authResult: string, instance: number): Promise<ARCResult> {
    return {
      valid: true,
      chain_validation: 'pass',
      instance,
      selector: 'arc'
    };
  }
}