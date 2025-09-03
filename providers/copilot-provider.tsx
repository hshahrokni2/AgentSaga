'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { ConversationContext, CopilotMessage } from '@/components/copilot/types'

interface CopilotContextType {
  messages: CopilotMessage[]
  addMessage: (message: Omit<CopilotMessage, 'id' | 'timestamp'>) => void
  context: ConversationContext | null
  setContext: (context: ConversationContext | null) => void
  isStreaming: boolean
  setIsStreaming: (streaming: boolean) => void
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined)

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [context, setContext] = useState<ConversationContext | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const addMessage = (messageData: Omit<CopilotMessage, 'id' | 'timestamp'>) => {
    const message: CopilotMessage = {
      ...messageData,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
  }

  return (
    <CopilotContext.Provider value={{
      messages,
      addMessage,
      context,
      setContext,
      isStreaming,
      setIsStreaming
    }}>
      {children}
    </CopilotContext.Provider>
  )
}

export function useCopilot() {
  const context = useContext(CopilotContext)
  if (context === undefined) {
    throw new Error('useCopilot must be used within a CopilotProvider')
  }
  return context
}