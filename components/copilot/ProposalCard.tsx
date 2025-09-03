'use client'

import React from 'react'
import { Proposal } from './types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProposalCardProps {
  proposal: Proposal
  onAccept: () => void
  onReject: () => void
  language: 'sv' | 'en'
  isProcessing?: boolean
}

export function ProposalCard({ 
  proposal, 
  onAccept, 
  onReject, 
  language,
  isProcessing = false
}: ProposalCardProps) {
  const getConfidenceBadge = () => {
    if (proposal.confidence >= 0.8) {
      return <Badge variant="default" className="bg-green-500">
        {language === 'sv' ? 'Hög säkerhet' : 'High confidence'} ({Math.round(proposal.confidence * 100)}%)
      </Badge>
    } else if (proposal.confidence >= 0.5) {
      return <Badge variant="secondary">
        {language === 'sv' ? 'Medel säkerhet' : 'Medium confidence'} ({Math.round(proposal.confidence * 100)}%)
      </Badge>
    } else {
      return <Badge variant="outline">
        {language === 'sv' ? 'Låg säkerhet' : 'Low confidence'} ({Math.round(proposal.confidence * 100)}%)
      </Badge>
    }
  }

  if (proposal.status === 'accepted') {
    return (
      <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="font-medium">
          {language === 'sv' ? '✅ Förslaget har accepterats och genomförts' : '✅ Proposal accepted and executed'}
        </AlertDescription>
      </Alert>
    )
  }

  if (proposal.status === 'rejected') {
    return (
      <Alert className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="font-medium">
          {language === 'sv' ? '❌ Förslaget avvisades' : '❌ Proposal rejected'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className={cn(
      'border-primary/50 shadow-sm',
      isProcessing && 'opacity-70 pointer-events-none'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              {language === 'sv' ? 'Förslag på åtgärd' : 'Proposed Action'}
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              {proposal.title}
            </CardDescription>
          </div>
          {getConfidenceBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Description */}
        <div className="text-sm text-muted-foreground">
          {proposal.description}
        </div>

        {/* Action details */}
        <div className="bg-muted/50 p-3 rounded space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ChevronRight className="h-4 w-4" />
            {language === 'sv' ? 'Åtgärd:' : 'Action:'}
            <code className="text-xs bg-background px-2 py-0.5 rounded">
              {proposal.action}
            </code>
          </div>
          
          {Object.keys(proposal.parameters).length > 0 && (
            <div className="ml-6">
              <span className="text-xs text-muted-foreground">
                {language === 'sv' ? 'Parametrar:' : 'Parameters:'}
              </span>
              <pre className="text-xs bg-background/50 p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(proposal.parameters, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onAccept}
            size="sm"
            className="flex-1"
            disabled={isProcessing}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {language === 'sv' ? 'Godkänn' : 'Accept'}
          </Button>
          <Button
            onClick={onReject}
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={isProcessing}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {language === 'sv' ? 'Avvisa' : 'Reject'}
          </Button>
        </div>

        {/* Warning for low confidence */}
        {proposal.confidence < 0.5 && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {language === 'sv' 
                ? '⚠️ Låg säkerhet - granska noga innan du godkänner'
                : '⚠️ Low confidence - review carefully before accepting'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}