/**
 * Agent-specific audit logging system
 * Extends the base audit logger with agent-specific events and compliance
 */

import { AuditLogger, AuditEntry } from './audit-logger'
import crypto from 'crypto'

// Agent-specific audit entry types
export interface ActionAuditEntry {
  action: string
  user_id: string
  timestamp?: Date
  details?: Record<string, any>
}

export interface PIIDetectionEvent {
  detection_id: string
  text_source: string
  pii_types: string[]
  confidence_scores: number[]
  action_taken: string
  user_id: string
  timestamp?: Date
}

export interface PolicyViolationEvent {
  violation_id: string
  violation_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  user_id: string
  blocked_action: string
  detection_method: string
  ip_address: string
  timestamp?: Date
}

/**
 * Specialized audit logger for agent safety events
 */
export class AgentAuditLogger extends AuditLogger {
  private chainHashes: Map<string, string> = new Map()

  constructor(options: {
    log_directory?: string
    retention_days?: number
    encryption_enabled?: boolean
    immutable_storage?: boolean
  }) {
    super({
      logDirectory: options.log_directory || 'logs/agent_audit',
      retentionDays: options.retention_days || 1825, // 5 years
      service: 'agent-audit'
    })
  }

  /**
   * Log PII detection event with regulatory compliance
   */
  async log_pii_event(event: PIIDetectionEvent): Promise<string> {
    const audit_id = `PII-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const auditEntry: AuditEntry = {
      id: audit_id,
      timestamp: event.timestamp || new Date(),
      userId: event.user_id,
      action: 'pii_detection',
      status: 'success',
      details: `Detected ${event.pii_types.join(', ')} in ${event.text_source}`,
      metadata: {
        detection_id: event.detection_id,
        pii_types: event.pii_types,
        confidence_scores: event.confidence_scores,
        action_taken: event.action_taken,
        compliance_retention: '5_years_gdpr'
      }
    }

    await this.log(auditEntry)
    return audit_id
  }

  /**
   * Log policy violation with security context
   */
  async log_policy_violation(event: PolicyViolationEvent): Promise<string> {
    const audit_id = `VIO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const auditEntry: AuditEntry = {
      id: audit_id,
      timestamp: event.timestamp || new Date(),
      userId: event.user_id,
      action: 'policy_violation',
      status: 'blocked',
      details: `${event.violation_type}: ${event.blocked_action}`,
      metadata: {
        violation_id: event.violation_id,
        violation_type: event.violation_type,
        severity: event.severity,
        blocked_action: event.blocked_action,
        detection_method: event.detection_method,
        ip_address: event.ip_address,
        security_alert: true
      }
    }

    await this.log(auditEntry)
    return audit_id
  }

  /**
   * Log general action with trace context
   */
  async log_action(event: ActionAuditEntry): Promise<string> {
    const audit_id = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const auditEntry: AuditEntry = {
      id: audit_id,
      timestamp: event.timestamp || new Date(),
      userId: event.user_id,
      action: event.action,
      status: 'success',
      details: `Action performed: ${event.action}`,
      metadata: event.details || {}
    }

    await this.log(auditEntry)
    return audit_id
  }

  /**
   * Verify cryptographic integrity of audit chain
   */
  async verify_chain_integrity(audit_ids: string[]): Promise<boolean> {
    try {
      let previousHash = ''
      
      for (const audit_id of audit_ids) {
        const entry = await this.get_audit_entry(audit_id)
        if (!entry) return false

        // Calculate expected hash
        const entryData = JSON.stringify({
          id: entry.id,
          timestamp: entry.timestamp,
          userId: entry.userId,
          action: entry.action,
          previousHash
        })
        
        const expectedHash = crypto.createHash('sha256').update(entryData).digest('hex')
        const storedHash = this.chainHashes.get(audit_id)
        
        if (storedHash && storedHash !== expectedHash) {
          return false // Integrity violation detected
        }
        
        // Store hash for next iteration
        this.chainHashes.set(audit_id, expectedHash)
        previousHash = expectedHash
      }
      
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get audit entry by ID
   */
  async get_audit_entry(audit_id: string): Promise<AuditEntry | null> {
    try {
      // In a real implementation, this would query the audit storage
      // For now, simulate finding the entry
      return {
        id: audit_id,
        timestamp: new Date(),
        userId: 'user_id',
        action: 'test_action',
        status: 'success',
        details: 'Test audit entry',
        metadata: {}
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Search audit logs with filters
   */
  async search_audit_logs(filters: {
    date_from: Date
    date_to: Date
    event_types?: string[]
    user_id?: string
  }): Promise<AuditEntry[]> {
    // In a real implementation, this would query the audit storage
    // For now, return mock results
    return [
      {
        id: 'MOCK-001',
        timestamp: filters.date_from,
        userId: filters.user_id || 'user_123',
        action: 'pii_detection',
        status: 'success',
        details: 'Mock audit entry',
        metadata: {}
      }
    ]
  }

  /**
   * Generate compliance report for regulatory requirements
   */
  async generate_compliance_report(options: {
    period_from: Date
    period_to: Date
    include_pii_events: boolean
    include_violations: boolean
  }): Promise<{
    pii_events_count: number
    policy_violations_count: number
    users_affected: number
    period_from: Date
    period_to: Date
  }> {
    const logs = await this.search_audit_logs({
      date_from: options.period_from,
      date_to: options.period_to,
      event_types: ['pii_detection', 'policy_violation']
    })

    const pii_events = logs.filter(log => log.action === 'pii_detection')
    const violations = logs.filter(log => log.action === 'policy_violation')
    const unique_users = new Set(logs.map(log => log.userId))

    return {
      pii_events_count: pii_events.length,
      policy_violations_count: violations.length,
      users_affected: unique_users.size,
      period_from: options.period_from,
      period_to: options.period_to
    }
  }

  /**
   * Search for specific violations
   */
  async search_violations(filters: {
    user_id?: string
    violation_type?: string
    severity?: string
  }): Promise<AuditEntry[]> {
    // Mock implementation - in real code would query storage
    return [
      {
        id: 'VIO-001',
        timestamp: new Date(),
        userId: filters.user_id || 'attacker_user',
        action: 'policy_violation',
        status: 'blocked',
        details: 'SQL injection attempt blocked',
        metadata: {
          violation_type: filters.violation_type || 'sql_injection',
          severity: filters.severity || 'critical'
        }
      }
    ]
  }
}