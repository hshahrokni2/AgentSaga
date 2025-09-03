'use client'

import React, { useState, useRef } from 'react'
import { CommentDrawerProps, Comment, GranskadState } from './types/workflow-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { GlassCard } from '@/components/ui/glass-card'
import { 
  MessageCircle, 
  Plus, 
  Send,
  Eye,
  Edit,
  Bold,
  Italic,
  List,
  Link,
  Quote,
  Code,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function CommentDrawer({
  comments,
  findings,
  selectedFindingIds,
  onCommentAdd,
  currentState
}: CommentDrawerProps) {
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const isReadOnly = currentState === 'fully_reviewed'
  
  const handleAddComment = () => {
    if (commentText.trim()) {
      onCommentAdd(commentText, selectedFindingIds)
      setCommentText('')
      setIsAddingComment(false)
      setPreviewMode(false)
    }
  }

  const handleCancel = () => {
    setCommentText('')
    setIsAddingComment(false)
    setPreviewMode(false)
  }

  const insertMarkdown = (before: string, after: string = '') => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = commentText.substring(start, end)
    
    const newText = 
      commentText.substring(0, start) + 
      before + selectedText + after + 
      commentText.substring(end)
    
    setCommentText(newText)
    
    // Set cursor position after insertion
    setTimeout(() => {
      const newCursorPos = start + before.length + selectedText.length + after.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }, 0)
  }

  const renderMarkdown = (text: string): string => {
    // Simple markdown renderer for preview
    let rendered = text
    
    // Headers
    rendered = rendered.replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold mb-2">$1</h3>')
    rendered = rendered.replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold mb-2">$1</h2>')
    rendered = rendered.replace(/^# (.*$)/gm, '<h1 class="text-xl font-semibold mb-3">$1</h1>')
    
    // Bold and italic
    rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    rendered = rendered.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    
    // Code
    rendered = rendered.replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-sm font-mono">$1</code>')
    
    // Lists
    rendered = rendered.replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
    rendered = rendered.replace(/(<li.*<\/li>)/s, '<ul class="mb-2">$1</ul>')
    
    // Line breaks
    rendered = rendered.replace(/\n/g, '<br>')
    
    return rendered
  }

  const getSelectedFindingsText = () => {
    if (selectedFindingIds.length === 0) return null
    
    const selectedFindings = findings.filter(f => selectedFindingIds.includes(f.id))
    return selectedFindings.map(f => f.title).join(', ')
  }

  const getCommentFindings = (comment: Comment) => {
    if (comment.findingIds.length === 0) return null
    
    const commentFindings = findings.filter(f => comment.findingIds.includes(f.id))
    return commentFindings.map(f => f.title).join(', ')
  }

  return (
    <GlassCard 
      className="comment-drawer h-full flex flex-col" 
      data-testid="comment-drawer"
      role="aside"
      aria-label="Kommentarer"
    >
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle size={20} />
            Kommentarer
          </h2>
          <Badge variant="secondary" className="text-xs">
            {comments.length}
          </Badge>
        </div>
        
        {selectedFindingIds.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{selectedFindingIds.length} valda fynd:</span>
            <p className="mt-1 text-xs leading-relaxed">
              {getSelectedFindingsText()}
            </p>
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-auto">
        {comments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">Inga kommentarer ännu</p>
            <p className="text-xs">
              {isReadOnly 
                ? 'Granskningen är slutförd och låst'
                : 'Lägg till första kommentaren för denna granskning'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                findings={getCommentFindings(comment)}
                renderMarkdown={renderMarkdown}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Comment Section */}
      {!isReadOnly && (
        <div className="p-6 border-t border-border/50">
          {!isAddingComment ? (
            <Button
              onClick={() => setIsAddingComment(true)}
              className="w-full"
              variant="outline"
              data-testid="add-comment-button"
            >
              <Plus size={16} className="mr-2" />
              Lägg till kommentar
            </Button>
          ) : (
            <div className="space-y-4">
              {selectedFindingIds.length > 0 && (
                <div className="text-xs p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="font-medium text-blue-900">
                    Kommenterar {selectedFindingIds.length} fynd:
                  </span>
                  <p className="text-blue-700 mt-1">{getSelectedFindingsText()}</p>
                </div>
              )}

              {/* Markdown Toolbar */}
              <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-lg">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => insertMarkdown('**', '**')}
                  title="Fetstil"
                  className="h-8 w-8 p-0"
                >
                  <Bold size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => insertMarkdown('*', '*')}
                  title="Kursiv"
                  className="h-8 w-8 p-0"
                >
                  <Italic size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => insertMarkdown('`', '`')}
                  title="Kod"
                  className="h-8 w-8 p-0"
                >
                  <Code size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => insertMarkdown('\n- ', '')}
                  title="Punktlista"
                  className="h-8 w-8 p-0"
                >
                  <List size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => insertMarkdown('> ', '')}
                  title="Citat"
                  className="h-8 w-8 p-0"
                >
                  <Quote size={14} />
                </Button>
                
                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant={previewMode ? "default" : "ghost"}
                    onClick={() => setPreviewMode(!previewMode)}
                    className="h-8 text-xs"
                  >
                    <Eye size={14} className="mr-1" />
                    Förhandsgranska
                  </Button>
                </div>
              </div>

              {/* Comment Input */}
              <div className="space-y-3">
                {previewMode ? (
                  <div className="min-h-[120px] p-3 border rounded-lg bg-background">
                    <div className="text-sm prose prose-sm max-w-none">
                      {commentText ? (
                        <div dangerouslySetInnerHTML={{ 
                          __html: renderMarkdown(commentText) 
                        }} />
                      ) : (
                        <p className="text-muted-foreground italic">
                          Ingen förhandsvisning tillgänglig...
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Textarea
                    ref={textareaRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Skriv din kommentar här... (stöder Markdown)"
                    className="min-h-[120px] resize-none"
                    data-testid="comment-textarea"
                  />
                )}
                
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    {commentText.length > 0 && (
                      <span>{commentText.length} tecken</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      data-testid="cancel-comment-button"
                    >
                      Avbryt
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      data-testid="save-comment-button"
                    >
                      <Send size={14} className="mr-1" />
                      Skicka
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

interface CommentItemProps {
  comment: Comment
  findings: string | null
  renderMarkdown: (text: string) => string
}

function CommentItem({ comment, findings, renderMarkdown }: CommentItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLong = comment.content.length > 200

  return (
    <div className="comment-item p-4" data-testid={`comment-${comment.id}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString('sv-SE')}
            </span>
          </div>
          
          {findings && (
            <div className="text-xs text-muted-foreground mb-2">
              <span className="font-medium">Kommenterar fynd:</span> {findings}
            </div>
          )}
        </div>
      </div>

      <div className="ml-11">
        <div className="text-sm leading-relaxed">
          {isLong && !isExpanded ? (
            <>
              <div dangerouslySetInnerHTML={{ 
                __html: renderMarkdown(comment.content.substring(0, 200) + '...') 
              }} />
              <button
                onClick={() => setIsExpanded(true)}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1"
              >
                Visa mer
              </button>
            </>
          ) : (
            <>
              <div dangerouslySetInnerHTML={{ 
                __html: renderMarkdown(comment.content) 
              }} />
              {isLong && isExpanded && (
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1"
                >
                  Visa mindre
                </button>
              )}
            </>
          )}
        </div>
        
        {comment.updatedAt && comment.updatedAt > comment.createdAt && (
          <div className="text-xs text-muted-foreground mt-2 italic">
            Redigerad {new Date(comment.updatedAt).toLocaleString('sv-SE')}
          </div>
        )}
      </div>
    </div>
  )
}