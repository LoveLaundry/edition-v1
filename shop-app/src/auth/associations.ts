import { authApi } from '../api/client'
import type { Session, SessionUser } from '../session'

/**
 * One laundry this login is registered with.
 *
 * `status` is per association, not per person: the same login can be active at
 * one laundry and suspended at another, so the UI must show the state of the
 * row rather than assuming they all match.
 */
export interface Association {
  laundry_id: string
  laundry_name: string
  client_name: string
  client_type: string
  role_id: string
  status: string
}

interface LaundriesResponse {
  current: string
  client_type: string
  count: number
  items: Association[]
}

export async function loadAssociations(): Promise<Association[]> {
  const { data } = await authApi.get<LaundriesResponse>('/client/auth/laundries')
  return data?.items ?? []
}

/**
 * Exchange the current session for one scoped to another laundry.
 *
 * The server returns a **new** token rather than widening the old one, so the
 * previous laundry stops being readable the moment the session is replaced.
 */
export async function switchLaundry(laundryId: string): Promise<Session> {
  const { data } = await authApi.post('/client/auth/switch', { laundry_id: laundryId })
  const client = (data?.client ?? {}) as Record<string, unknown>
  const user: SessionUser = {
    name: String(client.user_name ?? ''),
    role: String(client.role_id ?? '').toUpperCase(),
    laundry: client.laundry_id ? String(client.laundry_id) : undefined,
    clientName: client.client_name ? String(client.client_name) : undefined,
  }
  if (!user.clientName) {
    throw new Error('That laundry did not return a customer record.')
  }
  return { token: String(data.access_token), user }
}
