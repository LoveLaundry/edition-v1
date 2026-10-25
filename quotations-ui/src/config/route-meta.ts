import type { AccessSpec } from '../lib/access'

/**
 * route-meta.ts — one registry for every navigable page.
 *
 * The sidebar, the command palette, the today-page quick actions and the route
 * guards all read from here. Adding a page is a single entry: its access rules,
 * its group, the title the top bar shows and the keywords the palette matches
 * on all travel together, so they cannot disagree.
 *
 * `icon` is a *key*, not a component, so this module stays a plain data file
 * with no React import. The sidebar and palette resolve the key to a Lucide
 * icon through their own maps.
 */

export type NavGroupId =
  | 'Platform'
  | 'Overview'
  | 'Operations'
  | 'Linen'
  | 'Contracts'
  | 'Management'
  | 'Analytics'
  | 'System'

export interface RouteMeta extends AccessSpec {
  path: string
  /** Title shown by the top bar. */
  title: string
  /** Sidebar entry label; omit for pages that are reachable but not listed
   *  (detail pages, print views, create-from-list flows). */
  navLabel?: string
  group?: NavGroupId
  /** Extra words the command palette matches beyond the title. */
  keywords?: string
  /** Icon key resolved by the consumer. */
  icon?: string
  /** Whether the route guard should enforce `spec`. Detail/create routes that
   *  inherit their parent's access leave this false. */
  guarded?: boolean
}

