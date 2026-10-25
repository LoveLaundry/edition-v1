import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, CalendarDays, ClipboardList, Info, PackageOpen, Printer, Receipt, RefreshCw, Search } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useReactToPrint } from 'react-to-print'
import { useHotelScope } from '../../../context/HotelContext'
import {
    useActivateDelivery,
    useActivateGatePass,
    useCancelMonthlyDay,
    useConfirmMonthlyDay,
    useMonthlyMatrix,
    useSaveDayQuantities,
    type MonthlyMatrixParams,
} from '../hooks/useMonthly'
import { useDeliveries } from '../hooks/useDeliveries'
import { useGatePasses } from '../hooks/useGatePasses'
import { useQuotations } from '../hooks/useQuotations'
import { billKeys, useUnbilledGatePasses } from '../hooks/useBills'
import { billService } from '../services/bill.service'
import { MonthlyOperationsReport, type MonthlyReportSection } from '../components/monthly-operations-report'
import { deliveries as deliveriesApi, type PendingGatePass } from '../services/delivery.service'
import {
    Badge,
    Button,
    Card,
    Checkbox,
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    ErrorState,
    Field,
    Input,
    Notice,
    Select,
    Skeleton,
    Tabs,
    Textarea,
} from '../../../components/ui'
import { cn } from '../../../lib/utils'
import { PrintTarget } from '../../../components/ui/print-target'
import { usePrintPrefixChoice } from '../../../lib/use-print-prefix-choice'
import {
    MONTHLY_KINDS,
    MONTHLY_KIND_LABELS,
    MONTHLY_SOURCE_MODES,
    monthlyItemKey,
    type MonthlyDayState,
    type MonthlyItemRow,
    type MonthlyKind,
    type MonthlyMatrixResponse,
    type MonthlySourceMode,
} from '../../../types/monthly'

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_HEAD = 'px-2 py-1.5 text-center text-[11px] font-semibold text-[var(--text-tertiary)] uppercase'
const CELL_BASE =
    'h-9 w-9 border-r border-b border-[var(--border)] text-center align-middle text-[12.5px] tabular-nums'

const DAY_TONE: Record<string, { head: string; badge: 'neutral' | 'info' | 'success' | 'danger' }> = {
    EMPTY: { head: 'bg-[var(--surface-2)]', badge: 'neutral' },
    DRAFT: { head: 'bg-[var(--info-soft)]', badge: 'info' },
    CONFIRMED: { head: 'bg-[var(--success-soft)]', badge: 'success' },
    CANCELLED: { head: 'bg-[var(--danger-soft)]', badge: 'danger' },
}

const MONTH_YEAR = (() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
})()

const formatMoney = (value: number) =>
    new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value)

