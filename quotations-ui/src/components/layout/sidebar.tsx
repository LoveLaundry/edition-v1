import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { LucideIcon as Icon } from 'lucide-react'
import {
  House,
  ChartColumn as ChartBar,
  ClipboardList as ClipboardText,
  Truck,
  UsersRound as UsersThree,
  CircleDollarSign as CurrencyCircleDollar,
  FileText,
  Building2 as Buildings,
  FolderOpen,
  Settings as GearSix,
  Users,
  Database,
  ChevronLeft as CaretLeft,
  ChevronRight as CaretRight,
  MessageCircle as ChatCircleDots,
  ScanLine as Scan,
  Upload,
  ListChecks,
  Receipt,
  CircleUser as UserCircle,
  Package,
  Wallet,
  Banknote as Money,
  CalendarDays as CalendarBlank,
  CalendarPlus,
  X,
  Zap as Lightning,
  Brain,
  CloudDownload as CloudArrowDown,
  Workflow as FlowArrow,
  ChevronDown as CaretDown,
  ChartNoAxesCombined as ChartLineUp,
} from 'lucide-react'
import { LogoOnDark } from '../brand/logo'
import { cn } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { NAV_GROUPS, ROUTES, type NavGroupId } from '../../config/route-meta'
import { usePermissions } from '../../hooks/usePermissions'
import type { AccessSpec } from '../../lib/access'

/**
 * Icon lookup. `route-meta.ts` stores icon *keys* so it stays a plain data
 * module with no React import; the keys are resolved here, where the icons
 * already live. A key with no entry falls back to a neutral glyph rather than
 * crashing the rail.
 */
const ICONS: Record<string, Icon> = {
  House, ChartBar, ClipboardText, Truck, UsersThree, CurrencyCircleDollar, FileText, Buildings,
  FolderOpen, GearSix, Users, Database, ChatCircleDots, Scan, Upload, ListChecks, Receipt,
  UserCircle, Package, Wallet, Money, CalendarBlank, CalendarPlus, Lightning, Brain,
  CloudArrowDown, FlowArrow, ChartLineUp,
}

function iconFor(key?: string): Icon {
  return (key && ICONS[key]) || FileText
}

interface NavItem {
  to: string
  label: string
  icon: Icon
  end?: boolean
  children?: NavItem[]
}

/**
 * Children grouped under a parent row. The registry lists these routes
 * flat (the command palette wants them flat); the sidebar nests them.
 */
const CHILDREN: Record<string, string[]> = {
  '/workers': ['/workers/daily-tasks'],
  '/management/employees': [
    '/management/salary-slip',
    '/management/salary-history',
    '/management/advances',
    '/management/holidays',
    '/management/extra-work',
    '/management/attendance',
    '/management/attendance-log',
  ],
}

/** Routes whose access spec is inherited from a parent (children of a guarded
 *  group) rather than declared on the route itself. */
