/** Active cache scope (the logged-in user's id, sanitized). */
import { sanitizeScope } from './db'

let scope = 'anon'

export function setCacheScope(next: string): void {
  scope = next || 'anon'
}

export function getCacheScope(): string {
  return scope
}

export interface ScopeIdentity {
  id?: string | null
  laundry_id?: string | null
}

/**
 * Cache scope for a session: the user id plus the active laundry when one
 * is selected. Tenant data, the offline outbox, and every persisted query
 * snapshot all live inside this scope's database, so switching laundries
 * (or entering/exiting a support session) can never surface another
 * laundry's rows, and queued offline writes replay only under the laundry
 * that created them. Users without a laundry keep their existing scope, so
 * upgrading never orphans anyone's cache.
 */
export function cacheScopeFor(user: ScopeIdentity | null | undefined): string {
  const base = sanitizeScope(user?.id ?? '')
  const laundry = user?.laundry_id ? sanitizeScope(String(user.laundry_id)) : ''
  return laundry ? `${base}::${laundry}` : base
}