import type {
  MeContext, DemoAccount, PlanogramData, ChocoData, ChocoSku, Weights,
  CustomProductPayload, CustomProductRecord,
} from './types'

const opts: RequestInit = { credentials: 'same-origin' }

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, opts)
  if (r.status === 401) throw new AuthError()
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export class AuthError extends Error {}

export async function getMe(): Promise<MeContext> {
  const r = await fetch('/api/me', opts)
  if (r.status === 401) return { authenticated: false } as MeContext
  return r.json()
}

export async function getDemoAccounts(): Promise<DemoAccount[]> {
  try { return await jget<DemoAccount[]>('/api/demo-accounts') } catch { return [] }
}

export async function login(username: string, password: string): Promise<MeContext> {
  const r = await fetch('/api/login', {
    ...opts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error(d.error || 'Kullanıcı adı veya şifre hatalı')
  }
  return r.json()
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { ...opts, method: 'POST' })
}

export function getPlanogram(roc: number, quarter: string, selected?: string[]): Promise<PlanogramData> {
  if (selected !== undefined) {
    return fetch('/api/planogram', {
      ...opts,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roc, quarter, selected }),
    }).then(r => {
      if (r.status === 401) throw new AuthError()
      return r.json()
    })
  }
  return jget<PlanogramData>(`/api/planogram?roc=${roc}&quarter=${quarter}`)
}

export function getChocolateSkus(
  module: string, weights: Weights | null, roc: number, quarter: string,
): Promise<ChocoSku[]> {
  const params = new URLSearchParams({ module, roc: String(roc), quarter })
  if (weights) Object.keys(weights).forEach(k => params.set(k, String(weights[k])))
  return jget<ChocoSku[]>(`/api/chocolate/skus?${params}`)
}

export function allocateChocolate(body: {
  module: string; selected: string[]; weights: Weights | null;
  auto: boolean; roc: number; quarter: string;
}): Promise<ChocoData> {
  return fetch('/api/chocolate/allocate', {
    ...opts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (r.status === 401) throw new AuthError()
    return r.json()
  })
}

export function getCustomProducts(): Promise<CustomProductRecord[]> {
  return jget<CustomProductRecord[]>('/api/custom-products')
}

export function createCustomProduct(body: CustomProductPayload): Promise<CustomProductRecord> {
  return fetch('/api/custom-products', {
    ...opts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (r.status === 401) throw new AuthError()
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
}

export async function deleteCustomProduct(id: number): Promise<void> {
  const r = await fetch(`/api/custom-products/${id}`, { ...opts, method: 'DELETE' })
  if (r.status === 401) throw new AuthError()
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}
