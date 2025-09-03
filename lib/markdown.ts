/**
 * Simple markdown renderer for Granskad workflow comments
 * Provides basic markdown parsing and sanitization
 */

export function renderMarkdown(text: string): string {
  if (!text) return ''
  
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
  rendered = rendered.replace(/(<li.*?<\/li>)/gs, '<ul class="mb-2">$1</ul>')
  
  // Links
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>')
  
  // Blockquotes
  rendered = rendered.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600">$1</blockquote>')
  
  // Line breaks
  rendered = rendered.replace(/\n/g, '<br>')
  
  return rendered
}

export function sanitizeMarkdown(text: string): string {
  if (!text) return ''
  
  // Basic HTML sanitization - remove potentially dangerous tags
  const dangerousTags = /<(script|iframe|object|embed|form|input|style|link)[^>]*>.*?<\/\1>/gi
  let sanitized = text.replace(dangerousTags, '')
  
  // Remove standalone dangerous tags
  sanitized = sanitized.replace(/<(script|iframe|object|embed|form|input|style|link)[^>]*>/gi, '')
  
  // Allow only safe HTML tags
  const allowedTags = /(<\/?(h[1-6]|p|strong|em|ul|li|ol|blockquote|code|a|br)[^>]*>)/gi
  const parts = sanitized.split(allowedTags)
  
  sanitized = parts.map((part, index) => {
    if (index % 2 === 0) {
      // Text content - escape HTML entities
      return part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
    } else {
      // Allowed HTML tags
      return part
    }
  }).join('')
  
  return sanitized
}

export function stripMarkdown(text: string): string {
  if (!text) return ''
  
  let stripped = text
  
  // Remove markdown syntax
  stripped = stripped.replace(/^#{1,6}\s*/gm, '') // Headers
  stripped = stripped.replace(/\*\*(.*?)\*\*/g, '$1') // Bold
  stripped = stripped.replace(/\*(.*?)\*/g, '$1') // Italic
  stripped = stripped.replace(/`(.*?)`/g, '$1') // Code
  stripped = stripped.replace(/^[-*+]\s+/gm, '') // List items
  stripped = stripped.replace(/^\d+\.\s+/gm, '') // Numbered lists
  stripped = stripped.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
  stripped = stripped.replace(/^>\s*/gm, '') // Blockquotes
  
  return stripped.trim()
}