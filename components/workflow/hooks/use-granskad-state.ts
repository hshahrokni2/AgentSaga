import { useState, useCallback, useEffect } from 'react'
import { 
  GranskadState, 
  UseGranskadStateReturn, 
  StateTransition, 
  ClearanceStatus 
} from '../types/workflow-types'

export function useGranskadState(
  initialState: GranskadState,
  supplierId: string,
  month: string
): UseGranskadStateReturn {
  const [currentState, setCurrentState] = useState<GranskadState>(initialState)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [history, setHistory] = useState<StateTransition[]>([])
  const [clearanceStatus, setClearanceStatus] = useState<ClearanceStatus | null>(null)

  const storageKey = `granskad-state-${supplierId}-${month}`

  // Load persisted state on mount
  useEffect(() => {
    const savedState = localStorage.getItem(storageKey)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        setCurrentState(parsed.currentState || initialState)
        setHistory(parsed.history || [])
      } catch (error) {
        console.warn('Failed to load saved state:', error)
      }
    }
  }, [storageKey, initialState])

  // Persist state changes
  useEffect(() => {
    const stateData = {
      currentState,
      history,
      lastUpdated: new Date().toISOString()
    }
    localStorage.setItem(storageKey, JSON.stringify(stateData))
  }, [currentState, history, storageKey])

  // Update clearance status when state changes
  useEffect(() => {
    updateClearanceStatus()
  }, [currentState])

  const updateClearanceStatus = useCallback(async () => {
    try {
      // Mock clearance status calculation
      const status: ClearanceStatus = {
        status: currentState === 'fully_reviewed' ? 'green' : 'orange',
        score: currentState === 'fully_reviewed' ? 100 : currentState === 'in_progress' ? 60 : 20,
        blockers: currentState === 'unreviewed' ? ['Granskning ej påbörjad'] : [],
        lastUpdated: new Date()
      }
      
      setClearanceStatus(status)
    } catch (error) {
      console.error('Failed to update clearance status:', error)
    }
  }, [currentState])

  const canTransitionTo = useCallback((targetState: GranskadState): boolean => {
    const validTransitions: Record<GranskadState, GranskadState[]> = {
      'unreviewed': ['in_progress'],
      'in_progress': ['fully_reviewed', 'unreviewed'], // Allow going back
      'fully_reviewed': [] // Terminal state
    }

    return validTransitions[currentState]?.includes(targetState) ?? false
  }, [currentState])

  const transitionTo = useCallback(async (targetState: GranskadState): Promise<void> => {
    if (!canTransitionTo(targetState)) {
      throw new Error(`Ogiltig övergång från ${currentState} till ${targetState}`)
    }

    if (isTransitioning) {
      throw new Error('En övergång pågår redan')
    }

    setIsTransitioning(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create state transition record
      const transition: StateTransition = {
        id: `ST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        fromState: currentState,
        toState: targetState,
        timestamp: new Date(),
        userId: 'current-user@example.com', // Would come from auth context
        reason: getTransitionReason(currentState, targetState),
        metadata: {
          supplierId,
          month,
          userAgent: navigator.userAgent,
          ip: '127.0.0.1' // Would come from API
        }
      }

      // Update state and history
      setCurrentState(targetState)
      setHistory(prev => [...prev, transition])

      // Log state transition
      console.log(`State transitioned from ${currentState} to ${targetState}`, transition)

    } catch (error) {
      console.error('State transition failed:', error)
      throw error
    } finally {
      setIsTransitioning(false)
    }
  }, [currentState, canTransitionTo, isTransitioning, supplierId, month])

  const getTransitionReason = (from: GranskadState, to: GranskadState): string => {
    if (from === 'unreviewed' && to === 'in_progress') {
      return 'Granskning påbörjad av användare'
    }
    if (from === 'in_progress' && to === 'fully_reviewed') {
      return 'Granskning slutförd - alla obligatoriska punkter genomförda'
    }
    if (from === 'in_progress' && to === 'unreviewed') {
      return 'Granskning återställd av användare'
    }
    return `Övergång från ${from} till ${to}`
  }

  return {
    currentState,
    canTransitionTo,
    transitionTo,
    isTransitioning,
    history,
    clearanceStatus
  }
}