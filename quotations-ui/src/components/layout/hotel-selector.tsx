import { useMemo } from 'react'
import {
  Building2 as Buildings,
  Layers as Stack,
} from 'lucide-react'
import { useHotel } from '../../context/HotelContext'
import { DropdownMenu, type MenuGroup } from '../ui/dropdown-menu'
import { cn } from '../../lib/utils'

/**
 * HotelSelector — the scope every record query is filtered by.
 *
 * "Select All" is a first-class, always-visible option for every role: an
 * aggregate view over all hotels plus a per-hotel list below it. Staff start
 * scoped to their first hotel (see HotelContext) but are one tap from All.
 */
export function HotelSelector() {
  const { hotels, selectedHotel, setSelectedHotel } = useHotel()

  const groups = useMemo<MenuGroup[]>(() => {
    const hotelItems = hotels.map((hotel) => ({
      id: hotel,
      label: hotel,
      selected: selectedHotel === hotel,
      onSelect: () => setSelectedHotel(hotel),
    }))

    return [
      {
        label: 'Scope',
        items: [
          {
            id: '__all',
            label: 'Select All',
            icon: <Stack size={16} />,
            hint: hotels.length ? `${hotels.length} hotels` : undefined,
            selected: selectedHotel === '',
            onSelect: () => setSelectedHotel(''),
          },
        ],
      },
      { label: 'Scope to one hotel', items: hotelItems },
    ]
  }, [hotels, selectedHotel, setSelectedHotel])

  const isAggregate = selectedHotel === ''
  const label = isAggregate ? 'Select All' : selectedHotel || 'Select hotel'

  return (
    <DropdownMenu
      label="Hotel scope"
      menuClassName="max-w-[min(300px,calc(100vw-16px))]"
      groups={groups}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          title="Records are filtered to the selected hotel"
          className={cn(
            'flex h-8 max-w-[184px] items-center gap-1.5 rounded border px-2',
            'text-[12.5px] transition-colors duration-100 sm:max-w-[240px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            isAggregate
              ? 'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]'
              : 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand-soft)]/70',
          )}
        >
          <Buildings
            size={15}
            aria-hidden
            className="shrink-0"
          />
          <span className="hidden shrink-0 text-[11px] font-semibold tracking-[0.03em] uppercase lg:inline">
            Scope
          </span>
          <span className="min-w-0 truncate font-medium">{label}</span>
        </button>
      )}
    />
  )
}
