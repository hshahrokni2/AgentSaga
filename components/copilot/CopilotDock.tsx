'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { 
  CopilotDockProps, 
  CopilotMessage, 
  ToolCall, 
  Citation, 
  Proposal 
} from './types'
import { useCopilot } from '@/providers/copilot-provider'
import { ToolCallVisualization } from './ToolCallVisualization'
import { ProposalCard } from './ProposalCard'
import { MessageList } from './MessageList'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Languages,
  Download,
  MoreHorizontal,
  MessageCircle,
  AlertCircle,
  Tool,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { cn, formatSwedishDate } from '@/lib/utils'

export function CopilotDock({ 
  isOpen, 
  onClose, 
  context, 
  language = 'sv',
  onLanguageChange 
}: CopilotDockProps) {
  const { messages, addMessage, isStreaming } = useCopilot()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null)
  const [showToolCalls, setShowToolCalls] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return
    
    const userMessage: Omit<CopilotMessage, 'id' | 'timestamp'> = {
      role: 'user',
      content: input.trim(),
      language,
      confidence: 1.0
    }
    
    addMessage(userMessage)
    setInput('')
    setIsTyping(true)

    // Simulate typing delay for better UX
    setTimeout(() => {
      setIsTyping(false)
    }, 1000)
  }, [input, isStreaming, language, addMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const toggleLanguage = useCallback(() => {
    const newLang = language === 'sv' ? 'en' : 'sv'
    onLanguageChange?.(newLang)
  }, [language, onLanguageChange])

  const exportConversation = useCallback(() => {
    const conversationData = {
      messages,
      context,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
    
    const blob = new Blob([JSON.stringify(conversationData, null, 2)], { 
      type: 'application/json' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversation-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [messages, context])

  const handleProposalAction = useCallback(async (proposal: Proposal, accepted: boolean) => {
    setActiveProposal({
      ...proposal,
      status: accepted ? 'accepted' : 'rejected'
    })

    if (accepted) {
      // Execute the proposed action
      const resultMessage: Omit<CopilotMessage, 'id' | 'timestamp'> = {
        role: 'assistant',
        content: language === 'sv' 
          ? `✅ Förslaget "${proposal.title}" har genomförts.`
          : `✅ Proposal "${proposal.title}" has been executed.`,
        language,
        confidence: proposal.confidence
      }
      addMessage(resultMessage)
    }

    // Clear proposal after animation
    setTimeout(() => {
      setActiveProposal(null)
    }, 1500)
  }, [language, addMessage])

  // Calculate typing indicator visibility
  const showTypingIndicator = useMemo(() => {
    return isTyping || isStreaming
  }, [isTyping, isStreaming])

  if (!isOpen) return null

  return (
    <aside
      className="fixed right-0 top-0 h-full w-full md:w-[480px] z-50 flex flex-col bg-background/95 backdrop-blur-lg border-l shadow-xl"
      role="complementary"
      aria-label={language === 'sv' ? 'AI-assistent' : 'AI Assistant'}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-background/80">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">
            {language === 'sv' ? 'AI Copilot' : 'AI Copilot'}
          </h2>
          <Badge variant="outline" className="text-xs">
            {messages.length} {language === 'sv' ? 'meddelanden' : 'messages'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Tool calls toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowToolCalls(!showToolCalls)}
            aria-label={language === 'sv' ? 'Visa verktygsamtal' : 'Show tool calls'}
            title={language === 'sv' ? 'Visa/dölj verktygsamtal' : 'Show/hide tool calls'}
          >
            <Tool className={cn('h-4 w-4', showToolCalls && 'text-primary')} />
          </Button>

          {/* Language toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLanguage}
            aria-label={language === 'sv' ? 'Byt språk' : 'Switch language'}
          >
            <Languages className="h-4 w-4" />
          </Button>
          
          {/* Export conversation */}
          <Button
            variant="ghost"
            size="icon"
            onClick={exportConversation}
            aria-label={language === 'sv' ? 'Exportera konversation' : 'Export conversation'}
          >
            <Download className="h-4 w-4" />
          </Button>
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={language === 'sv' ? 'Stäng' : 'Close'}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Context display */}
      {context && (
        <div className="px-4 py-2 bg-muted/50 border-b">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{language === 'sv' ? 'Kontext:' : 'Context:'}</span>
            {context.supplierId && (
              <Badge variant="secondary" className="text-xs">
                {context.supplierId}
              </Badge>
            )}
            {context.month && (
              <Badge variant="secondary" className="text-xs">
                {context.month}
              </Badge>
            )}
            {context.insights && context.insights.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {context.insights.length} insights
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Active proposal */}
      {activeProposal && (
        <div className="p-4 border-b bg-primary/10">
          <ProposalCard 
            proposal={activeProposal}
            onAccept={() => handleProposalAction(activeProposal, true)}
            onReject={() => handleProposalAction(activeProposal, false)}
            language={language}
            isProcessing={activeProposal.status !== 'pending'}
          />
        </div>
      )}

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg mb-2">
              {language === 'sv' ? 'Ingen konversation än' : 'No conversation yet'}
            </p>
            <p className="text-sm">
              {language === 'sv' 
                ? 'Ställ en fråga eller be om hjälp med dina data'
                : 'Ask a question or request help with your data'}
            </p>
          </div>
        ) : (
          <MessageList 
            messages={messages}
            language={language}
            showToolCalls={showToolCalls}
          />
        )}

        {/* Typing indicator */}
        {showTypingIndicator && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm">
              {language === 'sv' ? 'AI tänker...' : 'AI thinking...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <footer className="p-4 border-t bg-background/80">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="space-y-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === 'sv' 
                  ? 'Skriv ett meddelande... (Shift+Enter för ny rad)'
                  : 'Type a message... (Shift+Enter for new line)'
              }
              className="min-h-[80px] pr-12 resize-none"
              disabled={isStreaming}
              aria-label={language === 'sv' ? 'Meddelande' : 'Message'}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 bottom-2"
              disabled={!input.trim() || isStreaming}
              aria-label={language === 'sv' ? 'Skicka meddelande' : 'Send message'}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Character count */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {input.length} / 2000 {language === 'sv' ? 'tecken' : 'characters'}
            </span>
            <span>
              {language === 'sv' ? 'Ctrl+Enter för att skicka' : 'Ctrl+Enter to send'}
            </span>
          </div>
        </form>
      </footer>
    </aside>
  )
}