import { AccessRoute } from './access-route'

/**
 * ManagerRoute — gates payroll, HR, expense and reporting screens to the roles
 * that hold those capabilities: ADMIN, MANAGER (and platform administrators).
 *
 * Every restricted `management/*` path is wrapped here in src/routes/index.tsx.
 * The rule is the same `adminOnly` rule the sidebar and palette use, so a link
 * can never appear for a role the guard would bounce. It is kept in step with
 * `ROLE_CAPABILITIES` in laundry-management/src/auth_helper.py.
 */
export function ManagerRoute() {
  return <AccessRoute spec={{ adminOnly: true }} />
}
