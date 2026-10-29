// Central session storage for the console.
//
// The staff access token issued by /auth/staff/login expires after 4h while the
// refresh token lives for 7 days. Before this module the console only kept the
// access token, so every session silently died after 4h ("login is not saved").
// authFetch() now retries a 401 once with a freshly refreshed access token and
// only falls back to /login when the refresh token is gone or rejected.

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

export function getApiBase(): string {
  const raw = (import.meta as any).env?.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE
  const trimmed = typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : ''
  return trimmed || 'http://localhost:3000/api/v1'
}

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY) } catch { return null }
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_TOKEN_KEY) } catch { return null }
}

export function saveSession(tokens: { accessToken?: string; refreshToken?: string }): void {
  try {
    if (tokens.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    if (tokens.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  } catch {}
}

export function clearSession(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {}
}

export function signOut(): void {
  clearSession()
  window.location.href = '/login'
}

function redirectToLogin(): void {
  clearSession()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

// Shared between concurrent requests so a burst of 401s triggers one refresh.
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const resp = await fetch(`${getApiBase()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!resp.ok) return null
        const data = await resp.json()
        if (!data?.accessToken) return null
        saveSession(data)
        return data.accessToken as string
      } catch {
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

/**
 * fetch() against the API with the stored access token attached. On 401 the
 * access token is refreshed once and the request replayed; if that fails the
 * session is cleared and the browser is sent back to /login.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const withAuth = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      ...((init.headers as Record<string, string>) || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`
  const resp = await fetch(url, withAuth(getAccessToken()))
  if (resp.status !== 401) return resp

  const token = await refreshAccessToken()
  if (!token) {
    redirectToLogin()
    return resp
  }
  return fetch(url, withAuth(token))
}
