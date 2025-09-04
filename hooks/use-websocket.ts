'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface WebSocketMessage {
  type: string
  payload?: any
  timestamp?: Date
}

interface UseWebSocketReturn {
  messages: WebSocketMessage[]
  isConnected: boolean
  send: (message: any) => void
  reconnect: () => void
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [messages, setMessages] = useState<WebSocketMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)

  const connect = useCallback(() => {
    try {
      // Convert relative URL to absolute WebSocket URL
      const wsUrl = url.startsWith('/')
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${url}`
        : url

      ws.current = new WebSocket(wsUrl)

      ws.current.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        reconnectAttempts.current = 0
      }

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          setMessages((prev) => [...prev, { ...message, timestamp: new Date() }])
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.current.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        ws.current = null

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setIsConnected(false)
    }
  }, [url])

  const send = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  const reconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close()
    }
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [connect])

  return {
    messages,
    isConnected,
    send,
    reconnect
  }
}