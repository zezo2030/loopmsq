import { io, type Socket } from 'socket.io-client'
import { getApiBase } from '../api'

let socket: Socket | null = null

function resolveWsUrl(): string {
  // API base usually ends with /api/v1 — strip that to get origin for socket.io
  const base = getApiBase()
  try {
    const u = new URL(base, window.location.origin)
    return `${u.protocol}//${u.host}`
  } catch {
    return window.location.origin
  }
}

export function getSocket(): Socket {
  if (socket && socket.connected) return socket
  if (socket) {
    socket.connect()
    return socket
  }

  const token = localStorage.getItem('accessToken') || ''
  socket = io(resolveWsUrl(), {
    transports: ['websocket'],
    auth: { token },
    query: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

export type AdminNotificationEvent = {
  id: string
  type: string
  severity: 'info' | 'success' | 'warning' | 'critical'
  title: string
  body: string
  branchId?: string | null
  resourceType?: string | null
  resourceId?: string | null
  data?: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
}

export function subscribeAdminNotifications(
  handler: (n: AdminNotificationEvent) => void,
): () => void {
  const s = getSocket()
  const onConnect = () => s.emit('join:admin')
  if (s.connected) onConnect()
  s.on('connect', onConnect)
  s.on('admin:notification', handler)
  return () => {
    s.off('connect', onConnect)
    s.off('admin:notification', handler)
    s.emit('leave:admin')
  }
}
