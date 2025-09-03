'use client'

import React from 'react'
import { CopilotMessage, Citation } from './types'
import { ToolCallVisualization } from './ToolCallVisualization'
import { Badge } from '@/components/ui/badge'
import { Bot, User, Link2, FileText } from 'lucide-react'
import { cn, formatSwedishDate } from '@/lib/utils'

interface MessageListProps {
  messages: CopilotMessage[]
  language: 'sv' | 'en'
  showToolCalls: boolean
}

export function MessageList({ 
  messages, 
  language, 
  showToolCalls 
}: MessageListProps) {
  const renderCitation = (citation: Citation) => {
    const icon = citation.type === 'INS' ? <FileText className="h-3 w-3" /> : <Link2 className="h-3 w-3" />
    const color = citation.type === 'INS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    
    return (
      <button
        key={citation.id}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono hover:opacity-80 transition-opacity',
          color
        )}
        title={citation.preview || citation.title}
        onClick={() => {
          if (citation.url) {
            window.open(citation.url, '_blank')
          }
        }}
      >
        {icon}
        {citation.id}
      </button>
    )
  }

  const renderMessage = (message: CopilotMessage, index: number) => {
    const isUser = message.role === 'user'
    const Icon = isUser ? User : Bot
    const alignment = isUser ? 'justify-end' : 'justify-start'
    const bgColor = isUser ? 'bg-primary/10' : 'bg-muted'
    
    return (
      <div key={message.id || index} className={cn('flex gap-3', alignment)}>
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        
        <div className={cn('max-w-[80%] space-y-2')}>
          {/* Message bubble */}
          <div className={cn('rounded-lg p-3', bgColor)}>
            {/* Message metadata */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">
                {isUser 
                  ? (language === 'sv' ? 'Du' : 'You')
                  : 'AI Copilot'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatSwedishDate(message.timestamp, { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
              {message.confidence !== undefined && message.confidence < 1 && (
                <Badge variant="outline" className="text-xs h-4">
                  {Math.round(message.confidence * 100)}%
                </Badge>
              )}
            </div>
            
            {/* Message content */}
            <div className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </div>
            
            {/* Citations */}
            {message.citations && message.citations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                {message.citations.map(renderCitation)}
              </div>
            )}
          </div>
          
          {/* Tool calls */}
          {showToolCalls && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2">
              {message.toolCalls.map((toolCall, idx) => (
                <ToolCallVisualization
                  key={toolCall.id || idx}
                  toolCall={toolCall}
                  language={language}
                />
              ))}
            </div>
          )}
        </div>
        
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => renderMessage(message, index))}
    </div>
  )
}