const INHERIT: Record<string, string> = Object.fromEntries(
  Object.entries(CHILDREN).flatMap(([parent, kids]) => kids.map((k) => [k, parent])),
)

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const { support } = useAuth()
  const mobileDrawerRef = useRef<HTMLElement>(null)
  const closeMobileRef = useRef(onMobileClose)

  useEffect(() => {
    closeMobileRef.current = onMobileClose
  }, [onMobileClose])

  useEffect(() => {
    if (!mobileOpen) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const drawer = mobileDrawerRef.current
    drawer?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobileRef.current()
        return
      }
      if (event.key !== 'Tab' || !drawer) return

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!drawer.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [mobileOpen])

  // Any navigation closes the mobile drawer.
  useEffect(() => {
    if (mobileOpen) onMobileClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <>
      {/* Desktop rail. Width is a plain CSS transition rather than a JS-driven
          animation so the shell padding tracks it exactly. */}
      <aside
        className={cn(
          'sidebar-dark fixed bottom-0 left-0 z-40 hidden flex-col overflow-hidden lg:flex',
          'transition-[width] duration-150 ease-out',
          support ? 'top-9' : 'top-0',
          collapsed ? 'w-[60px]' : 'w-[236px]',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={onToggle} isMobile={false} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="overlay-backdrop fixed inset-0 z-40 lg:hidden"
            onClick={onMobileClose}
            aria-hidden
          />
          <aside
            ref={mobileDrawerRef}
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            tabIndex={-1}
            className="nav-drawer sidebar-dark fixed inset-y-0 left-0 z-50 flex w-[268px] max-w-[85vw] flex-col lg:hidden"
            style={{ animation: 'slide-in-left 160ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <SidebarContent
              collapsed={false}
              onToggle={onToggle}
              isMobile
              onMobileClose={onMobileClose}
            />
            {/* The keyframes follow the animation token (slide-up uses the same
                curve); injected here because the drawer is the only consumer. */}
            <style>{`@keyframes slide-in-left{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
          </aside>
        </>
      )}
    </>
  )
}

interface SidebarContentProps {
  collapsed: boolean
  onToggle: () => void
  isMobile: boolean
  onMobileClose?: () => void
}

function SidebarContent({ collapsed, onToggle, isMobile, onMobileClose }: SidebarContentProps) {
  const { canAccess } = usePermissions()

  /**
   * The rail is built from the route registry, so a listed link and an allowed
   * route are decided by the same rule. A platform-only session sees only the
   * Platform group (canAccess rejects every tenant group for it); a tenant
   * session sees whatever its capabilities allow. Groups with nothing left
   * after filtering are dropped.
   */
  const groups = useMemo(() => {
    const specFor = (path: string): AccessSpec => {
      const target = INHERIT[path] ? specFor(INHERIT[path]) : ROUTES.find((r) => r.path === path)
      if (!target) return {}
      return {
        permissions: target.permissions,
        roles: target.roles,
        adminOnly: target.adminOnly,
        platformOnly: target.platformOnly,
        tenantOnly: target.tenantOnly,
      }
    }

    return NAV_GROUPS.map((group) => {
      const items = ROUTES.filter(
        (r) => r.group === group.id && r.navLabel && canAccess(specFor(r.path)),
      )
        .filter((r) => !INHERIT[r.path])
        .map<NavItem>((r) => {
          const kids =
            CHILDREN[r.path]
              ?.map((p) => ROUTES.find((x) => x.path === p))
              .filter((x): x is (typeof ROUTES)[number] => Boolean(x) && canAccess(specFor(x!.path)))
              .map<NavItem>((x) => ({
                to: x.path,
                label: x.navLabel ?? x.title,
                icon: iconFor(x.icon),
              })) ?? []
          return {
            to: r.path,
            label: r.navLabel ?? r.title,
            icon: iconFor(r.icon),
            end: r.path === '/workers',
            children: kids.length ? kids : undefined,
          }
        })
      return { id: group.id as NavGroupId, label: group.label, items }
    }).filter((g) => g.items.length > 0)
  }, [canAccess])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      {/* Brand */}
      <div
        className={cn(
          'flex h-13 shrink-0 items-center border-b border-[var(--sidebar-border)] px-3.5',
          collapsed && 'justify-center px-0',
        )}
      >
        <LogoOnDark collapsed={collapsed} />
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="ml-auto flex size-8 shrink-0 items-center justify-center rounded text-[var(--sidebar-label)] transition-colors hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X size={17} aria-hidden />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav
        aria-label="Main"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
          'px-2 py-3',
          '[scrollbar-width:thin]',
        )}
      >
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold tracking-[0.07em] text-[var(--sidebar-label)] uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarNavItem item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse control — desktop only; the drawer has no collapse state. */}
      {!isMobile && (
        <div className="shrink-0 border-t border-[var(--sidebar-border)] p-2">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-2',
              'text-[12px] font-medium text-[var(--sidebar-label)]',
              'transition-colors duration-100 hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <CaretRight size={14} aria-hidden /> : <CaretLeft size={14} aria-hidden />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
  const { to, label, icon: Icon, end, children } = item
  const hasChildren = Boolean(children?.length)
  const [expanded, setExpanded] = useState(false)
  const location = useLocation()

  // A parent is "open" when it, or any descendant, is the current route.
  const childActive = hasChildren && children!.some((c) => location.pathname.startsWith(c.to))
  const open = expanded || childActive

  return (
    <div>
      <div className="relative">
        <NavLink
          to={to}
          end={end}
          onClick={(e) => {
            // A parent that owns children toggles rather than navigating on the
            // first tap, but still navigates if it is already open.
            if (hasChildren && !collapsed && !open) {
              e.preventDefault()
              setExpanded(true)
            }
          }}
          title={collapsed ? label : undefined}
          aria-current={undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-2.5 rounded-md py-2 pr-2.5 pl-2.5',
              'text-[13px] font-medium transition-colors duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              collapsed && 'justify-center px-0',
              // Active = soft branded chip (a whisper of the brand, not a slab).
              // Inactive = transparent until hover.
              isActive
                ? 'bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active)] shadow-[inset_0_0_0_1px_var(--sidebar-active-border)]'
                : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)]',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={17}
                aria-hidden
                className={cn(
                  'shrink-0',
                  isActive
                    ? 'text-[var(--sidebar-active)]'
                    : 'text-[var(--sidebar-label)] group-hover:text-[var(--sidebar-hover-text)]',
                )}
              />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
              {!collapsed && hasChildren && (
                <CaretDown
                  size={13}
                  aria-hidden
                  className={cn(
                    'shrink-0 text-[var(--sidebar-label)] transition-transform duration-150',
                    open && 'rotate-180',
                  )}
                />
              )}
            </>
          )}
        </NavLink>
      </div>

      {/* Sub-items. Indented with a rail rather than a filled block, so the
          parent stays readable as the section heading. */}
      {hasChildren && !collapsed && open && (
        <ul className="relative mt-0.5 ml-[18px] space-y-0.5 border-l border-[var(--sidebar-border)] pl-2.5">
          {children!.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-sm py-1.5 pr-2 pl-2.5 text-[12.5px] font-medium',
                    'transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                    isActive
                      ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active)]'
                      : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                        isActive ? 'bg-[var(--sidebar-indicator)]' : 'bg-[var(--sidebar-border)]',
                      )}
                    />
                    <span className="min-w-0 truncate">{child.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
