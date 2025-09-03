import { useCallback } from 'react'
import { UseAuditLoggerReturn, AuditEvent } from '../types/workflow-types'

export function useAuditLogger(): UseAuditLoggerReturn {
  
  const logAuditEvent = useCallback(async (event: AuditEvent): Promise<void> => {
    try {
      // Create complete audit event with timestamps and IDs
      const completeEvent: Required<AuditEvent> = {
        id: event.id || `AE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        action: event.action,
        timestamp: event.timestamp || new Date(),
        userId: event.userId || 'current-user@example.com',
        supplierId: event.supplierId,
        month: event.month,
        details: event.details,
        metadata: {
          userAgent: navigator.userAgent,
          ip: '127.0.0.1', // Would come from API in real implementation
          sessionId: getSessionId(),
          ...event.metadata
        },
        itemId: event.itemId,
        findingId: event.findingId,
        commentId: event.commentId,
        snapshotId: event.snapshotId
      }

      // Store in localStorage for development/testing
      const storageKey = `audit-log-${event.supplierId}-${event.month}`
      const existingLogs = getStoredLogs(storageKey)
      existingLogs.push(completeEvent)
      localStorage.setItem(storageKey, JSON.stringify(existingLogs))

      // In production, this would send to audit service
      console.log('Audit event logged:', completeEvent)

    } catch (error) {
      console.error('Failed to log audit event:', error)
      // In production, might want to queue for retry or send to error service
      throw error
    }
  }, [])

  const getAuditTrail = useCallback(async (
    supplierId: string, 
    month: string
  ): Promise<AuditEvent[]> => {
    try {
      const storageKey = `audit-log-${supplierId}-${month}`
      const logs = getStoredLogs(storageKey)
      
      // Sort by timestamp descending (newest first)
      return logs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    } catch (error) {
      console.error('Failed to get audit trail:', error)
      return []
    }
  }, [])

  const exportAuditTrail = useCallback(async (
    supplierId: string, 
    month: string, 
    format: 'json' | 'csv'
  ): Promise<string> => {
    try {
      const auditTrail = await getAuditTrail(supplierId, month)
      
      if (format === 'json') {
        return JSON.stringify(auditTrail, null, 2)
      } else if (format === 'csv') {
        return convertToCsv(auditTrail)
      } else {
        throw new Error(`Unsupported export format: ${format}`)
      }
    } catch (error) {
      console.error('Failed to export audit trail:', error)
      throw error
    }
  }, [getAuditTrail])

  return {
    logAuditEvent,
    getAuditTrail,
    exportAuditTrail
  }
}

// Helper functions
function getStoredLogs(storageKey: string): AuditEvent[] {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn('Failed to parse stored audit logs:', error)
    return []
  }
}

function getSessionId(): string {
  let sessionId = localStorage.getItem('granskad-session-id')
  if (!sessionId) {
    sessionId = `SESS-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    localStorage.setItem('granskad-session-id', sessionId)
  }
  return sessionId
}

function convertToCsv(events: AuditEvent[]): string {
  if (events.length === 0) {
    return 'No audit events found'
  }

  // CSV headers
  const headers = [
    'ID',
    'Action',
    'Timestamp',
    'User ID',
    'Supplier ID',
    'Month',
    'Details',
    'Item ID',
    'Finding ID',
    'Comment ID',
    'Snapshot ID',
    'IP Address',
    'User Agent'
  ]

  // CSV rows
  const rows = events.map(event => [
    event.id || '',
    event.action,
    event.timestamp?.toISOString() || '',
    event.userId || '',
    event.supplierId,
    event.month,
    event.details,
    event.itemId || '',
    event.findingId || '',
    event.commentId || '',
    event.snapshotId || '',
    event.metadata?.ip || '',
    event.metadata?.userAgent || ''
  ])

  // Escape CSV values
  const escapeCsvValue = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCsvValue(String(cell))).join(','))
  ].join('\n')

  return csvContent
}