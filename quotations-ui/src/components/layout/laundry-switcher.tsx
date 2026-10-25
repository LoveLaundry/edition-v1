import { useState } from 'react'
import {
  Store as Storefront,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { DropdownMenu, type MenuGroup } from '../ui/dropdown-menu'
import { cn } from '../../lib/utils'

/**
 * LaundrySwitcher — swap the active laundry for multi-laundry tenant users.
 *
 * Only shown when the session has multiple active laundries; platform admins and
 * support sessions do not use this control.
 */
export function LaundrySwitcher() {
  const { user, support, switchLaundry } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [switching, setSwitching] = useState(false)

  if (
    support ||
    user?.role_id === 'PLATFORM_ADMIN' ||
    !user?.laundries ||
    user.laundries.length < 2
  ) {
    return null
  }

  const humanize = (slug: string) => slug.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

  const groups: MenuGroup[] = [
    {
      label: 'Laundries',
      items: user.laundries.map((entry) => ({
        id: entry.id,
        label: humanize(entry.id),
        hint: entry.role,
        selected: entry.id === user.laundry_id,
        onSelect: async () => {
          if (switching) return
          setSwitching(true)
          try {
            await switchLaundry(entry.id)
            toast.success('Laundry switched')
            queryClient.clear()
            navigate('/', { replace: true })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to switch laundry'
            toast.error(message)
          } finally {
            setSwitching(false)
          }
        },
      })),
    },
  ]

  const activeLabel = user.laundry_id ? humanize(user.laundry_id) : 'Switch laundry'

  return (
    <DropdownMenu
      label="Laundry switcher"
      menuClassName="max-w-[min(300px,calc(100vw-16px))]"
      groups={groups}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          title="Switch active laundry"
          disabled={switching}
          className={cn(
            'flex h-8 max-w-[184px] items-center gap-1.5 rounded border px-2',
            'text-[12.5px] transition-colors duration-100 sm:max-w-[240px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]',
            switching && 'cursor-not-allowed opacity-60',
          )}
        >
          <Storefront size={15} aria-hidden className="shrink-0" />
          <span className="hidden shrink-0 text-[11px] font-semibold tracking-[0.03em] uppercase lg:inline">
            Laundry
          </span>
          <span className="min-w-0 truncate font-medium">{activeLabel}</span>
        </button>
      )}
    />
  )
}