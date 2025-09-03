/**
 * Custom exceptions for Agent Guardrails & Safety System
 * Provides specific error types for different safety violations and scenarios
 */

/**
 * Exception thrown when PII is detected and requires special handling
 */
export class PIIDetectionError extends Error {
  public detectionId?: string
  
  constructor(message: string, detectionId?: string) {
    super(message)
    this.name = 'PIIDetectionError'
    this.detectionId = detectionId
  }
}

/**
 * Exception thrown when a policy violation is detected
 */
export class PolicyViolationError extends Error {
  public violation_type: string
  public severity: string
  
  constructor(message: string, violation_type: string, severity: string = 'high') {
    super(message)
    this.name = 'PolicyViolationError'
    this.violation_type = violation_type
    this.severity = severity
  }
}

/**
 * Exception thrown when an unauthorized action is attempted
 */
export class UnauthorizedActionError extends Error {
  public action: string
  public userId: string
  
  constructor(message: string, action: string, userId: string) {
    super(message)
    this.name = 'UnauthorizedActionError'
    this.action = action
    this.userId = userId
  }
}

/**
 * Exception thrown when confirmation is required but not provided
 */
export class ConfirmationRequiredError extends Error {
  public proposalId: string
  
  constructor(message: string, proposalId: string) {
    super(message)
    this.name = 'ConfirmationRequiredError'
    this.proposalId = proposalId
  }
}

/**
 * Exception thrown when action traceability fails
 */
export class TraceabilityError extends Error {
  public traceId?: string
  
  constructor(message: string, traceId?: string) {
    super(message)
    this.name = 'TraceabilityError'
    this.traceId = traceId
  }
}