const formatAmount = (value: number) =>
    new Intl.NumberFormat('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value)

const formatQuantity = (value: number) => new Intl.NumberFormat('en-LK').format(value)

interface QuantityPriceSummary {
    totalQty: number
    curtainKg: number
    pricedQty: number
    unpricedQty: number
    unpricedCurtainKg: number
    quotedValue: number
}

export interface MonthlyAnalysis extends QuantityPriceSummary {
    dayQuantities: Record<number, number>
    dayCurtainKg: Record<number, number>
    dayCurtainPieces: Record<number, number>
    dayPricedQuantities: Record<number, number>
    dayValues: Record<number, number>
    itemQuantities: Record<string, number>
    itemCurtainPieces: Record<string, number>
    itemValues: Record<string, number>
    pricedDays: number
    averagePerPricedDay: number
    highestValueDay?: { day: number; value: number }
    highestValueItem?: { name: string; value: number }
}

const REPORT_SECTIONS: { key: MonthlyReportSection; label: string; description: string }[] = [
    { key: 'summary', label: 'Monthly highlights', description: 'Quoted value and live received, delivered, and outstanding totals.' },
    { key: 'daily', label: 'Daily activity', description: 'Daily quantity, value, status, gate-pass, and delivery counts.' },
    { key: 'items', label: 'Item analytics', description: 'Monthly quantity, curtain piece count, price, and estimated value by item.' },
    { key: 'balances', label: 'Gate-pass balances', description: 'Live active/draft gate-pass counts and canonical balance totals.' },
]

function formatBalanceQuantity(value: { pcs: number; kg: number }): string {
    return `${formatQuantity(value.pcs)} pcs · ${formatQuantity(value.kg)} kg`
}

function summarizeQuantities(
    rows: MonthlyItemRow[],
    quantities: Record<string, number>,
): QuantityPriceSummary {
    const rowsByKey = new Map(
        rows.map((row) => [monthlyItemKey(row.item_name, row.specification), row]),
    )
    const summary: QuantityPriceSummary = {
        totalQty: 0,
        curtainKg: 0,
        pricedQty: 0,
        unpricedQty: 0,
        unpricedCurtainKg: 0,
        quotedValue: 0,
    }

    for (const [key, rawQty] of Object.entries(quantities)) {
        const qty = Number(rawQty) || 0
        if (qty <= 0) continue

        const row = rowsByKey.get(key)
        if (row?.unit === 'kg') summary.curtainKg += qty
        else summary.totalQty += qty
        if (row?.has_price) {
            summary.pricedQty += qty
            summary.quotedValue += qty * row.unit_price
        } else {
            if (row?.unit === 'kg') summary.unpricedCurtainKg += qty
            else summary.unpricedQty += qty
        }
    }

    return summary
}

function analyzeMonthlyMatrix(data: MonthlyMatrixResponse): MonthlyAnalysis {
    const analysis: MonthlyAnalysis = {
        totalQty: 0,
        curtainKg: 0,
        pricedQty: 0,
        unpricedQty: 0,
        unpricedCurtainKg: 0,
        quotedValue: 0,
        dayQuantities: {},
        dayCurtainKg: {},
        dayCurtainPieces: {},
        dayPricedQuantities: {},
        dayValues: {},
        itemQuantities: {},
        itemCurtainPieces: {},
        itemValues: {},
        pricedDays: 0,
        averagePerPricedDay: 0,
    }
    const rowsByKey = new Map(
        data.rows.map((row) => [monthlyItemKey(row.item_name, row.specification), row]),
    )

    for (let day = 1; day <= data.month_length; day += 1) {
        if (data.days.find((state) => state.day === day)?.status === 'CANCELLED') continue

        const quantities: Record<string, number> = {}
        for (const [key, dayCells] of Object.entries(data.cells)) {
            quantities[key] = Number(dayCells[String(day)]) || 0
        }

        const daySummary = summarizeQuantities(data.rows, quantities)
        analysis.dayQuantities[day] = daySummary.totalQty
        analysis.dayCurtainKg[day] = daySummary.curtainKg
        analysis.dayPricedQuantities[day] = daySummary.pricedQty
        analysis.dayValues[day] = daySummary.quotedValue
        analysis.totalQty += daySummary.totalQty
        analysis.curtainKg += daySummary.curtainKg
        analysis.pricedQty += daySummary.pricedQty
        analysis.unpricedQty += daySummary.unpricedQty
        analysis.unpricedCurtainKg += daySummary.unpricedCurtainKg
        analysis.quotedValue += daySummary.quotedValue

        for (const [key, qty] of Object.entries(quantities)) {
            if (qty <= 0) continue
            const row = rowsByKey.get(key)
            if (row?.unit !== 'kg') {
                analysis.itemQuantities[key] = (analysis.itemQuantities[key] ?? 0) + qty
            }
            if (row?.has_price) {
                analysis.itemValues[key] =
                    (analysis.itemValues[key] ?? 0) + qty * row.unit_price
            }
        }
        const dayState = data.days.find((state) => state.day === day)
        const pieceCounts = dayState?.piece_quantities ?? {}
        analysis.dayCurtainPieces[day] = Object.values(pieceCounts).reduce(
            (sum, count) => sum + (Number(count) || 0),
            0,
        )
        for (const [key, count] of Object.entries(pieceCounts)) {
            analysis.itemCurtainPieces[key] =
                (analysis.itemCurtainPieces[key] ?? 0) + (Number(count) || 0)
        }

        if (daySummary.pricedQty > 0) {
            analysis.pricedDays += 1
            if (
                !analysis.highestValueDay ||
                daySummary.quotedValue > analysis.highestValueDay.value
            ) {
                analysis.highestValueDay = { day, value: daySummary.quotedValue }
            }
        }
    }

    analysis.averagePerPricedDay = analysis.pricedDays
        ? analysis.quotedValue / analysis.pricedDays
        : 0
    const topItem = Object.entries(analysis.itemValues).sort((a, b) => b[1] - a[1])[0]
    if (topItem && topItem[1] > 0) {
        const row = rowsByKey.get(topItem[0])
        analysis.highestValueItem = {
            name: row ? [row.item_name, row.specification].filter(Boolean).join(' · ') : topItem[0],
            value: topItem[1],
        }
    }

    return analysis
}

// ─────────────────────────────────────────────────────────────────────────────
// Day dialog
// ─────────────────────────────────────────────────────────────────────────────

interface DayDialogProps {
    params: MonthlyMatrixParams
    day: number
    dayState: MonthlyDayState | undefined
    rows: MonthlyItemRow[]
    onClose: () => void
}

/**
 * One day's quantities plus the three ways a day can leave DRAFT.
 *
 * Confirming is the only action that creates records, and what it creates
 * depends on the kind: a gate pass, deliveries off existing passes, or rewash
 * records. Activating a created record is deliberately a separate, explicit
 * step shown here - until it is pressed the record is invisible to every
 * balance in the system.
 */
function DayDialog({ params, day, dayState, rows, onClose }: DayDialogProps) {
    const status = dayState?.status ?? 'EMPTY'
    const isConfirmed = status === 'CONFIRMED'
    const [quantities, setQuantities] = useState<Record<string, number>>(() => ({ ...(dayState?.quantities ?? {}) }))
    const [pieceQuantities, setPieceQuantities] = useState<Record<string, number>>(() => ({ ...(dayState?.piece_quantities ?? {}) }))
    const [billNumber, setBillNumber] = useState(dayState?.bill_number ?? '')
    const [gatePassNumber, setGatePassNumber] = useState(dayState?.gate_pass_number ?? '')
    const [alrsNumber, setAlrsNumber] = useState(dayState?.alrs_number ?? '')
    const [receivedBy, setReceivedBy] = useState('')
    const [deliveredBy, setDeliveredBy] = useState('')
    const [notes, setNotes] = useState(dayState?.notes ?? '')
    const [chargeable, setChargeable] = useState(false)
    const [sourceMode, setSourceMode] = useState<MonthlySourceMode>('same_day')
    const [manual, setManual] = useState<Record<string, boolean>>({})
    const [manualQtys, setManualQtys] = useState<Record<string, number>>({})
    const [itemSearch, setItemSearch] = useState('')
    const [showEnteredOnly, setShowEnteredOnly] = useState(false)

    const save = useSaveDayQuantities(params)
    const confirm = useConfirmMonthlyDay(params)
    const cancelDay = useCancelMonthlyDay(params)
    const activateGp = useActivateGatePass()
    const activateDlv = useActivateDelivery()

    // Record statuses drive whether "Activate" is offered at all.
    const { data: gatePassList = [] } = useGatePasses(params.clientName ? { client_name: params.clientName } : undefined)
    const { data: deliveryList = [] } = useDeliveries(params.clientName ? { client_name: params.clientName } : undefined)
    const gpStatus = useMemo(() => new Map(gatePassList.map((g) => [g.id, g.status])), [gatePassList])
    const dlvStatus = useMemo(() => new Map(deliveryList.map((d) => [d.id, d.status])), [deliveryList])

    const { data: pending = [], isLoading: pendingLoading } = useQuery<PendingGatePass[]>({
        queryKey: ['monthly', 'pending-sources', params.clientName],
        queryFn: () => deliveriesApi.pendingGatePasses(params.clientName),
        enabled: params.kind === 'delivery' && sourceMode === 'manual' && Boolean(params.clientName),
    })

    const daySummary = useMemo(
        () => summarizeQuantities(rows, quantities),
        [rows, quantities],
    )
    const enteredRowsCount = rows.filter((row) => {
        const key = monthlyItemKey(row.item_name, row.specification)
        return (Number(quantities[key]) || 0) > 0 || (Number(pieceQuantities[key]) || 0) > 0
    }).length
    const visibleRows = useMemo(() => {
        const query = itemSearch.trim().toLocaleLowerCase()
        return [...rows]
            .sort((a, b) => (Number(b.usage_qty) || 0) - (Number(a.usage_qty) || 0))
            .filter((row) => {
            const key = monthlyItemKey(row.item_name, row.specification)
            const entered = (Number(quantities[key]) || 0) > 0 || (Number(pieceQuantities[key]) || 0) > 0
            const label = [row.item_name, row.specification].filter(Boolean).join(' ').toLocaleLowerCase()
            return (!showEnteredOnly || entered) && (!query || label.includes(query))
            })
    }, [rows, quantities, pieceQuantities, itemSearch, showEnteredOnly])
    const totalPieces = Object.values(pieceQuantities).reduce((sum, count) => sum + (Number(count) || 0), 0)
    const hasAnyQuantities = daySummary.totalQty > 0 || daySummary.curtainKg > 0 || totalPieces > 0
    const busy = save.isPending || confirm.isPending || cancelDay.isPending

    const setQty = (key: string, raw: string) => {
        const n = Number(raw)
        setQuantities((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }))
    }

    const setPieceQty = (key: string, raw: string) => {
        const n = raw === '' ? 0 : Number(raw)
        if (!Number.isInteger(n)) {
            toast.error('Curtain piece count must be a whole number')
            return
        }
        setPieceQuantities((prev) => ({ ...prev, [key]: n }))
    }

    const payload = () => {
        const clean: Record<string, number> = {}
        for (const [key, qty] of Object.entries(quantities)) {
            const n = Number(qty) || 0
            if (n > 0) clean[key] = n
        }
        return clean
    }

    const piecePayload = () => {
        const clean: Record<string, number> = {}
        for (const [key, qty] of Object.entries(pieceQuantities)) {
            const n = Number(qty) || 0
            if (n > 0) clean[key] = n
        }
        return clean
    }

    const referencePayload = () => ({
        bill_number: billNumber.trim() || null,
        gate_pass_number: gatePassNumber.trim() || null,
        alrs_number: alrsNumber.trim() || null,
    })

    const manualSources = () => {
        const sources = pending
            .filter((p) => manual[p.gate_pass_id])
            .map((p) => ({
                gate_pass_id: p.gate_pass_id,
                items: p.items
                    .map((it) => ({
                        item_name: it.item_name,
                        specification: it.specification,
                        category: it.category,
                        quantity: Number(manualQtys[`${p.gate_pass_id}||${it.item_name}||${it.specification}`] ?? it.pending_qty) || 0,
                    }))
                    .filter((it) => it.quantity > 0),
            }))
            .filter((s) => s.items.length > 0)
        return sources
    }

    const confirmDay = async () => {
        if (sourceMode === 'manual' && manualSources().length === 0) {
            toast.error('Choose at least one gate pass with a quantity')
            return
        }
        try {
            await save.mutateAsync({
                day,
                payload: {
                    quantities: payload(),
                    piece_quantities: piecePayload(),
                    ...referencePayload(),
                },
            })
            await confirm.mutateAsync({
                day,
                payload: {
                    quotation_id: params.quotationId ?? null,
                    received_by: params.kind === 'receiving' ? receivedBy || null : null,
                    delivered_by: params.kind === 'delivery' ? deliveredBy || null : null,
                    source_mode: params.kind === 'delivery' ? sourceMode : null,
                    sources: params.kind === 'delivery' && sourceMode === 'manual' ? manualSources() : null,
                    chargeable: params.kind === 'rewash' ? chargeable : null,
                    notes: notes || null,
                },
            })
            onClose()
        } catch {
            // The mutations display their own error toast; do not confirm unsaved quantities.
        }
    }

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>
                        {params.kind === 'receiving' ? 'Receiving' : params.kind === 'delivery' ? 'Deliveries' : 'Rewash'} · {day} {MONTH_NAMES[params.month - 1]} {params.year}
                    </DialogTitle>
                    <DialogDescription>
                        {isConfirmed
                            ? 'Confirmed. Its records are live - corrections happen on the records themselves.'
                            : 'Enter quantities, then save as a draft or confirm to create records.'}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={DAY_TONE[status].badge} dot>{status === 'EMPTY' ? 'Not started' : status}</Badge>
                        <Badge tone="neutral">
                            {formatQuantity(daySummary.totalQty)} pcs · {formatQuantity(daySummary.curtainKg)} kg · {formatQuantity(totalPieces)} curtain pcs
                        </Badge>
                        <Badge tone="info">
                            Quoted value {daySummary.pricedQty > 0 ? formatMoney(daySummary.quotedValue) : '—'}
                        </Badge>
                        {(daySummary.unpricedQty > 0 || daySummary.unpricedCurtainKg > 0) && (
                            <Badge tone="warning">
                                Unpriced: {formatQuantity(daySummary.unpricedQty)} pcs · {formatQuantity(daySummary.unpricedCurtainKg)} kg
                            </Badge>
                        )}
                        {dayState?.confirmed_at && (
                            <span className="text-[12px] text-[var(--text-faint)]">
                                Confirmed {new Date(dayState.confirmed_at).toLocaleString()}
                            </span>
                        )}
                    </div>

                    {params.kind === 'receiving' && !isConfirmed && (
                        <div className="grid gap-3 rounded border border-[var(--border)] p-3 sm:grid-cols-3">
                            <Field label="Daily bill number" hint="Manual reference for this receiving day.">
                                <Input value={billNumber} maxLength={120} onChange={(e) => setBillNumber(e.target.value)} />
                            </Field>
                            <Field label="Gate-pass number" hint="This becomes the visible gate-pass number.">
                                <Input value={gatePassNumber} maxLength={120} onChange={(e) => setGatePassNumber(e.target.value)} />
                            </Field>
                            <Field label="ALRS number" hint="Manual reference for this receiving day.">
                                <Input value={alrsNumber} maxLength={120} onChange={(e) => setAlrsNumber(e.target.value)} />
                            </Field>
                        </div>
                    )}
                    {params.kind === 'receiving' && isConfirmed && (
                        <div className="rounded border border-[var(--border)] p-3 text-[12.5px] text-[var(--text-secondary)]">
                            <strong>Daily references:</strong>{' '}
                            Bill {dayState?.bill_number || '—'} · Gate pass {dayState?.gate_pass_number || '—'} · ALRS {dayState?.alrs_number || '—'}
                        </div>
                    )}

                    {isConfirmed && (
                        <Notice tone="info" title="Locked">
                            This day is confirmed. To reverse it, cancel the {dayState?.gate_pass_ids.length || dayState?.delivery_ids.length || dayState?.rewash_ids.length || 0} record(s) below from their own pages — the
                            monthly grid will not edit live quantities.
                        </Notice>
                    )}

                    {!isConfirmed && (
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="relative min-w-[220px] flex-1">
                                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                                <input
                                    type="search"
                                    autoFocus
                                    aria-label="Search items"
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                    placeholder="Find an item or specification..."
                                    className="h-9 w-full rounded border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                                />
                            </label>
                            <div className="flex items-center gap-1" aria-label="Item filter">
                                <Button size="xs" variant={!showEnteredOnly ? 'secondary' : 'ghost'} aria-pressed={!showEnteredOnly} onClick={() => setShowEnteredOnly(false)}>
                                    All {rows.length}
                                </Button>
                                <Button size="xs" variant={showEnteredOnly ? 'secondary' : 'ghost'} aria-pressed={showEnteredOnly} onClick={() => setShowEnteredOnly(true)}>
                                    Entered {enteredRowsCount}
                                </Button>
                            </div>
                            <span className="text-[11px] tabular-nums text-[var(--text-faint)]" aria-live="polite">
                                Most used first · {visibleRows.length} shown
                            </span>
                        </div>
                    )}

                    <div className="overflow-x-auto rounded border border-[var(--border)]">
                        <table className="w-full min-w-[640px] border-collapse">
                            <thead>
                                <tr className="bg-[var(--surface-2)]">
                                    <th className="border-b border-[var(--border)] px-3 py-1.5 text-left text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">Item</th>
                                    <th className="w-24 border-b border-[var(--border)] px-2 py-1.5 text-right text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">Price (LKR / unit)</th>
                                    <th className="w-24 border-b border-[var(--border)] px-2 py-1.5 text-center text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">Qty</th>
                                    <th className="w-24 border-b border-[var(--border)] px-2 py-1.5 text-center text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">Curtain pcs</th>
                                    <th className="w-32 border-b border-[var(--border)] px-2 py-1.5 text-right text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">Line total (LKR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((row) => {
                                    const key = monthlyItemKey(row.item_name, row.specification)
                                    return (
                                        <tr key={key}>
                                            <td className="border-b border-[var(--border)] px-3 py-1 text-[13px] text-[var(--text-primary)]">
                                                {row.item_name}
                                                {row.specification && <span className="text-[var(--text-faint)]"> · {row.specification}</span>}
                                            </td>
                                            <td className="border-b border-[var(--border)] px-2 py-1 text-right text-[12.5px] tabular-nums text-[var(--text-tertiary)]">
                                                {row.has_price ? `${row.unit_price.toFixed(2)} / ${row.unit}` : '—'}
                                            </td>
                                            <td className="border-b border-[var(--border)] p-0 text-center">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={row.unit === 'kg' ? '0.01' : '1'}
                                                    disabled={isConfirmed}
                                                    value={quantities[key] || ''}
                                                    placeholder="0"
                                                    onChange={(e) => setQty(key, e.target.value)}
                                                    className="h-8 w-20 bg-transparent text-center text-[13px] tabular-nums outline-none focus:bg-[var(--brand-soft)] disabled:text-[var(--text-faint)]"
                                                />
                                            </td>
                                            <td className="border-b border-[var(--border)] p-0 text-center">
                                                {row.unit === 'kg' ? (
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        disabled={isConfirmed}
                                                        value={pieceQuantities[key] || ''}
                                                        placeholder="0"
                                                        onChange={(e) => setPieceQty(key, e.target.value)}
                                                        className="h-8 w-20 bg-transparent text-center text-[13px] tabular-nums outline-none focus:bg-[var(--brand-soft)] disabled:text-[var(--text-faint)]"
                                                        aria-label={`${row.item_name} pieces`}
                                                    />
                                                ) : (
                                                    <span className="text-[var(--text-faint)]">—</span>
                                                )}
                                            </td>
                                            <td className="border-b border-[var(--border)] px-2 py-1 text-right text-[12px] tabular-nums text-[var(--text-secondary)]">
                                                {row.has_price
                                                    ? formatMoney((Number(quantities[key]) || 0) * row.unit_price)
                                                    : (Number(quantities[key]) || 0) > 0 ? 'Unpriced' : '—'}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {visibleRows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-[13px] text-[var(--text-tertiary)]">
                                            {showEnteredOnly && enteredRowsCount === 0
                                                ? 'No quantities entered yet.'
                                                : 'No items match your search.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!isConfirmed && (
                        <>
                            {params.kind === 'receiving' && (
                                <Field label="Received by" hint="Optional - appears on the generated gate pass.">
                                    <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="e.g. Nimal" />
                                </Field>
                            )}

                            {params.kind === 'delivery' && (
                                <Field label="Source of stock" hint={MONTHLY_SOURCE_MODES.find((m) => m.value === sourceMode)?.hint}>
                                    <Select value={sourceMode} onChange={(e) => setSourceMode(e.target.value as MonthlySourceMode)}>
                                        {MONTHLY_SOURCE_MODES.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </Select>
                                </Field>
                            )}

                            {params.kind === 'delivery' && sourceMode === 'manual' && (
                                <div className="space-y-2">
                                    <p className="text-[12.5px] font-medium text-[var(--text-secondary)]">Pending gate passes</p>
                                    {pendingLoading && <Skeleton className="h-16" />}
                                    {!pendingLoading && pending.length === 0 && (
                                        <Notice tone="warning" title="Nothing pending">
                                            No gate pass has stock left to deliver for this hotel.
                                        </Notice>
                                    )}
                                    {pending.map((p: PendingGatePass) => (
                                        <label key={p.gate_pass_id} className="flex cursor-pointer items-start gap-2 rounded border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-hover)]">
                                            <Checkbox
                                                checked={Boolean(manual[p.gate_pass_id])}
                                                onChange={(e) => setManual((prev) => ({ ...prev, [p.gate_pass_id]: e.target.checked }))}
                                                className="mt-0.5"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
                                                    {p.gate_pass_number}
                                                    <span className="text-[12px] font-normal text-[var(--text-faint)]">{String(p.receiving_date).slice(0, 10)}</span>
                                                </span>
                                                <span className="mt-1 flex flex-wrap gap-2">
                                                    {p.items.filter((it) => it.pending_qty > 0).map((it) => {
                                                        const mkey = `${p.gate_pass_id}||${it.item_name}||${it.specification}`
                                                        return (
                                                            <span key={mkey} className="inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
                                                                {it.item_name}
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    step={it.item_name.toLowerCase().includes('curtain') ? '0.01' : '1'}
                                                                    disabled={!manual[p.gate_pass_id]}
                                                                    value={manualQtys[mkey] ?? it.pending_qty}
                                                                    onChange={(e) => setManualQtys((prev) => ({ ...prev, [mkey]: Number(e.target.value) || 0 }))}
                                                                    className="h-6 w-14 rounded border border-[var(--border)] bg-[var(--surface)] px-1 text-center text-[12px] tabular-nums outline-none focus:border-[var(--brand)] disabled:opacity-50"
                                                                />
                                                                <span className="text-[var(--text-faint)]">/ {it.pending_qty}</span>
                                                            </span>
                                                        )
                                                    })}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {params.kind === 'delivery' && (
                                <Field label="Delivered by" hint="Optional.">
                                    <Input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} placeholder="e.g. Saman" />
                                </Field>
                            )}

                            {params.kind === 'rewash' && (
                                <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--border)] px-3 py-2">
                                    <Checkbox checked={chargeable} onChange={(e) => setChargeable(e.target.checked)} className="mt-0.5" />
                                    <span className="text-[13px] text-[var(--text-primary)]">
                                        Chargeable rewash
                                        <span className="mt-0.5 block text-[12px] text-[var(--text-faint)]">
                                            Off by default — rewashed linen is re-processed, not billed, until you tick this.
                                        </span>
                                    </span>
                                </label>
                            )}

                            <Field label="Notes" hint="Optional - stored on the day and its records.">
                                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                            </Field>
                        </>
                    )}

                    {/* Generated records */}
                    {params.kind === 'receiving' && dayState && dayState.gate_pass_ids.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[12.5px] font-medium text-[var(--text-secondary)]">Gate pass</p>
                            {dayState.gate_pass_ids.map((id) => {
                                const st = gpStatus.get(id)
                                return (
                                    <div key={id} className="flex items-center justify-between gap-2 rounded border border-[var(--border)] px-3 py-2">
                                        <Link to={`/gate-passes/${id}`} className="truncate text-[13px] text-[var(--brand-text)] hover:underline">
                                            {gatePassList.find((g) => g.id === id)?.gate_pass_number ?? id}
                                        </Link>
                                        {st === 'DRAFT' ? (
                                            <Button size="xs" variant="primary" loading={activateGp.isPending} onClick={() => activateGp.mutate(id)}>
                                                Activate
                                            </Button>
                                        ) : (
                                            <Badge tone={st === 'RECEIVED' ? 'success' : 'neutral'}>{st ?? 'unknown'}</Badge>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {params.kind === 'delivery' && dayState && dayState.delivery_ids.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[12.5px] font-medium text-[var(--text-secondary)]">Deliveries</p>
                            {dayState.delivery_ids.map((id) => {
                                const st = dlvStatus.get(id)
                                return (
                                    <div key={id} className="flex items-center justify-between gap-2 rounded border border-[var(--border)] px-3 py-2">
                                        <Link to={`/deliveries/${id}`} className="truncate text-[13px] text-[var(--brand-text)] hover:underline">
                                            DLV-{id.slice(-6)}
                                        </Link>
                                        {st === 'DRAFT' ? (
                                            <Button size="xs" variant="primary" loading={activateDlv.isPending} onClick={() => activateDlv.mutate(id)}>
                                                Activate
                                            </Button>
                                        ) : (
                                            <Badge tone={st === 'DELIVERED' ? 'success' : 'neutral'}>{st ?? 'unknown'}</Badge>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {params.kind === 'rewash' && dayState && dayState.rewash_ids.length > 0 && (
                        <Notice tone="success" title={`${dayState.rewash_ids.length} rewash record(s) created`}>
                            Recorded and counted in stock immediately.
                        </Notice>
                    )}
                </DialogBody>

                <DialogFooter>
                    {!isConfirmed && status !== 'EMPTY' && (
                        <Button
                            variant="danger-ghost"
                            disabled={busy}
                            onClick={() => cancelDay.mutate(day, { onSuccess: onClose })}
                        >
                            Clear day
                        </Button>
                    )}
                    <div className="flex-1" />
                    {!isConfirmed && (
                        <>
                            <Button variant="secondary" loading={save.isPending} disabled={busy} onClick={() => save.mutate({ day, payload: { quantities: payload(), piece_quantities: piecePayload(), ...referencePayload() } }, { onSuccess: onClose })}>
                                Save draft
                            </Button>
                            <Button
                                variant="primary"
                                loading={confirm.isPending}
                                disabled={busy || !hasAnyQuantities}
                                onClick={confirmDay}
                            >
                                Confirm day
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix
// ─────────────────────────────────────────────────────────────────────────────

function Matrix({
    data,
    analysis,
    onOpenDay,
}: {
    data: MonthlyMatrixResponse
    analysis: MonthlyAnalysis
    onOpenDay: (day: number) => void
}) {
    const dayByNumber = useMemo(() => new Map(data.days.map((d) => [d.day, d])), [data.days])

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="sticky left-0 z-10 min-w-[220px] border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-left text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">
                            Item
                        </th>
                        {Array.from({ length: data.month_length }, (_, i) => i + 1).map((d) => {
                            const st = dayByNumber.get(d)?.status ?? 'EMPTY'
                            return (
                                <th key={d} className={cn(DAY_HEAD, DAY_TONE[st].head)}>
                                    <button
                                        type="button"
                                        onClick={() => onOpenDay(d)}
                                        className="flex w-full flex-col items-center gap-0.5 hover:text-[var(--brand-text)]"
                                        title={`Open day ${d}`}
                                    >
                                        <span>{d}</span>
                                    </button>
                                </th>
                            )
                        })}
                        <th className={cn(DAY_HEAD, 'min-w-16 bg-[var(--surface-2)]')}>Qty total</th>
                        <th className={cn(DAY_HEAD, 'min-w-32 bg-[var(--surface-2)]')}>Value total</th>
                    </tr>
                </thead>
                <tbody>
                    {data.rows.map((row) => {
                        const key = monthlyItemKey(row.item_name, row.specification)
                        const itemCurtainKg = data.days.reduce(
                            (sum, state) => state.status === 'CANCELLED'
                                ? sum
                                : sum + (Number(state.quantities[key]) || 0),
                            0,
                        )
                        return (
                            <tr key={key} className="hover:bg-[var(--surface-hover)]">
                                <td className="sticky left-0 z-10 border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                                    <span className="block text-[13px] font-medium text-[var(--text-primary)]">{row.item_name}</span>
                                    {(row.specification || row.category) && (
                                        <span className="block text-[11.5px] text-[var(--text-faint)]">
                                            {[row.specification, row.category].filter(Boolean).join(' · ')}
                                        </span>
                                    )}
                                </td>
                                {Array.from({ length: data.month_length }, (_, i) => i + 1).map((d) => {
                                    const qty = data.cells[key]?.[String(d)] ?? 0
                                    const st = dayByNumber.get(d)?.status ?? 'EMPTY'
                                    const locked = st === 'CONFIRMED'
                                    return (
                                        <td key={d} className={cn(CELL_BASE, locked ? 'bg-[var(--surface-2)]' : 'cursor-pointer', 'hover:bg-[var(--brand-soft)]')} onClick={() => onOpenDay(d)}>
                                            <span className={cn(qty > 0 && (locked ? 'text-[var(--text-primary)]' : 'text-[var(--brand-text)]'), qty === 0 && 'text-[var(--text-faint)]')}>
                                                {row.unit === 'kg'
                                                    ? [qty > 0 ? `${formatQuantity(qty)} kg` : '', (dayByNumber.get(d)?.piece_quantities?.[key] ?? 0) > 0 ? `${formatQuantity(dayByNumber.get(d)?.piece_quantities?.[key] ?? 0)} pc` : ''].filter(Boolean).join(' · ')
                                                    : qty > 0 ? formatQuantity(qty) : ''}
                                            </span>
                                        </td>
                                    )
                                })}
                                <td className={cn(CELL_BASE, 'bg-[var(--surface-2)] font-semibold')}>
                                    {row.unit === 'kg'
                                        ? [
                                            itemCurtainKg > 0 ? `${formatQuantity(itemCurtainKg)} kg` : '',
                                            analysis.itemCurtainPieces[key]
                                                ? `${formatQuantity(analysis.itemCurtainPieces[key])} pc`
                                                : '',
                                        ].filter(Boolean).join(' · ')
                                        : analysis.itemQuantities[key] ? formatQuantity(analysis.itemQuantities[key]) : ''}
                                </td>
                                <td className={cn(CELL_BASE, 'min-w-32 whitespace-nowrap bg-[var(--surface-2)] px-2 text-right font-semibold')}>
                                    {row.has_price && (analysis.itemQuantities[key] || itemCurtainKg)
                                        ? formatMoney(analysis.itemValues[key] ?? 0)
                                        : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                <tfoot>
                    <tr>
                        <td className="sticky left-0 z-10 border-t border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] font-semibold uppercase text-[var(--text-tertiary)]">
                            Qty total (pcs)
                        </td>
                        {Array.from({ length: data.month_length }, (_, i) => i + 1).map((d) => {
                            const st = dayByNumber.get(d)?.status ?? 'EMPTY'
                            return (
                                <td key={d} className={cn(CELL_BASE, DAY_TONE[st].head, 'font-semibold')}>
                                    {analysis.dayQuantities[d] > 0 ? formatQuantity(analysis.dayQuantities[d]) : ''}
                                </td>
                            )
                        })}
                        <td className={cn(CELL_BASE, 'bg-[var(--surface-3)] font-bold')}>{formatQuantity(analysis.totalQty)}</td>
                        <td className={cn(CELL_BASE, 'min-w-32 whitespace-nowrap bg-[var(--surface-3)] px-2 text-right font-bold')}>
                            {analysis.pricedQty > 0 ? formatMoney(analysis.quotedValue) : '—'}
                        </td>
                    </tr>
                    <tr>
                        <td className="sticky left-0 z-10 border-t border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] font-semibold uppercase text-[var(--text-tertiary)]">
                            Curtain total (kg / pcs)
                        </td>
                        {Array.from({ length: data.month_length }, (_, i) => i + 1).map((d) => {
                            const st = dayByNumber.get(d)?.status ?? 'EMPTY'
                            const kg = analysis.dayCurtainKg[d] ?? 0
                            const pieces = analysis.dayCurtainPieces[d] ?? 0
                            return (
                                <td key={d} className={cn(CELL_BASE, DAY_TONE[st].head, 'font-semibold')}>
                                    {[kg > 0 ? `${formatQuantity(kg)} kg` : '', pieces > 0 ? `${formatQuantity(pieces)} pc` : ''].filter(Boolean).join(' · ')}
                                </td>
                            )
                        })}
                        <td className={cn(CELL_BASE, 'bg-[var(--surface-3)] font-bold')}>
                            {formatQuantity(analysis.curtainKg)} kg · {formatQuantity(Object.values(analysis.itemCurtainPieces).reduce((sum, count) => sum + count, 0))} pc
                        </td>
                        <td className={cn(CELL_BASE, 'bg-[var(--surface-3)]')} />
                    </tr>
                    <tr>
                        <td className="sticky left-0 z-10 border-t border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] font-semibold uppercase text-[var(--text-tertiary)]">
                            Value (LKR)
                        </td>
                        {Array.from({ length: data.month_length }, (_, i) => i + 1).map((d) => {
                            const st = dayByNumber.get(d)?.status ?? 'EMPTY'
                            const value = analysis.dayValues[d] ?? 0
                            const pricedQty = analysis.dayPricedQuantities[d] ?? 0
                            return (
                                <td
                                    key={d}
                                    className={cn(CELL_BASE, 'w-16 min-w-16 px-0.5 text-[8px] font-semibold', DAY_TONE[st].head)}
                                    title={pricedQty > 0 ? `Estimated quoted value: ${formatMoney(value)}` : 'No priced quantities'}
                                    aria-label={`Day ${d}: ${pricedQty > 0 ? formatMoney(value) : 'no priced quantities'}`}
                                >
                                    {pricedQty > 0 ? formatAmount(value) : '—'}
                                </td>
                            )
                        })}
                        <td className={cn(CELL_BASE, 'bg-[var(--surface-3)]')} />
                        <td className={cn(CELL_BASE, 'min-w-32 whitespace-nowrap bg-[var(--surface-3)] px-2 text-right font-bold')}>
                            {analysis.pricedQty > 0 ? formatMoney(analysis.quotedValue) : '—'}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MonthlyOperationsPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { hotel } = useHotelScope()
    const [kind, setKind] = useState<MonthlyKind>('receiving')
    const [year, setYear] = useState(MONTH_YEAR.year)
    const [month, setMonth] = useState(MONTH_YEAR.month)
    const [quotationId, setQuotationId] = useState('')
    const [openDay, setOpenDay] = useState<number | null>(null)
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
    const [invoiceCreating, setInvoiceCreating] = useState(false)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [reportSections, setReportSections] = useState<MonthlyReportSection[]>(
        REPORT_SECTIONS.map((section) => section.key),
    )
    const reportRef = useRef<HTMLDivElement>(null)

    const params = useMemo<MonthlyMatrixParams>(
        () => ({ kind, clientName: hotel ?? '', year, month, quotationId: quotationId || null }),
        [kind, hotel, year, month, quotationId],
    )

    const { data, isLoading, isFetching, isError, error, refetch } = useMonthlyMatrix(params)
    const { data: quotations = [] } = useQuotations()
    const {
        data: unbilledGatePasses = [],
        isLoading: unbilledLoading,
        isError: unbilledError,
        error: unbilledErrorDetails,
    } = useUnbilledGatePasses(hotel ?? undefined, Boolean(hotel))
    const analysis = useMemo(
        () => data ? analyzeMonthlyMatrix(data) : null,
        [data],
    )
    const printReport = useReactToPrint({
        contentRef: reportRef,
        documentTitle: `Monthly-Operations-${hotel ?? 'Hotel'}-${year}-${String(month).padStart(2, '0')}`,
    })
    const [includePrefix, setIncludePrefix] = useState(true)
    const { choose: choosePrefix, dialog: prefixDialog } = usePrintPrefixChoice()
    const confirmReportPrint = () => {
        if (!reportSections.length) return
        setReportDialogOpen(false)
        void choosePrefix().then((choice: boolean | null) => {
            if (choice === null) return
            setIncludePrefix(choice)
            window.setTimeout(() => printReport(), 180)
        })
    }

    const hotelQuotations = useMemo(
        () => quotations.filter((q) => hotel && q.client_name === hotel),
        [quotations, hotel],
    )

    // Changing hotel or month must not leave a quotation from the old pair
    // selected — the server would price the new rows from the wrong contract.
    useEffect(() => {
        setQuotationId((current) => (current && hotelQuotations.some((q) => String(q.id) === current) ? current : ''))
    }, [hotelQuotations])

    const openDayState = openDay === null ? undefined : data?.days.find((d) => d.day === openDay)
    const draftDays = data?.days.filter((d) => d.status === 'DRAFT').length ?? 0
    const confirmedDays = data?.days.filter((d) => d.status === 'CONFIRMED').length ?? 0
    const monthlyGatePassIds = useMemo(
        () => new Set(
            data?.days
                .filter((day) => day.status === 'CONFIRMED')
                .flatMap((day) => day.gate_pass_ids) ?? [],
        ),
        [data],
    )
    const monthlyUnbilledGatePasses = useMemo(
        () => unbilledGatePasses.filter((gatePass) => monthlyGatePassIds.has(gatePass.id)),
        [monthlyGatePassIds, unbilledGatePasses],
    )

    const openInvoicePage = (billIds: string[]) => {
        const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
        const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
        const search = new URLSearchParams({
            client_name: hotel ?? '',
            date_from: dateFrom,
            date_to: dateTo,
            bill_ids: billIds.join(','),
        })
        navigate(`/invoices/new?${search.toString()}`)
    }

    const createMonthlyInvoice = async () => {
        if (!data || !hotel || monthlyUnbilledGatePasses.length === 0) return

        setInvoiceCreating(true)
        setInvoiceDialogOpen(false)
        const createdBillIds: string[] = []
        const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

        try {
            for (const gatePass of monthlyUnbilledGatePasses) {
                const quotationIdForPass = gatePass.quotation_id || data.quotation_id || ''
                const quotation = hotelQuotations.find(
                    (candidate) => String(candidate.id) === quotationIdForPass,
                )
                const bill = await billService.createBill({
                    quotation_id: quotationIdForPass,
                    quotation_title: quotation?.quotation_title || `Monthly receiving · ${monthLabel}`,
                    client_name: hotel,
                    gate_pass_id: gatePass.id,
                    items: [],
                    notes: `Monthly receiving invoice · ${monthLabel}`,
                })
                createdBillIds.push(bill.id)
            }
        } catch (cause) {
            await queryClient.invalidateQueries({ queryKey: billKeys.all })
            const message = cause instanceof Error ? cause.message : 'Unknown billing error'
            if (createdBillIds.length > 0) {
                toast.error(
                    `Created ${createdBillIds.length} of ${monthlyUnbilledGatePasses.length} bills. Opening an invoice for the completed bills. ${message}`,
                )
                openInvoicePage(createdBillIds)
            } else {
                toast.error(`Could not create the monthly invoice: ${message}`)
            }
            setInvoiceCreating(false)
            return
        }

        await queryClient.invalidateQueries({ queryKey: billKeys.all })
        toast.success(`Created monthly invoice from ${createdBillIds.length} received gate pass(es)`)
        openInvoicePage(createdBillIds)
        setInvoiceCreating(false)
    }

    if (!hotel) {
        return (
            <div className="space-y-4">
                <h1 className="text-[18px] font-semibold">Monthly Operations</h1>
                <EmptyState
                    title="Pick a hotel"
                    description="Monthly entry is per hotel, so one hotel must be selected before the grid can load. Use the hotel selector in the top bar."
                />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Monthly Operations</h1>
                    <p className="text-[12.5px] text-[var(--text-muted)]">
                        {hotel} · {MONTH_NAMES[month - 1]} {year} — enter the month, then confirm each day.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={!data || !analysis}
                        onClick={() => setReportDialogOpen(true)}
                    >
                        <ClipboardList /> Generate report
                    </Button>
                    {kind === 'receiving' && (
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={unbilledLoading || unbilledError || monthlyUnbilledGatePasses.length === 0}
                            loading={invoiceCreating}
                            title={
                                unbilledLoading
                                    ? 'Checking for unbilled received quantities'
                                    : unbilledError
                                      ? 'Unable to check unbilled received quantities'
                                      : monthlyUnbilledGatePasses.length === 0
                                        ? 'No unbilled quantities on confirmed receiving days for this month'
                                        : `Create a consolidated invoice from ${monthlyUnbilledGatePasses.length} received gate pass(es)`
                            }
                            onClick={() => setInvoiceDialogOpen(true)}
                        >
                            <Receipt /> Create invoice ({monthlyUnbilledGatePasses.length})
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => void refetch()} loading={isFetching}>
                        <RefreshCw /> Refresh
                    </Button>
                </div>
            </div>

            <Tabs
                items={MONTHLY_KINDS.map((k) => ({ value: k, label: MONTHLY_KIND_LABELS[k] }))}
                value={kind}
                onValueChange={(v) => setKind(v as MonthlyKind)}
                aria-label="Monthly operation type"
            />

            <Card className="p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Month">
                        <Select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                            {MONTH_NAMES.map((name, i) => (
                                <option key={name} value={i + 1}>{name}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Year">
                        <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || MONTH_YEAR.year)} />
                    </Field>
                    <Field
                        label="Quotation"
                        hint="Prices the rows and travels onto every record this month creates."
                        className="lg:col-span-2"
                    >
                        <Select value={quotationId} onChange={(e) => setQuotationId(e.target.value)}>
                            <option value="">No quotation — show items from history</option>
                            {hotelQuotations.map((q) => (
                                <option key={String(q.id)} value={String(q.id)}>
                                    {q.quotation_title || `Quotation ${q.id}`}
                                    {q.status ? ` · ${q.status}` : ''} · {q.line_items?.length ?? 0} items
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>

                {hotelQuotations.length === 0 && (
                    <Notice tone="info" title="No quotations for this hotel">
                        <span className="inline-flex items-center gap-1">
                            Rows fall back to the items this hotel has received in the last 90 days, with no price.
                            <Link to="/quotations/new" className="inline-flex items-center gap-0.5 text-[var(--brand-text)] hover:underline">
                                Create one <ArrowRight className="size-3" />
                            </Link>
                        </span>
                    </Notice>
                )}
                {kind === 'receiving' && unbilledError && (
                    <Notice tone="warning" title="Could not check unbilled receiving">
                        {unbilledErrorDetails instanceof Error
                            ? unbilledErrorDetails.message
                            : 'Refresh the page and try again before creating an invoice.'}
                    </Notice>
                )}
                </Card>

            {data && (
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
                    <Badge tone="info" dot>{draftDays} draft</Badge>
                    <Badge tone="success" dot>{confirmedDays} confirmed</Badge>
                    <span className="inline-flex items-center gap-1">
                        <Info className="size-3.5" />
                        DRAFT days create records that stay invisible to stock until you activate them.
                    </span>
                </div>
            )}

            {data && (
                <Card className="p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Live received quantities and balances</p>
                            <p className="text-[11px] text-[var(--text-faint)]">From active gate passes, deliveries, and pending returns · refreshes every 5 seconds</p>
                        </div>
                        <Badge tone={isFetching ? 'info' : 'success'} dot>{isFetching ? 'Syncing' : 'Live'}</Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            {
                                label: 'Received',
                                value: formatBalanceQuantity(data.operations_summary.totals.received_qty),
                                detail: `${data.operations_summary.gate_pass_count} active received gate pass(es)`,
                            },
                            {
                                label: 'Delivered',
                                value: formatBalanceQuantity(data.operations_summary.totals.delivered_qty),
                                detail: 'Actual activated deliveries',
                            },
                            {
                                label: 'Outstanding delivery',
                                value: formatBalanceQuantity(data.operations_summary.totals.outstanding_delivery_qty),
                                detail: 'Canonical live gate-pass balance',
                            },
                            {
                                label: 'Draft gate passes',
                                value: String(data.operations_summary.draft_gate_pass_count),
                                detail: 'Not yet counted as received stock',
                            },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded border border-[var(--border)] px-3 py-2">
                                <p className="text-[10.5px] font-medium uppercase text-[var(--text-tertiary)]">{stat.label}</p>
                                <p className="mt-1 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{stat.value}</p>
                                <p className="mt-0.5 text-[10.5px] text-[var(--text-faint)]">{stat.detail}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {data && analysis && data.rows.length > 0 && (
                <>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                            {
                                label: 'Estimated monthly value',
                                value: analysis.pricedQty > 0 ? formatMoney(analysis.quotedValue) : '—',
                                detail: `Curtains priced by kg · ${formatQuantity(analysis.unpricedQty)} unpriced pcs · ${formatQuantity(analysis.unpricedCurtainKg)} unpriced kg`,
                            },
                            {
                                label: 'Other items',
                                value: `${formatQuantity(analysis.totalQty)} pcs`,
                                detail: `Curtains: ${formatQuantity(analysis.curtainKg)} kg / ${formatQuantity(Object.values(analysis.itemCurtainPieces).reduce((sum, count) => sum + count, 0))} pcs`,
                            },
                            {
                                label: 'Average per priced day',
                                value: analysis.pricedDays > 0 ? formatMoney(analysis.averagePerPricedDay) : '—',
                                detail: `${analysis.pricedDays} day(s) with priced items`,
                            },
                            {
                                label: 'Highest-value day',
                                value: analysis.highestValueDay
                                    ? `${analysis.highestValueDay.day} ${MONTH_NAMES[month - 1]}`
                                    : '—',
                                detail: analysis.highestValueDay
                                    ? formatMoney(analysis.highestValueDay.value)
                                    : 'No priced quantities',
                            },
                            {
                                label: 'Top item by value',
                                value: analysis.highestValueItem?.name ?? '—',
                                detail: analysis.highestValueItem
                                    ? formatMoney(analysis.highestValueItem.value)
                                    : 'No priced quantities',
                            },
                        ].map((stat) => (
                            <Card key={stat.label} className="min-w-0 p-3">
                                <p className="text-[11px] font-medium text-[var(--text-tertiary)]">{stat.label}</p>
                                <p className="mt-1 truncate text-[15px] font-semibold tabular-nums text-[var(--text-primary)]" title={stat.value}>
                                    {stat.value}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-[var(--text-faint)]" title={stat.detail}>
                                    {stat.detail}
                                </p>
                            </Card>
                        ))}
                    </div>
                    <p className="text-[11.5px] text-[var(--text-faint)]">
                        Values are estimates from the selected quotation; unpriced quantities are excluded. Rewash values are estimates and are billed only when marked chargeable.
                    </p>
                </>
            )}

            {isLoading && (
                <div className="space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            )}

            {isError && (
                <ErrorState
                    title="Could not load the month"
                    description={error instanceof Error ? error.message : 'Unexpected error'}
                    action={<Button variant="secondary" onClick={() => void refetch()}>Try again</Button>}
                />
            )}

            {!isLoading && !isError && data && data.rows.length === 0 && (
                <EmptyState
                    title="No items to show"
                    description="This grid lists the items from the selected quotation, or from what this hotel recently received. Pick a quotation to get started."
                    action={<Button variant="primary" onClick={() => setOpenDay(1)}>Enter day 1</Button>}
                />
            )}

            {!isLoading && !isError && data && data.rows.length > 0 && (
                <Card className="overflow-hidden p-0">
                    {analysis && <Matrix data={data} analysis={analysis} onOpenDay={setOpenDay} />}
                </Card>
            )}

            <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-faint)]">
                <PackageOpen className="size-3.5" />
                Click any day to enter quantities, then confirm it to create gate passes, deliveries or rewash records.
                <CalendarDays className="size-3.5" />
            </p>

            {openDay !== null && data && (
                <DayDialog
                    params={params}
                    day={openDay}
                    dayState={openDayState}
                    rows={data.rows}
                    onClose={() => setOpenDay(null)}
                />
            )}

            {data && analysis && (
                <PrintTarget>
                    <MonthlyOperationsReport
                        ref={reportRef}
                        data={data}
                        analysis={analysis}
                        sections={reportSections}
                        includePrefix={includePrefix}
                    />
                </PrintTarget>
            )}

            {reportDialogOpen && (
                <Dialog open onOpenChange={(open) => { if (!open) setReportDialogOpen(false) }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Select report analytics</DialogTitle>
                            <DialogDescription>
                                Choose the sections to include in the invoice-style PDF report for {hotel}, {MONTH_NAMES[month - 1]} {year}.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogBody className="space-y-3">
                            {REPORT_SECTIONS.map((section) => (
                                <div key={section.key} className="flex items-start gap-3 rounded border border-[var(--border)] p-3 hover:bg-[var(--surface-hover)]">
                                    <Checkbox
                                        checked={reportSections.includes(section.key)}
                                        aria-label={section.label}
                                        onChange={(event) => {
                                            setReportSections((current) => event.target.checked
                                                ? [...current, section.key]
                                                : current.filter((item) => item !== section.key))
                                        }}
                                    />
                                    <span>
                                        <span className="block text-[13px] font-medium text-[var(--text-primary)]">{section.label}</span>
                                        <span className="mt-0.5 block text-[11.5px] text-[var(--text-faint)]">{section.description}</span>
                                    </span>
                                </div>
                            ))}
                        </DialogBody>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
                            <Button variant="primary" disabled={!reportSections.length} onClick={confirmReportPrint}>
                                <Printer /> Print / Save PDF
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {invoiceDialogOpen && (
                <Dialog open onOpenChange={(open) => { if (!open) setInvoiceDialogOpen(false) }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create monthly invoice</DialogTitle>
                            <DialogDescription>
                                Create bills from the received quantities for {hotel}, {MONTH_NAMES[month - 1]} {year}, then combine them into one invoice.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogBody className="space-y-3">
                            <Notice tone="info" title={`${monthlyUnbilledGatePasses.length} gate pass(es) with unbilled received items`}>
                                Existing billed quantities are excluded. The consolidated invoice will open with only the bills created by this action selected.
                            </Notice>
                        </DialogBody>
                        <DialogFooter>
                            <Button variant="secondary" disabled={invoiceCreating} onClick={() => setInvoiceDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                loading={invoiceCreating}
                                disabled={monthlyUnbilledGatePasses.length === 0}
                                onClick={() => void createMonthlyInvoice()}
                            >
                                Create and continue
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {prefixDialog}
        </div>
    )
}
