'use client'

import React from 'react'
import { ToolCall } from './types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tool, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn, formatSwedishDate } from '@/lib/utils'

interface ToolCallVisualizationProps {
  toolCall: ToolCall
  language: 'sv' | 'en'
  className?: string
}

export function ToolCallVisualization({ 
  toolCall, 
  language,
  className 
}: ToolCallVisualizationProps) {
  const getStatusIcon = () => {
    switch (toolCall.status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
      default:
        return <Tool className="h-4 w-4" />
    }
  }

  const getStatusText = () => {
    switch (toolCall.status) {
      case 'success':
        return language === 'sv' ? 'Slutförd' : 'Completed'
      case 'error':
        return language === 'sv' ? 'Misslyckades' : 'Failed'
      case 'pending':
        return language === 'sv' ? 'Väntar...' : 'Pending...'
      default:
        return ''
    }
  }

  return (
    <Card className={cn('p-3 bg-muted/30 border-dashed', className)}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tool className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">{toolCall.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant="outline" className="text-xs">
              {getStatusText()}
            </Badge>
          </div>
        </div>

        {/* Arguments */}
        {Object.keys(toolCall.arguments).length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">
              {language === 'sv' ? 'Parametrar:' : 'Parameters:'}
            </span>
            <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
        )}

        {/* Result */}
        {toolCall.result && toolCall.status === 'success' && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">
              {language === 'sv' ? 'Resultat:' : 'Result:'}
            </span>
            <div className="text-xs bg-green-50 dark:bg-green-950/30 p-2 rounded">
              {typeof toolCall.result === 'object' 
                ? JSON.stringify(toolCall.result, null, 2)
                : toolCall.result}
            </div>
          </div>
        )}

        {/* Error message */}
        {toolCall.result && toolCall.status === 'error' && (
          <div className="text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded">
            {language === 'sv' ? 'Fel: ' : 'Error: '}
            {toolCall.result}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground text-right">
          {formatSwedishDate(toolCall.timestamp, { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          })}
        </div>
      </div>
    </Card>
  )
}