import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useGatePasses } from '../features/quotations/hooks/useGatePasses'
import { useDeliveries } from '../features/quotations/hooks/useDeliveries'
import { useBills } from '../features/quotations/hooks/useBills'
import { useQuotations } from '../features/quotations/hooks/useQuotations'

/**
 * Hotel-first workspace.
 *
 * Laundry records (gate passes, deliveries, bills) carry a `client_name`
 * (no dedicated hotel field). This context exposes the distinct set of
 * clients so the top bar can scope every operations page to one hotel while
 * persisting the choice per user. "All Hotels" ("") is admin-only.
 */
interface HotelContextValue {
    hotels: string[]
    selectedHotel: string
    setSelectedHotel: (name: string) => void
    isAdmin: boolean
    showAllHotels: boolean
}

const HotelContext = createContext<HotelContextValue | null>(null)

export function HotelProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const _role = user?.role_id?.toUpperCase()
    const isAdmin = _role === 'ADMIN' || _role === 'PLATFORM_ADMIN'

    const storageKey = useMemo(() => `ll_hotel_${user?.id ?? ''}`, [user?.id])

    const [selectedHotel, setSelectedHotelState] = useState<string>(() => {
        try {
            return localStorage.getItem(storageKey) ?? ''
        } catch {
            return ''
        }
    })

    // Whether the user ever picked a scope explicitly. Staff with no stored
    // choice start scoped to their first hotel; an explicit '' (Select All)
    // is honoured for every role.
    const choiceWasStored = useRef<{ key: string; value: boolean } | null>(null)
    if (choiceWasStored.current?.key !== storageKey) {
        try {
            choiceWasStored.current = {
                key: storageKey,
                value: localStorage.getItem(storageKey) !== null,
            }
        } catch {
            choiceWasStored.current = { key: storageKey, value: false }
        }
    }

    const { data: gatePasses = [] } = useGatePasses()
    const { data: deliveries = [] } = useDeliveries()
    const { data: billsResp } = useBills({ limit: 1000 })
    const { data: quotations = [] } = useQuotations()

    const hotels = useMemo(() => {
        const set = new Set<string>()
        gatePasses.forEach(g => { if (g.client_name) set.add(g.client_name) })
        deliveries.forEach(d => { if (d.client_name) set.add(d.client_name) })
        ;(billsResp?.items ?? []).forEach(b => { if (b.client_name) set.add(b.client_name) })
        quotations.forEach(q => { if (q.client_name) set.add(q.client_name) })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [gatePasses, deliveries, billsResp, quotations])

    const setSelectedHotel = useCallback((name: string) => {
        if (choiceWasStored.current) choiceWasStored.current.value = true
        setSelectedHotelState(name)
        try {
            localStorage.setItem(storageKey, name)
        } catch {
            // Ignore storage failures (private mode etc.) — selection just won't persist.
        }
    }, [storageKey])

    // Keep the stored choice valid. '' (Select All) is a deliberate scope for
    // every role; only a stale hotel name gets repaired. Staff with no stored
    // choice start on their first hotel instead of the aggregate view.
    const storedChoice = choiceWasStored.current?.value ?? false
    useEffect(() => {
        if (hotels.length === 0) return
        if (selectedHotel && !hotels.includes(selectedHotel)) {
            setSelectedHotelState(isAdmin ? '' : (hotels[0] ?? ''))
            return
        }
        if (selectedHotel === '' && !storedChoice && !isAdmin && hotels[0]) {
            setSelectedHotelState(hotels[0])
        }
    }, [hotels, selectedHotel, isAdmin, storedChoice])

    const value = useMemo(
        () => ({
            hotels,
            selectedHotel,
            setSelectedHotel,
            isAdmin,
            showAllHotels: isAdmin && selectedHotel === '',
        }),
        [hotels, selectedHotel, setSelectedHotel, isAdmin],
    )

    return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>
}

export function useHotel() {
    const ctx = useContext(HotelContext)
    if (!ctx) throw new Error('useHotel must be used within HotelProvider')
    return ctx
}

/** Convenience for list pages: active hotel filter (undefined = all) + whether the All Hotels admin view is active. */
export function useHotelScope() {
    const { selectedHotel, isAdmin, showAllHotels } = useHotel()
    return {
        hotel: selectedHotel || undefined,
        isAdmin,
        showAllHotels,
        /** True whenever the scope covers every hotel, for any role. */
        isAllScope: selectedHotel === '',
    }
}