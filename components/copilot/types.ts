export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
  citations?: Citation[]
  confidence?: number
  language: 'sv' | 'en'
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  result?: any
  status: 'pending' | 'success' | 'error'
  timestamp: Date
}

export interface Citation {
  id: string
  type: 'INS' | 'SCN'
  title: string
  url?: string
  preview?: string
}

export interface Proposal {
  id: string
  title: string
  description: string
  action: string
  parameters: Record<string, any>
  confidence: number
  status: 'pending' | 'accepted' | 'rejected'
  timestamp: Date
}

export interface ConversationContext {
  supplierId?: string
  month?: string
  insights?: string[]
  scenarios?: string[]
  cacheKey: string
  lastAccess: Date
}

export interface CopilotDockProps {
  isOpen: boolean
  onClose: () => void
  context?: ConversationContext
  language?: 'sv' | 'en'
  onLanguageChange?: (language: 'sv' | 'en') => void
}

export interface CopilotProviderProps {
  children: React.ReactNode
}