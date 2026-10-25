/**
 * Single source for the outgoing auth token.
 *
 * Normally this is the stored session token. During an audited platform
 * support entry (see AuthContext) it is the short-lived support token, so
 * every API client automatically operates inside the entered laundry without
 * each call site knowing about support mode. The support token lives only in
 * memory: a reload safely drops back to the platform session.
 */
let supportToken: string | null = null

export function setSupportToken(token: string | null): void {
  supportToken = token
}

export function getActiveToken(): string | null {
  return (
    supportToken ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('ll_token') : null)
  )
}
