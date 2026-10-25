import { useState, useRef, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search as MagnifyingGlass,
  Bell,
  Menu as List,
  LogOut as SignOut,
  User,
  CircleUser as UserCircle,
  Send as PaperPlaneTilt,
  FileText,
  CaseSensitive as TextAa,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { useTheme, isFontSize } from '../../context/ThemeContext'
import { useNotifications } from '../../features/quotations/hooks/useNotifications'
import { NotificationDetailDialog } from '../../features/quotations/components/notification-detail-dialog'
import { HotelSelector } from './hotel-selector'
import { LaundrySwitcher } from './laundry-switcher'
import { DropdownMenu, type MenuGroup } from '../ui/dropdown-menu'
import type { Quotation } from '../../types/quotation'
import type { GatePassPendingEntry, NotificationType } from '../../types/notification'

interface TopBarProps {
  title?: string
  sidebarCollapsed: boolean
  mobileMenuOpen: boolean
  onMobileMenuToggle: () => void
  onOpenSearch?: () => void
}

/**
 * TopBar — page identity plus the four things reachable from anywhere.
 *
 * Opaque, not glass: a translucent bar over scrolling data makes text hard to
 * read and looks like a consumer app. Height is 52px so it costs less vertical
 * space than the 64px bar it replaces. Below `sm` the search control collapses
 * to an icon and the user menu to an avatar, so nothing overlaps at 320px.
 */
export function TopBar({
  title,
  sidebarCollapsed,
  mobileMenuOpen,
  onMobileMenuToggle,
  onOpenSearch,
}: TopBarProps) {
  const { user, logout } = useAuth()
  const { support } = useAuth()
  const navigate = useNavigate()
  const { fontSize, setFontSize } = useTheme()
  const comfortOn = fontSize === 'xxxl'
  const toggleComfort = () => {
    if (comfortOn) {
      const prev = localStorage.getItem('theme-font-size-prev')
      setFontSize(isFontSize(prev) && prev !== 'xxxl' ? prev : 'md')
    } else {
      localStorage.setItem('theme-font-size-prev', fontSize)
      setFontSize('xxxl')
    }
  }
  const [showNotifications, setShowNotifications] = useState(false)
  const [
    selectedNotification,
    setSelectedNotification,
  ] = useState<{ item: Quotation | GatePassPendingEntry; type: NotificationType } | null>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const notifId = useId()

  const { totalCount, notificationItems, isLoading } = useNotifications()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!showNotifications) return
    const onDown = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotifications(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showNotifications])

  const initials = user?.user_name ? user.user_name.slice(0, 2).toUpperCase() : 'U'
  const roleLabel = user?.role_id ? String(user.role_id).toLowerCase() : 'staff'

  const iconBtn =
    'pressable inline-flex size-8 items-center justify-center rounded border border-transparent text-[var(--text-muted)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

  const userMenu: MenuGroup[] = [
    {
      items: [
        {
          id: 'profile',
          label: 'My profile',
          icon: <UserCircle size={16} />,
          onSelect: () => navigate('/profile'),
        },
        { id: 'settings', label: 'Settings', icon: <User size={16} />, onSelect: () => navigate('/settings') },
        {
          id: 'logout',
          label: 'Sign out',
          icon: <SignOut size={16} />,
          destructive: true,
          onSelect: handleLogout,
        },
      ],
    },
  ]

  return (
    <>
      <header
        className={cn(
          'app-topbar fixed right-0 z-30 flex h-13 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)]',
          'px-3 transition-[left] duration-150 ease-out sm:px-4',
          support ? 'top-9' : 'top-0',
          sidebarCollapsed ? 'left-0 lg:left-[60px]' : 'left-0 lg:left-[236px]',
        )}
      >
        {/* Left: menu + page identity */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className={cn(iconBtn, '-ml-1 lg:hidden')}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
          >
            <List size={19} aria-hidden />
          </button>

          {title && (
            <h1 className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.012em] text-[var(--text-primary)]">
              {title}
            </h1>
          )}
        </div>

        {/* Right: scope, search, notifications, account */}
        <div className="flex shrink-0 items-center gap-1.5">
          <HotelSelector />
          <LaundrySwitcher />

          <button
            type="button"
            onClick={() => onOpenSearch?.()}
            aria-label="Search (Ctrl+K)"
            title="Search (Ctrl+K)"
            className={cn(
              iconBtn,
              'sm:h-8 sm:w-auto sm:gap-1.5 sm:border-[var(--border-2)] sm:px-2.5',
            )}
          >
            <MagnifyingGlass size={16} aria-hidden />
            <span className="hidden text-[12.5px] font-medium sm:inline">Search</span>
            <kbd className="ml-1 hidden rounded-xs border border-[var(--border)] bg-[var(--surface-2)] px-1 py-px text-[10px] font-semibold text-[var(--text-faint)] lg:inline">
              Ctrl K
            </kbd>
          </button>

          {/* Comfort text size — one tap, easy for elders */}
          <button
            type="button"
            onClick={toggleComfort}
            aria-label={comfortOn ? 'Comfort text size on — tap for normal size' : 'Comfort text size off — tap for largest text'}
            aria-pressed={comfortOn}
            title={comfortOn ? 'Comfort text: on' : 'Comfort text: off'}
            className={cn(
              iconBtn,
              'sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5',
              comfortOn
                ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)]'
                : 'sm:border-[var(--border-2)]',
            )}
          >
            <TextAa size={17} aria-hidden />
            <span className="hidden text-[12.5px] font-medium sm:inline">Aa</span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => setShowNotifications((v) => !v)}
              className={cn(iconBtn, 'relative')}
              aria-label={
                isLoading
                  ? 'Loading notifications'
                  : totalCount > 0
                    ? `Notifications, ${totalCount} new`
                    : 'Notifications, none new'
              }
              aria-expanded={showNotifications}
              aria-controls={notifId}
            >
              <Bell size={17} aria-hidden />
              {totalCount > 0 && !isLoading && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--brand)] px-0.5 text-[9.5px] leading-[14px] font-bold text-white tabular-nums"
                >
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                id={notifId}
                className="absolute right-0 z-50 mt-1.5 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded border border-[var(--border-2)] bg-[var(--surface)] shadow-[var(--shadow-pop)]"
              >
                <div className="flex min-h-11 items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-2">
                  <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    Notifications
                  </h2>
                  {totalCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(false)
                        navigate('/notifications')
                      }}
                      className="text-[12px] font-medium text-[var(--brand-text)] hover:underline"
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="max-h-[min(400px,60dvh)] overflow-y-auto">
                  {isLoading ? (
                    <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-muted)]">
                      Loading…
                    </p>
                  ) : notificationItems.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">
                        No notifications
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        Nothing needs your attention.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[var(--border)]">
                      {notificationItems.map((notification) => {
                        const entries = (
                          (notification.type === 'gatepass_pending'
                            ? notification.gatePassItems
                            : notification.quotations) ?? []
                        ) as Array<Quotation | GatePassPendingEntry>
                        return (
                          <li key={notification.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setShowNotifications(false)
                                navigate('/notifications')
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setShowNotifications(false)
                                  navigate('/notifications')
                                }
                              }}
                              className="cursor-pointer px-3.5 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              <div className="flex items-start gap-2.5">
                                <span
                                  aria-hidden
                                  className={cn(
                                    'mt-px flex size-7 shrink-0 items-center justify-center rounded border',
                                    notification.type === 'gatepass_pending'
                                      ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)]'
                                      : 'border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info-text)]',
                                  )}
                                >
                                  {notification.type === 'gatepass_pending' ? (
                                    <PaperPlaneTilt size={15} />
                                  ) : (
                                    <FileText size={15} />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
                                    {notification.title}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[var(--text-muted)]">
                                    {notification.message}
                                  </p>
                                  {entries.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {entries.slice(0, 3).map((item, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedNotification({ item, type: notification.type })
                                          }}
                                          className="max-w-[9rem] truncate rounded-xs border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)]"
                                        >
                                          {item.client_name}
                                        </button>
                                      ))}
                                      {entries.length > 3 && (
                                        <span className="px-1 text-[10.5px] text-[var(--text-faint)]">
                                          +{entries.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Account */}
          <DropdownMenu
            label="Account"
            groups={userMenu}
            trigger={(p) => (
              <button
                {...(p as any)}
                type="button"
                aria-label={`Account menu for ${user?.user_name ?? 'user'}`}
                className={cn(
                  'flex max-w-[168px] items-center gap-2 rounded border border-transparent py-1 pr-1 pl-1',
                  'transition-colors duration-100 hover:bg-[var(--surface-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--surface-3)] text-[11px] font-semibold text-[var(--text-secondary)]">
                  {user?.user_dp ? (
                    <img src={user.user_dp} alt="" className="size-full object-cover" />
                  ) : user ? (
                    initials
                  ) : (
                    <User size={14} aria-hidden />
                  )}
                </span>
                <span className="hidden min-w-0 text-left leading-tight sm:block">
                  <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                    {user?.user_name ?? 'User'}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--text-muted)] capitalize">
                    {roleLabel}
                  </span>
                </span>
              </button>
            )}
          />
        </div>
      </header>

      <NotificationDetailDialog
        open={!!selectedNotification}
        onOpenChange={(open) => !open && setSelectedNotification(null)}
        data={selectedNotification?.item ?? null}
        type={selectedNotification?.type ?? 'gatepass_pending'}
      />
    </>
  )
}
