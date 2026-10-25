import { AccessRoute } from './access-route'

/**
 * AdminRoute — tenant administrators (and platform administrators) only.
 * Delegates to AccessRoute so the rule matches `canAccess` everywhere.
 */
export function AdminRoute() {
  return <AccessRoute spec={{ roles: ['ADMIN', 'PLATFORM_ADMIN'] }} />
}
