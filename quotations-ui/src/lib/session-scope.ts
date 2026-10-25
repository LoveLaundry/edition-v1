import type { User } from '../types/auth'
import { isPlatformOnly as isPlatformOnlyFor, landingPathFor } from './access'

/**
 * Re-exported from lib/access.ts so the session-scope helpers and the access
 * helpers are one implementation. Existing imports keep working.
 */
export function isPlatformOnly(user: User | null, supportActive: boolean): boolean {
  return isPlatformOnlyFor(user, supportActive)
}

/** Routes a platform-only session is allowed to mount. */
export const PLATFORM_PATHS = ['/laundries', '/users', '/profile']

/** Where a platform-only session is sent when it strays off the platform surface. */
export const PLATFORM_LANDING = '/laundries'

export { landingPathFor }
