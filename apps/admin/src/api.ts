import { authFetch, getApiBase } from './shared/session'

export { getApiBase }

export async function apiGet<T>(path: string): Promise<T> {
  const resp = await authFetch(path)
  if (!resp.ok) throw new Error(await parseErrorResponse(resp) || 'Request failed')
  return resp.json()
}

export async function apiPost<T>(path: string, body: any, options?: { headers?: Record<string, string> }): Promise<T> {
  const headers: Record<string, string> = { ...options?.headers }

  // If body is FormData, don't set Content-Type (let browser set it with boundary)
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const resp = await authFetch(path, {
    method: 'POST',
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(await parseErrorResponse(resp) || 'Request failed')
  return resp.json()
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const resp = await authFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(await parseErrorResponse(resp) || 'Request failed')
  return resp.json()
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const resp = await authFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(await parseErrorResponse(resp) || 'Request failed')
  return resp.json()
}

export async function apiDelete<T>(path: string): Promise<T> {
  const resp = await authFetch(path, { method: 'DELETE' })
  if (!resp.ok) throw new Error(await parseErrorResponse(resp) || 'Request failed')
  try { return await resp.json() } catch { return undefined as unknown as T }
}

async function safeText(resp: Response): Promise<string | null> {
  try { return await resp.text() } catch { return null }
}

async function parseErrorResponse(resp: Response): Promise<string> {
  const text = await safeText(resp);
  if (!text) return 'Request failed';
  try {
    const json = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(json.message)) return json.message.join(' — ');
    if (typeof json.message === 'string') return json.message;
  } catch {
    // not JSON
  }
  return text;
}

// Admin Config APIs
export type WhatsAppConfigMasked = {
  enabled: boolean
  provider: 'whatsapp'
  whatsappAccessToken?: string
  whatsappPhoneNumberId?: string
  publicContactWhatsappPhone?: string
}

export type OtpConfig = {
  enabled: boolean
  length: number
  expirySeconds: number
  rateTtlSeconds: number
  rateMaxAttempts: number
}

export type PrivateEventTermsConfig = {
  terms: string[]
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfigMasked> {
  return apiGet('/admin/config/whatsapp')
}

export async function updateWhatsAppConfig(body: Partial<{ enabled: boolean; provider: 'whatsapp'; whatsappAccessToken: string; whatsappPhoneNumberId: string; publicContactWhatsappPhone: string }>): Promise<WhatsAppConfigMasked> {
  return apiPut('/admin/config/whatsapp', body)
}

export async function testWhatsApp(to: string, message: string): Promise<{ success: boolean }> {
  return apiPost('/admin/config/whatsapp/test', { to, message })
}

export async function testGiftTemplate(body: {
  to: string
  senderName: string
  productTitle: string
  branchName: string
  claimUrl: string
}): Promise<{ success: boolean }> {
  return apiPost('/admin/config/whatsapp/test-gift-template', body)
}

export async function getOtpConfig(): Promise<OtpConfig> {
  return apiGet('/admin/config/otp')
}

export async function updateOtpConfig(body: Partial<OtpConfig>): Promise<OtpConfig> {
  return apiPut('/admin/config/otp', body)
}

export async function getPrivateEventTermsConfig(): Promise<PrivateEventTermsConfig> {
  return apiGet('/admin/config/private-event-terms')
}

export async function updatePrivateEventTermsConfig(body: PrivateEventTermsConfig): Promise<PrivateEventTermsConfig> {
  return apiPut('/admin/config/private-event-terms', body)
}

