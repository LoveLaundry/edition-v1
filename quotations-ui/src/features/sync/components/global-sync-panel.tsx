import { useState, useCallback, useEffect, useRef } from 'react'
import {
  RefreshCw as ArrowsClockwise,
  CircleCheck as CheckCircle,
  CircleAlert as WarningCircle,
  Clock,
  Building2 as Buildings,
  ChevronDown as CaretDown,
  ChevronRight as CaretRight,
  Package,
  Truck,
  RotateCcw as ArrowCounterClockwise,
  LoaderCircle as CircleNotch,
  Receipt,
  Workflow as FlowArrow,
  X,
  RefreshCw as ArrowClockwise,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'
import { toast } from 'sonner'
import type { SyncHotelStatus, SyncSection } from '../api/sync-api'
import { fetchSyncStatus, triggerHotelSync, triggerGlobalSync } from '../api/sync-api'

/* ────────────────────────────────────────────────────────────────────────── */
/*  Status helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_META = {
  synced:  { label: 'Synced',      color: 'var(--success-text)', bg: 'var(--success-soft)', border: 'var(--success-border)', icon: CheckCircle },
  partial: { label: 'Partial',     color: 'var(--warning-text)', bg: 'var(--warning-soft)', border: 'var(--warning-border)', icon: WarningCircle },
  pending: { label: 'Pending',     color: 'var(--info-text)',    bg: 'var(--info-soft)',    border: 'var(--info-border)',    icon: Clock },
  error:   { label: 'Error',       color: 'var(--danger-text)',  bg: 'var(--danger-soft)',  border: 'var(--danger-border)',  icon: WarningCircle },
} as const

const KIND_META: Record<string, { label: string; icon: typeof Package }> = {
  receiving: { label: 'Receiving',  icon: Package },
  delivery:  { label: 'Deliveries', icon: Truck },
  rewash:    { label: 'Rewash',     icon: ArrowCounterClockwise },
}

function StatusPill({ status }: { status: keyof typeof STATUS_META }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className="sync-status-pill inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: meta.color,
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
      }}
    >
      <Icon size={12} />
      {meta.label}
    </span>
  )
}

function ProgressBar({ synced, total }: { synced: number; total: number }) {
  const pct = total > 0 ? Math.round((synced / total) * 100) : 0
  return (
    <div className="sync-progress-track">
      <div
        className="sync-progress-fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Section row inside a hotel                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function SectionRow({
  section,
  hotelName,
  year,
  month,
  onSynced,
}: {
  section: SyncSection
  hotelName: string
  year: number
  month: number
  onSynced: () => void
}) {
  const [syncing, setSyncing] = useState(false)
  const meta = KIND_META[section.kind] ?? KIND_META.receiving
  const KindIcon = meta.icon

  const handleSync = async () => {
    setSyncing(true)
    try {
      const results = await triggerHotelSync(hotelName, year, month, [section.kind])
      const r = results[0]
      if (r?.errors?.length) {
        toast.error(`${meta.label}: ${r.errors.length} error(s)`)
      } else {
        toast.success(`${meta.label}: ${r?.synced_count ?? 0} synced, ${r?.created_count ?? 0} created`)
      }
      onSynced()
    } catch {
      toast.error(`Failed to sync ${meta.label}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="sync-section-row">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="sync-kind-icon">
          <KindIcon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">
              {meta.label}
            </span>
            <StatusPill status={section.status} />
          </div>
          <div className="mt-1">
            <ProgressBar synced={section.synced_days} total={section.total_days} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
            <span>{section.synced_days}/{section.total_days} days synced</span>
            {section.gate_pass_count > 0 && (
              <span className="flex items-center gap-0.5">
                <FlowArrow size={10} /> {section.gate_pass_count} gate passes
              </span>
            )}
            {section.bill_count > 0 && (
              <span className="flex items-center gap-0.5">
                <Receipt size={10} /> {section.bill_count} bills
              </span>
            )}
            {section.return_count > 0 && (
              <span className="flex items-center gap-0.5">
                <ArrowCounterClockwise size={10} /> {section.return_count} returns
              </span>
            )}
          </div>
        </div>
      </div>

      {section.status !== 'synced' && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="sync-section-action"
          title={`Sync ${meta.label}`}
        >
          {syncing ? (
            <CircleNotch size={14} className="animate-spin" />
          ) : (
            <ArrowClockwise size={14} />
          )}
        </button>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hotel card (expandable)                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function HotelCard({
  hotel,
  year,
  month,
  onSynced,
}: {
  hotel: SyncHotelStatus
  year: number
  month: number
  onSynced: () => void
}) {
  const [expanded, setExpanded] = useState(hotel.overall_status !== 'synced')

  const totalSynced = hotel.sections.reduce((s, sec) => s + sec.synced_days, 0)
  const totalDays = hotel.sections.reduce((s, sec) => s + sec.total_days, 0)

  return (
    <div className="sync-hotel-card" data-status={hotel.overall_status}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="sync-hotel-header"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="sync-hotel-avatar">
            <Buildings size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                {hotel.client_name}
              </span>
              <span className="shrink-0 rounded-xs bg-[var(--surface-3)] px-1.5 py-px text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
                {hotel.hotel_code}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
              <StatusPill status={hotel.overall_status} />
              <span>{totalSynced}/{totalDays} total synced</span>
            </div>
          </div>
        </div>

        <span className={cn(
          'shrink-0 text-[var(--text-faint)] transition-transform duration-200',
          expanded && 'rotate-90',
        )}>
          <CaretRight size={14} />
        </span>
      </button>

      {/* Expandable sections */}
      <div className={cn('sync-hotel-body', expanded && 'sync-hotel-body--open')}>
        <div className="sync-hotel-body-inner">
          {hotel.sections.map((section) => (
            <SectionRow
              key={section.kind}
              section={section}
              hotelName={hotel.client_name}
              year={year}
              month={month}
              onSynced={onSynced}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Month selector (small inline picker)                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function MonthPicker({
  year,
  month,
  onChange,
}: {
  year: number
  month: number
  onChange: (y: number, m: number) => void
}) {
  const goBack = () => {
    if (month === 1) onChange(year - 1, 12)
    else onChange(year, month - 1)
  }
  const goFwd = () => {
    if (month === 12) onChange(year + 1, 1)
    else onChange(year, month + 1)
  }

  return (
    <div className="sync-month-picker">
      <button type="button" onClick={goBack} className="sync-month-arrow" aria-label="Previous month">
        <CaretDown size={13} className="rotate-90" />
      </button>
      <span className="sync-month-label">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button type="button" onClick={goFwd} className="sync-month-arrow" aria-label="Next month">
        <CaretDown size={13} className="-rotate-90" />
      </button>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  MAIN PANEL                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export function GlobalSyncPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [hotels, setHotels] = useState<SyncHotelStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [globalSyncing, setGlobalSyncing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSyncStatus(year, month)
      setHotels(data)
    } catch {
      // If endpoint doesn't exist yet, show mock empty state
      setHotels([])
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Escape key
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleGlobalSync = async () => {
    setGlobalSyncing(true)
    try {
      const results = await triggerGlobalSync(year, month)
      const totalSynced = results.reduce((s, r) => s + r.synced_count, 0)
      const totalCreated = results.reduce((s, r) => s + r.created_count, 0)
      const totalErrors = results.reduce((s, r) => s + r.errors.length, 0)
      if (totalErrors > 0) {
        toast.warning(`Synced ${totalSynced} items, created ${totalCreated}, but ${totalErrors} errors`)
      } else {
        toast.success(`All hotels synced: ${totalSynced} synced, ${totalCreated} created`)
      }
      await load()
    } catch {
      toast.error('Global sync failed — please try individual hotels')
    } finally {
      setGlobalSyncing(false)
    }
  }

  const stats = {
    total: hotels.length,
    synced: hotels.filter((h) => h.overall_status === 'synced').length,
    partial: hotels.filter((h) => h.overall_status === 'partial').length,
    pending: hotels.filter((h) => h.overall_status === 'pending').length,
    error: hotels.filter((h) => h.overall_status === 'error').length,
  }

  if (!open) return null

  return (
    <div className="sync-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} className="sync-panel" role="dialog" aria-modal="true" aria-label="Operations Sync">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="sync-panel-header">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="sync-panel-icon">
              <ArrowsClockwise size={20} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                Operations Sync
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                Monthly operations ↔ Gate Passes · Bills · Returns
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sync-close-btn"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Controls bar ────────────────────────────────────────── */}
        <div className="sync-controls">
          <MonthPicker
            year={year}
            month={month}
            onChange={(y, m) => { setYear(y); setMonth(m) }}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={load}
              disabled={loading}
              className="gap-1.5"
            >
              <ArrowClockwise size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleGlobalSync}
              disabled={globalSyncing || loading}
              className="gap-1.5"
            >
              {globalSyncing ? (
                <CircleNotch size={13} className="animate-spin" />
              ) : (
                <ArrowsClockwise size={13} />
              )}
              Sync All
            </Button>
          </div>
        </div>

        {/* ── Status summary strip ────────────────────────────────── */}
        <div className="sync-summary-strip">
          <div className="sync-summary-item">
            <span className="sync-summary-num">{stats.total}</span>
            <span className="sync-summary-label">Hotels</span>
          </div>
          <div className="sync-summary-divider" />
          <div className="sync-summary-item" data-tone="success">
            <span className="sync-summary-num">{stats.synced}</span>
            <span className="sync-summary-label">Synced</span>
          </div>
          <div className="sync-summary-divider" />
          <div className="sync-summary-item" data-tone="warning">
            <span className="sync-summary-num">{stats.partial}</span>
            <span className="sync-summary-label">Partial</span>
          </div>
          <div className="sync-summary-divider" />
          <div className="sync-summary-item" data-tone="info">
            <span className="sync-summary-num">{stats.pending}</span>
            <span className="sync-summary-label">Pending</span>
          </div>
          <div className="sync-summary-divider" />
          <div className="sync-summary-item" data-tone="danger">
            <span className="sync-summary-num">{stats.error}</span>
            <span className="sync-summary-label">Errors</span>
          </div>
        </div>

        {/* ── Hotel list ──────────────────────────────────────────── */}
        <div className="sync-hotel-list">
          {loading ? (
            <div className="sync-loading-state">
              <CircleNotch size={28} className="animate-spin text-[var(--brand)]" />
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                Loading sync status…
              </p>
            </div>
          ) : hotels.length === 0 ? (
            <div className="sync-empty-state">
              <ArrowsClockwise size={36} className="text-[var(--text-faint)]" />
              <p className="mt-2 text-[13px] font-medium text-[var(--text-secondary)]">
                No hotels found for this month
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                Select a different month or enter monthly operations data first.
              </p>
            </div>
          ) : (
            hotels.map((hotel) => (
              <HotelCard
                key={hotel.client_name}
                hotel={hotel}
                year={year}
                month={month}
                onSynced={load}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Floating Action Button (placed in AppShell)                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function SyncFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sync-fab"
        aria-label="Open Operations Sync panel"
        title="Operations Sync"
      >
        <ArrowsClockwise size={22} />
      </button>
      <GlobalSyncPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
