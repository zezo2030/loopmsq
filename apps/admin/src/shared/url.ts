import { getApiBase } from '../api'

function serverRootFromApiBase(): string {
  try {
    const base = getApiBase()
    const url = new URL(base)
    return `${url.protocol}//${url.host}`
  } catch {
    const base = getApiBase()
    const idx = base.indexOf('/api/')
    return idx > 0 ? base.substring(0, idx) : base
  }
}

export function resolveFileUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const root = serverRootFromApiBase()
  if (path.startsWith('/')) return `${root}${path}`
  return `${root}/${path}`
}

// Append cache-busting query param to force refresh (useful for previews after upload)
export function resolveFileUrlWithBust(path?: string | null): string {
  const url = resolveFileUrl(path)
  if (!url) return ''
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${Date.now()}`
}


