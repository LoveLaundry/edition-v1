import { AccessRoute } from './access-route'

/**
 * PlatformAdminRoute — only platform administrators.
 *
 * Stricter than AdminRoute (which also admits laundry admins): the laundry
 * registry must never be visible to tenant administrators.
 */
export function PlatformAdminRoute() {
  return <AccessRoute spec={{ platformOnly: true }} />
}
