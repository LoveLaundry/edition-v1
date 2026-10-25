import { Navigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'

/**
 * LandingRedirect — sends `/` (and any access-denied bounce) to the best page
 * for the current session.
 *
 * The index route used to hard-redirect to `/today`. A platform-only session
 * was then bounced again out of `/today` by the app shell, and a session whose
 * role lacked every Overview surface would land on a page it could not use.
 * `landingPathFor` picks the first surface the session may actually open.
 */
export function LandingRedirect() {
  const { landingPath } = usePermissions()
  return <Navigate to={landingPath} replace />
}
