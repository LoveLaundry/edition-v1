import type { ReactElement } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canAccess, landingPathFor, type AccessSpec } from '../../lib/access'

/**
 * AccessRoute — the single route guard.
 *
 * Every gated route used to carry its own hand-written guard (AdminRoute,
 * ManagerRoute, PlatformAdminRoute), each re-deriving the rule from role_id.
 * They now all funnel through `canAccess` in lib/access.ts, which is also what
 * decides whether a link is drawn. Hiding a link is not access control: this
 * guard is the enforcement point, and it can no longer disagree with the nav.
 */
export function AccessRoute({
  spec,
  children,
}: {
  spec: AccessSpec
  children?: ReactElement
}) {
  const { user, isAuthenticated, support } = useAuth()
  const location = useLocation()
  const supportActive = Boolean(support)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!canAccess(user, spec, supportActive)) {
    // Send the session somewhere it can actually render rather than a fixed
    // page that might itself be gated.
    return <Navigate to={landingPathFor(user, supportActive)} replace />
  }

  return children ?? <Outlet />
}
