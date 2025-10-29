export function getApiBase(): string {
  const base = (import.meta as any).env?.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE
  return (typeof base === 'string' && base) ? base : 'http://localhost:3000/api/v1'
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem('accessToken')
  const resp = await fetch(`${getApiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) throw new Error(await safeText(resp) || 'Request failed')
  return resp.json()
}

export async function apiPost<T>(path: string, body: any, options?: { headers?: Record<string, string> }): Promise<T> {
  const token = localStorage.getItem('accessToken')
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...options?.headers
  }
  
  // If body is FormData, don't set Content-Type (let browser set it with boundary)
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  
  const resp = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(await safeText(resp) || 'Request failed')
  return resp.json()
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const token = localStorage.getItem('accessToken')
  const resp = await fetch(`${getApiBase()}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(await safeText(resp) || 'Request failed')
  return resp.json()
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const token = localStorage.getItem('accessToken')
  const resp = await fetch(`${getApiBase()}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(await safeText(resp) || 'Request failed')
  return resp.json()
}

export async function apiDelete<T>(path: string): Promise<T> {
  const token = localStorage.getItem('accessToken')
  const resp = await fetch(`${getApiBase()}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!resp.ok) throw new Error(await safeText(resp) || 'Request failed')
  try { return await resp.json() } catch { return undefined as unknown as T }
}

async function safeText(resp: Response): Promise<string | null> {
  try { return await resp.text() } catch { return null }
}
