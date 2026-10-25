import type { DeliveryItem } from './operations'

/** Which grid is being worked on. Mirrors MONTHLY_KINDS on the server. */
export type MonthlyKind = 'receiving' | 'delivery' | 'rewash'

export const MONTHLY_KINDS: MonthlyKind[] = ['receiving', 'delivery', 'rewash']

export const MONTHLY_KIND_LABELS: Record<MonthlyKind, string> = {
    receiving: 'Receiving',
    delivery: 'Deliveries',
    rewash: 'Rewash',
}

/**
 * EMPTY means the day has no monthly entry at all. DRAFT cells can still be
 * edited. CONFIRMED is locked: its real gate passes / deliveries / rewash
 * records exist and are corrected through their own flows.
 */
export type MonthlyDayStatus = 'EMPTY' | 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

/** How a delivery day finds its stock. Mirrors the server's `source_mode`. */
export type MonthlySourceMode = 'same_day' | 'auto' | 'manual'

export const MONTHLY_SOURCE_MODES: { value: MonthlySourceMode; label: string; hint: string }[] = [
    { value: 'same_day', label: "Same day's receiving", hint: 'Use the gate pass received on the same date.' },
    { value: 'auto', label: 'Auto (oldest first)', hint: 'FIFO across the hotel pending gate passes.' },
    { value: 'manual', label: 'Manual', hint: 'Choose the gate passes and quantities yourself.' },
]

/**
 * One matrix row. `item_name` + `specification` form the cell key the server
 * stores quantities under, so both are required to round-trip an edit.
 */
export interface MonthlyItemRow {
    item_name: string
    specification: string
    category?: string | null
    unit_price: number
    has_price: boolean
    unit: 'kg' | 'pcs'
    usage_qty: number
}

export interface MonthlyDayState {
    day: number
    date: string
    status: MonthlyDayStatus
    total_qty: number
    quantities: Record<string, number>
    piece_quantities: Record<string, number>
    bill_number?: string | null
    gate_pass_number?: string | null
    alrs_number?: string | null
    gate_pass_ids: string[]
    delivery_ids: string[]
    rewash_ids: string[]
    confirmed_by?: string | null
    confirmed_at?: string | null
    notes?: string | null
}

export interface MonthlyMatrixResponse {
    client_name: string
    kind: MonthlyKind
    year: number
    month: number
    month_length: number
    quotation_id?: string | null
    rows: MonthlyItemRow[]
    days: MonthlyDayState[]
    /** item key -> day number -> quantity. The server's own pivot of `days`. */
    cells: Record<string, Record<string, number>>
    operations_summary: {
        gate_pass_count: number
        draft_gate_pass_count: number
        totals: {
            received_qty: { pcs: number; kg: number }
            delivered_qty: { pcs: number; kg: number }
            returned_back_qty: { pcs: number; kg: number }
            outstanding_delivery_qty: { pcs: number; kg: number }
        }
    }
}

/**
 * The stored month document returned by every write. `days` is keyed by day as
 * a string, unlike `MonthlyMatrixResponse.days` which is a list.
 */
export interface MonthlyMonthDoc {
    id: string | null
    client_name: string
    kind: MonthlyKind
    year: number
    month: number
    quotation_id?: string | null
    days: Record<string, Omit<MonthlyDayState, 'day'>>
}

export interface MonthlyQuantitiesPayload {
    /** item key (`name||spec`) -> quantity. Zero/negative values clear the cell. */
    quantities: Record<string, number>
    /** Curtain piece count, tracked separately from its billable kg quantity. */
    piece_quantities: Record<string, number>
    bill_number?: string | null
    gate_pass_number?: string | null
    alrs_number?: string | null
}

export interface MonthlyDeliverySource {
    gate_pass_id: string
    items: DeliveryItem[]
}

export interface MonthlyConfirmPayload {
    quotation_id?: string | null
    source_mode?: MonthlySourceMode | null
    sources?: MonthlyDeliverySource[] | null
    received_by?: string | null
    delivered_by?: string | null
    /** Rewash only: default false, i.e. free. */
    chargeable?: boolean | null
    notes?: string | null
}

/** `name||spec` - the key the server uses for quantities. */
export function monthlyItemKey(itemName: string, specification?: string | null): string {
    return `${itemName}||${specification ?? ''}`
}
