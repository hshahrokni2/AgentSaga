import * as React from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'destructive'
}

interface ToastState {
  toasts: Toast[]
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST', 
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType['ADD_TOAST']
      toast: Toast
    }
  | {
      type: ActionType['UPDATE_TOAST']
      toast: Partial<Toast>
    }
  | {
      type: ActionType['DISMISS_TOAST']
      toastId?: Toast['id']
    }
  | {
      type: ActionType['REMOVE_TOAST']
      toastId?: Toast['id']
    }

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    })
  }, 1000)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: ToastState, action: Action): ToastState => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts],
      }

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case 'DISMISS_TOAST': {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: ToastState) => void> = []

let memoryState: ToastState = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

interface ToastOptions {
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'destructive'
}

function toast(options: ToastOptions) {
  const id = Math.random().toString(36).substr(2, 9)

  const update = (props: ToastOptions) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { id, ...props },
    })
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      id,
      ...options,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss()
      },
    } as Toast,
  })

  return {
    id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

export { toast, useToast }