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

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const token = localStorage.getItem('accessToken')
  const resp = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
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

// Admin Config APIs
export type WhatsAppConfigMasked = {
  enabled: boolean
  provider: 'whatsapp'
  whatsappAccessToken?: string
  whatsappPhoneNumberId?: string
}

export type OtpConfig = {
  enabled: boolean
  length: number
  expirySeconds: number
  rateTtlSeconds: number
  rateMaxAttempts: number
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfigMasked> {
  return apiGet('/admin/config/whatsapp')
}

export async function updateWhatsAppConfig(body: Partial<{ enabled: boolean; provider: 'whatsapp'; whatsappAccessToken: string; whatsappPhoneNumberId: string }>): Promise<WhatsAppConfigMasked> {
  return apiPut('/admin/config/whatsapp', body)
}

export async function testWhatsApp(to: string, message: string): Promise<{ success: boolean }> {
  return apiPost('/admin/config/whatsapp/test', { to, message })
}

export async function getOtpConfig(): Promise<OtpConfig> {
  return apiGet('/admin/config/otp')
}

export async function updateOtpConfig(body: Partial<OtpConfig>): Promise<OtpConfig> {
  return apiPut('/admin/config/otp', body)
}


