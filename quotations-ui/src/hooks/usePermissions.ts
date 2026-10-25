import { useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  canAccess as canAccessFor,
  hasPermission as hasPermissionFor,
  isPlatformAdmin as isPlatformAdminFor,
  landingPathFor,
  roleOf,
  permissionsOf,
  type AccessSpec,
} from '../lib/access'

/**
 * usePermissions — the session's access decisions, memoised.
 *
 * Previously this hook rebuilt `hasPermission` on every render, so any consumer
 * that listed it in a dependency array re-ran on each pass (the sidebar filtered
 * its whole tree every render, the palette re-filtered every keystroke). The
 * callbacks are now stable for the life of a session, and every decision is
 * delegated to lib/access.ts so the hook can never drift from the route guards.
 */
export function usePermissions() {
  const { user, support } = useAuth()
  const supportActive = Boolean(support)
  const role = roleOf(user)
  const permissions = useMemo(() => permissionsOf(user), [user])

  const hasPermission = useCallback(
    (permission: string) => hasPermissionFor(user, permission),
    [user],
  )

  const canAccess = useCallback(
    (spec: AccessSpec) => canAccessFor(user, spec, supportActive),
    [user, supportActive],
  )

  const isPlatformAdmin = useMemo(() => isPlatformAdminFor(user), [user])

  const landingPath = useMemo(
    () => landingPathFor(user, supportActive),
    [user, supportActive],
  )

  const isAdmin = role === 'ADMIN' || role === 'PLATFORM_ADMIN'

  return { role, permissions, hasPermission, canAccess, isPlatformAdmin, isAdmin, landingPath }
}