export const ROUTES: RouteMeta[] = [
  // ── Overview ────────────────────────────────────────────────────────────────
  { path: '/today', title: 'Daily Operations', navLabel: 'Today', group: 'Overview', icon: 'Lightning', keywords: 'today daily operations home' },
  { path: '/dashboard', title: 'Dashboard', navLabel: 'Dashboard', group: 'Overview', icon: 'House', keywords: 'dashboard overview' },
  { path: '/business-dashboard', title: 'Business Intelligence', navLabel: 'Business Intelligence', group: 'Overview', icon: 'ChartBar', keywords: 'business dashboard analytics insights' },
  { path: '/live-chat', title: 'Live Chat', navLabel: 'Live Chat', group: 'Overview', icon: 'ChatCircleDots', keywords: 'chat assistant', roles: ['ADMIN', 'MANAGER'] },
  { path: '/notifications', title: 'Notifications', keywords: 'alerts inbox' },

  // ── Operations ──────────────────────────────────────────────────────────────
  { path: '/gate-passes', title: 'Gate Passes', navLabel: 'Gate Passes', group: 'Operations', icon: 'ClipboardText', keywords: 'gate passes receiving received', permissions: ['view_gate_passes'] },
  { path: '/gate-passes/new', title: 'New Gate Pass', keywords: 'gate pass new receive', permissions: ['view_gate_passes'] },
  { path: '/monthly-operations', title: 'Monthly Operations', navLabel: 'Monthly Operations', group: 'Operations', icon: 'CalendarBlank', keywords: 'monthly operations', permissions: ['view_gate_passes'] },
  { path: '/deliveries', title: 'Deliveries', navLabel: 'Deliveries', group: 'Operations', icon: 'Truck', keywords: 'deliveries sent delivery', permissions: ['view_deliveries'] },
  { path: '/deliveries/new', title: 'New Delivery', keywords: 'delivery new deliver', permissions: ['view_deliveries'] },
  { path: '/dispatch', title: 'Dispatch', navLabel: 'Dispatch', group: 'Operations', icon: 'Package', keywords: 'dispatch pickup schedule delivery', permissions: ['view_deliveries'] },
  { path: '/hotel-linen-flow', title: 'Hotel Linen Flow', navLabel: 'Hotel Linen Flow', group: 'Operations', icon: 'FlowArrow', keywords: 'hotel linen movement tracking' },
  { path: '/returns', title: 'Returns', navLabel: 'Returns', group: 'Operations', icon: 'ClipboardText', keywords: 'returns refunds', permissions: ['view_gate_passes'] },
  { path: '/returns/new', title: 'Record Return', keywords: 'return new record', permissions: ['view_gate_passes'] },
  { path: '/workers', title: 'Staff Management', navLabel: 'Staff', group: 'Operations', icon: 'Users', keywords: 'workers staff employees' },
  { path: '/workers/daily-tasks', title: 'Daily Tasks', navLabel: 'Daily Tasks', group: 'Operations', icon: 'UsersThree', keywords: 'daily tasks work' },
  { path: '/bills', title: 'Bills', navLabel: 'Bills', group: 'Operations', icon: 'CurrencyCircleDollar', keywords: 'bills invoices list', permissions: ['view_bills'] },
  { path: '/bills/new', title: 'Create Bill', keywords: 'bill create invoice', permissions: ['view_bills'] },
  { path: '/income', title: 'Income', navLabel: 'Income', group: 'Operations', icon: 'Money', keywords: 'income revenue received gate passes billed', permissions: ['view_bills'] },
  { path: '/ledger', title: 'Ledger', navLabel: 'Ledger', group: 'Operations', icon: 'Receipt', keywords: 'ledger balance owed accrued payments bills', permissions: ['view_bills'] },
  { path: '/statements', title: 'Client Statement', navLabel: 'Client Statement', group: 'Operations', icon: 'Wallet', keywords: 'statement client ledger history balance', permissions: ['view_bills'] },
  { path: '/invoices/new', title: 'Consolidated Invoice', navLabel: 'Invoices', group: 'Operations', icon: 'FileText', keywords: 'invoice new consolidated', permissions: ['view_bills'] },
  { path: '/shop-bills', title: 'Shop Bills', navLabel: 'Shop Bills', group: 'Operations', icon: 'CurrencyCircleDollar', keywords: 'shop bills cash', permissions: ['view_bills'] },
  { path: '/shop-bills/dashboard', title: 'Shop Bills Dashboard', navLabel: 'Shop Analytics', group: 'Operations', icon: 'ChartLineUp', keywords: 'shop bills dashboard analytics summary', permissions: ['view_bills'] },
  { path: '/shop-bills/new', title: 'Create Shop Bill', keywords: 'shop bill create new', permissions: ['view_bills'] },
  { path: '/legacy-invoice', title: 'Legacy Invoice', navLabel: 'Legacy Invoice', group: 'Operations', icon: 'FileText', keywords: 'legacy invoice old bills', permissions: ['view_bills'] },

  // ── Linen Tracking ──────────────────────────────────────────────────────────
  { path: '/linen', title: 'Linen Dashboard', navLabel: 'Dashboard', group: 'Linen', icon: 'House', keywords: 'linen tracking dashboard' },
  { path: '/linen/inventory', title: 'Linen Inventory', navLabel: 'Inventory', group: 'Linen', icon: 'ClipboardText', keywords: 'linen stock inventory' },
  { path: '/linen/scanner', title: 'Scan Linen', navLabel: 'Scan Linen', group: 'Linen', icon: 'Scan', keywords: 'linen scan barcode' },
  { path: '/linen/bulk-scan', title: 'Bulk Scan', navLabel: 'Bulk Scan', group: 'Linen', icon: 'Scan', keywords: 'linen bulk scan barcode' },
  { path: '/linen/tags', title: 'Tag Generator', navLabel: 'Tag Generator', group: 'Linen', icon: 'FileText', keywords: 'linen tags qr barcode' },
  { path: '/linen/gate-pass', title: 'Gate Pass (Camelot)', navLabel: 'Gate Pass (Camelot)', group: 'Linen', icon: 'FileText', keywords: 'linen receipt uniform camelot' },
  { path: '/linen/gate-pass/linen', title: 'Camelot Linen Receipt', keywords: 'camelot linen receipt' },
  { path: '/linen/gate-pass/uniform', title: 'Camelot Uniform Receipt', keywords: 'camelot uniform receipt' },

  // ── Contracts ───────────────────────────────────────────────────────────────
  { path: '/quotations', title: 'Quotations', navLabel: 'Quotations', group: 'Contracts', icon: 'FileText', keywords: 'quotations quotes list price', permissions: ['view_quotations'] },
  { path: '/quotations/new', title: 'New Quotation', keywords: 'quote new quotation create', permissions: ['view_quotations'] },
  { path: '/categories', title: 'Categories', navLabel: 'By Client', group: 'Contracts', icon: 'FolderOpen', keywords: 'categories clients price list', permissions: ['view_clients'] },
  { path: '/customers', title: 'Customers', navLabel: 'Customers 360', group: 'Contracts', icon: 'Users', keywords: 'customers clients' },

  // ── Management ──────────────────────────────────────────────────────────────
  { path: '/management', title: 'Management Dashboard', navLabel: 'Dashboard', group: 'Management', icon: 'House', keywords: 'management overview' },
  { path: '/management/transactions', title: 'All Transactions', navLabel: 'Transactions', group: 'Management', icon: 'ListChecks', keywords: 'transactions all management' },
  { path: '/management/customers', title: 'Manage Customers', navLabel: 'Customers', group: 'Management', icon: 'Users', keywords: 'management customers' },
  { path: '/management/items', title: 'Items & Categories', navLabel: 'Items & Categories', group: 'Management', icon: 'Package', keywords: 'items categories management' },
  { path: '/management/payments', title: 'Payments', navLabel: 'Payments', group: 'Management', icon: 'Wallet', keywords: 'payments management' },
  { path: '/management/historical-entry', title: 'Historical Data Entry', navLabel: 'Data Entry', group: 'Management', icon: 'ClipboardText', keywords: 'historical data entry', adminOnly: true, guarded: true },
  { path: '/management/import', title: 'Import Historical Data', navLabel: 'Import Data', group: 'Management', icon: 'Upload', keywords: 'import historical data upload', adminOnly: true, guarded: true },
  { path: '/management/expenses', title: 'Expense Management', navLabel: 'Expenses', group: 'Management', icon: 'Receipt', keywords: 'expenses management', adminOnly: true, guarded: true },
  { path: '/management/employees', title: 'Employees & Salaries', navLabel: 'Employees', group: 'Management', icon: 'UserCircle', keywords: 'employees salaries management', adminOnly: true, guarded: true },
  { path: '/management/salary-slip', title: 'Generate Salary Slip', navLabel: 'Generate Slip', group: 'Management', icon: 'Money', keywords: 'salary slip payroll', adminOnly: true, guarded: true },
  { path: '/management/salary-history', title: 'Salary History', navLabel: 'Salary History', group: 'Management', icon: 'ListChecks', keywords: 'salary history payroll', adminOnly: true, guarded: true },
  { path: '/management/advances', title: 'Salary Advances', navLabel: 'Advances', group: 'Management', icon: 'Wallet', keywords: 'advances salary loans', adminOnly: true, guarded: true },
  { path: '/management/holidays', title: 'Holiday Calendar', navLabel: 'Holidays', group: 'Management', icon: 'CalendarBlank', keywords: 'holidays calendar', adminOnly: true, guarded: true },
  { path: '/management/extra-work', title: 'Extra Work Records', navLabel: 'Extra Work', group: 'Management', icon: 'Lightning', keywords: 'extra work overtime', adminOnly: true, guarded: true },
  { path: '/management/attendance', title: 'Attendance Entry', navLabel: 'Attendance', group: 'Management', icon: 'CalendarBlank', keywords: 'attendance present', adminOnly: true, guarded: true },
  { path: '/management/attendance-log', title: 'Log Attendance — All Staff', navLabel: 'Log Attendance', group: 'Management', icon: 'CalendarPlus', keywords: 'log staff attendance', adminOnly: true, guarded: true },
  { path: '/management/company-settings', title: 'Company Settings', navLabel: 'Company Settings', group: 'Management', icon: 'GearSix', keywords: 'company settings', adminOnly: true, guarded: true },
  { path: '/management/reports', title: 'Management Reports', navLabel: 'Management Reports', group: 'Management', icon: 'ChartBar', keywords: 'management payroll reports', adminOnly: true, guarded: true },

  // ── Analytics ───────────────────────────────────────────────────────────────
  { path: '/reports', title: 'Reports', navLabel: 'Reports', group: 'Analytics', icon: 'ChartBar', keywords: 'reports export sales', permissions: ['view_reports'] },
  { path: '/ai-insights', title: 'AI Insights', navLabel: 'AI Insights', group: 'Analytics', icon: 'Brain', keywords: 'ai analytics insights' },

  // ── System ──────────────────────────────────────────────────────────────────
  { path: '/profile', title: 'My Profile', keywords: 'profile account' },
  { path: '/settings', title: 'Settings', navLabel: 'Settings', group: 'System', icon: 'GearSix', keywords: 'settings preferences' },
  { path: '/users', title: 'Users', navLabel: 'Users', group: 'System', icon: 'Users', keywords: 'users staff accounts', roles: ['ADMIN', 'PLATFORM_ADMIN'], guarded: true },
  { path: '/database-sync', title: 'Database Sync', navLabel: 'Database Sync', group: 'System', icon: 'Database', keywords: 'database synchronization offline', roles: ['ADMIN'], guarded: true },
  { path: '/reports-backup', title: 'Reports & Backup', navLabel: 'Reports & Backup', group: 'System', icon: 'CloudArrowDown', keywords: 'backup restore export', roles: ['ADMIN'], guarded: true },

  // ── Platform (registry) ─────────────────────────────────────────────────────
  { path: '/laundries', title: 'Laundries', navLabel: 'Laundries', group: 'Platform', icon: 'Buildings', keywords: 'laundries platform tenants registry businesses', platformOnly: true, guarded: true },
]

/** The navigation groups, in sidebar order, each with the routes it lists. */
export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'Platform', label: 'Platform' },
  { id: 'Overview', label: 'Overview' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Linen', label: 'Linen Tracking' },
  { id: 'Contracts', label: 'Contracts' },
  { id: 'Management', label: 'Management' },
  { id: 'Analytics', label: 'Analytics' },
  { id: 'System', label: 'System' },
]

/** Look up a route's metadata by exact path. */
export function routeMeta(path: string): RouteMeta | undefined {
  return ROUTES.find((r) => r.path === path)
}

/** Longest-prefix match, so `/quotations/123` resolves to `/quotations`. */
export function routeMetaForPath(pathname: string): RouteMeta | undefined {
  const exact = ROUTES.find((r) => r.path === pathname)
  if (exact) return exact
  return ROUTES.filter((r) => r.path !== '/' && pathname.startsWith(r.path + '/')).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]
}
