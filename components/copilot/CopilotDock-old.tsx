'use client'

import React, { useState, useRef, useEffect } from 'react'
import { CopilotDockProps, CopilotMessage } from './types'
import { useCopilot } from '@/providers/copilot-provider'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Languages,
  Download,
  MoreHorizontal,
  MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSendMessage = () => {
    if (!input.trim()) return
    
    addMessage({
      role: 'user',
      content: input.trim(),
      language,
      confidence: 1.0
    })
    
    setInput('')
    setIsTyping(true)
    
    // Simulate AI response
    setTimeout(() => {
      addMessage({
        role: 'assistant',
        content: language === 'sv' 
          ? 'Tack för ditt meddelande. Hur kan jag hjälpa dig med dataanalysen?' 
          : 'Thank you for your message. How can I help you with the data analysis?',
        language,
        confidence: 0.85
      })
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleLanguage = () => {
    const newLanguage = language === 'sv' ? 'en' : 'sv'
    onLanguageChange?.(newLanguage)
  }

  const exportConversation = () => {
    const markdown = messages.map(msg => 
      `**${msg.role === 'user' ? 'Användare' : 'AI Assistent'}:** ${msg.content}`
    ).join('\n\n')
    
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversation-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div 
      className="glass-morphism fixed inset-y-0 right-0 z-50 w-96 transform transition-transform duration-300 animate-slide-in-right"
      style={{ 
        position: 'fixed',
        right: 0,
        height: '100vh'
      }}
      role="dialog"
      aria-label="AI Copilot"
      aria-modal="true"
      data-testid="copilot-dock"
    >
      <GlassCard className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">
              {language === 'sv' ? 'AI Assistent' : 'AI Assistant'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={toggleLanguage}
              title={language === 'sv' ? 'Byt till engelska' : 'Switch to Swedish'}
            >
              <Languages className="h-4 w-4" />
              <span className="ml-1 text-xs uppercase">{language}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={exportConversation}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                {language === 'sv' 
                  ? 'Ställ en fråga för att komma igång...' 
                  : 'Ask a question to get started...'}
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              
              <div className={cn(
                "max-w-[80%] rounded-lg px-3 py-2",
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              )}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.confidence && message.confidence < 0.9 && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {Math.round(message.confidence * 100)}% säker
                  </Badge>
                )}
              </div>
              
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/50">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={language === 'sv' 
                ? 'Ställ en fråga om datan...' 
                : 'Ask a question about the data...'}
              className="min-h-[60px] max-h-32 resize-none"
              disabled={isStreaming}
              data-testid="copilot-input"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!input.trim() || isStreaming}
              size="sm"
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}