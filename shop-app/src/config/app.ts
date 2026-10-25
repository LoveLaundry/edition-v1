export interface NavItem {
  path: string
  label: string
  /** The real endpoint this screen consumes. */
  endpoint: string
  blurb: string
}

export const appConfig = {
  title: 'Shop Portal',
  tagline: 'Your bills, balances and statements with each laundry',
  authKind: 'client' as 'staff' | 'client',
  /**
   * Which side of the business this app signs in. A shop login and a hotel
   * login can share a username, so the side is sent explicitly at sign-in
   * rather than inferred from which app made the call.
   */
  clientType: 'SHOP' as 'SHOP' | 'HOTEL',
  loginPath: '/client/auth/login',
  statusPath: '/client/auth/status',
  nav: [
    {
      "path": "/",
      "label": "Account",
      "endpoint": "GET /client-portal/shop/summary",
      "blurb": "Open bills, balance and what was invoiced this month."
    },
    {
      "path": "/bills",
      "label": "Bills",
      "endpoint": "GET /client-portal/shop/bills",
      "blurb": "Every bill this shop has with the current laundry."
    }
  ] as NavItem[],
}
