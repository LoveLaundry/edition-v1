import { useRef, useState, type ElementType, type SyntheticEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, BarChart3, Users, Package, ClipboardList, Banknote, History, TrendingUp, AlertTriangle, CheckCircle, Clock, Download, Printer, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReactToPrint } from 'react-to-print'
import { Link } from 'react-router-dom'
import { usePermissions } from '../../../hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Skeleton } from '../../../components/ui/skeleton'
import { ErrorState } from '../../../components/ui/error-state'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { reports } from '../services/reports.service'
import { toast } from 'sonner'
import { formatCalendarDate, formatTimestamp } from '../../../lib/time'
import { COMPANY } from '../../../config/company'

type ReportTab = 'client' | 'item' | 'gatepass' | 'billing' | 'audit'
type AnalyticsSection = 'clients' | 'items' | 'gatepasses' | 'billing' | 'audit'

const ANALYTICS_SECTIONS: { id: AnalyticsSection; label: string; description: string }[] = [
  { id: 'clients', label: 'Client performance', description: 'Client activity, balances and billing' },
  { id: 'items', label: 'Item analytics', description: 'Received, delivered and pending quantities' },
  { id: 'gatepasses', label: 'Gate pass activity', description: 'Gate pass volume, status and mismatches' },
  { id: 'billing', label: 'Billing summary', description: 'Revenue, paid, pending and outstanding totals' },
  { id: 'audit', label: 'Audit trail', description: 'The latest 100 audit events' },
]

const reportPrintStyles = `
  @page { size: A4 portrait; margin: 12mm; }
  .reports-print-root { display: none; width: 190mm; margin: 0 auto; background: #fff; color: #17202a; font-family: Georgia, serif; }
  .reports-print-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 3px solid #b91c1c; padding-bottom: 12px; }
  .reports-print-title { color: #b91c1c; font-size: 22px; letter-spacing: 2px; font-weight: 800; text-align: right; }
  .reports-print-section { margin-top: 22px; page-break-inside: avoid; break-inside: avoid; }
  .reports-print-section h2 { margin: 0 0 9px; padding-bottom: 5px; border-bottom: 1px solid #b91c1c; color: #991b1b; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; }
  .reports-print-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .reports-print-table th, .reports-print-table td { border: 1px solid #cbd5e1; padding: 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  .reports-print-table th { background: #b91c1c; color: #fff; font-weight: 700; }
  .reports-print-table tbody tr:nth-child(even) { background: #fff7ed; }
  .reports-print-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .reports-print-stat { border: 1px solid #cbd5e1; padding: 9px; }
  .reports-print-stat strong { display: block; margin-top: 4px; color: #991b1b; font-size: 13px; }
  .reports-print-footer { margin-top: 26px; padding-top: 8px; border-top: 2px solid #b91c1c; text-align: center; font-size: 9px; }
  @media print {
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body * { visibility: hidden !important; }
    .reports-print-root, .reports-print-root * { visibility: visible !important; }
    .reports-print-root { display: block !important; position: absolute; inset: 0 auto auto 0; width: auto; margin: 0; }
    .reports-print-table thead { display: table-header-group; }
    .reports-print-table tr { page-break-inside: avoid; break-inside: avoid; }
  }
`

function formatReportAmount(value: unknown): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
}

function PrintTable({ headers, rows }: { headers: string[]; rows: unknown[][] }) {
  return (
    <table className="reports-print-table">
      <thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>
        {rows.length
          ? rows.map((row, index) => <tr key={index}>{row.map((value, cellIndex) => <td key={cellIndex}>{value == null || value === '' ? '—' : String(value)}</td>)}</tr>)
          : <tr><td colSpan={headers.length}>No records available</td></tr>}
      </tbody>
    </table>
  )
}

function ReportsPrintDocument({
  selected, clients, items, gatepasses, billing, audit,
}: {
  selected: AnalyticsSection[]
  clients: any[]
  items: any[]
  gatepasses: any[]
  billing?: any
  audit: any[]
}) {
  const generatedAt = formatCalendarDate(new Date().toISOString())
  return (
    <div className="reports-print-root">
      <style dangerouslySetInnerHTML={{ __html: reportPrintStyles }} />
      <header className="reports-print-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/icon.png" alt="Love Laundry" style={{ width: 62, height: 62, objectFit: 'contain' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, letterSpacing: 1, textTransform: 'uppercase' }}>{COMPANY.name}</h1>
            <p style={{ margin: '2px 0', fontSize: 11, fontStyle: 'italic' }}>{COMPANY.tagline}</p>
            <p style={{ margin: 0, fontSize: 9 }}>{COMPANY.address.line1}, {COMPANY.address.line2}</p>
            <p style={{ margin: 0, fontSize: 9 }}>Tel: {COMPANY.phone.primary} / {COMPANY.phone.secondary} · {COMPANY.email}</p>
          </div>
        </div>
        <div>
          <div className="reports-print-title">BUSINESS REPORT</div>
          <div style={{ textAlign: 'right', fontSize: 10 }}>Reg. No. {COMPANY.registrationNo}</div>
          <div style={{ textAlign: 'right', fontSize: 10 }}>Generated: {generatedAt}</div>
        </div>
      </header>

      {selected.includes('billing') && (
        <section className="reports-print-section">
          <h2>Billing summary</h2>
          <div className="reports-print-stats">
            {[
              ['Total revenue', billing?.total_sales],
              ['Paid', billing?.paid_bills_amount],
              ['Pending', billing?.pending_bills_amount],
              ['Outstanding', billing?.outstanding_amount],
            ].map(([label, value]) => (
              <div className="reports-print-stat" key={label as string}>
                <span style={{ fontSize: 9, textTransform: 'uppercase' }}>{label}</span>
                <strong>{formatReportAmount(value)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {selected.includes('clients') && (
        <section className="reports-print-section">
          <h2>Client performance</h2>
          <PrintTable
            headers={['Client', 'Gate passes', 'Received', 'Delivered', 'Pending', 'Billed', 'Paid', 'Outstanding', 'Mismatches']}
            rows={clients.map(row => [
              row.client_name, row.gate_pass_count, row.total_received, row.total_delivered, row.total_pending,
              formatReportAmount(row.total_billed), formatReportAmount(row.paid_amount), formatReportAmount(row.outstanding),
              row.total_mismatches,
            ])}
          />
        </section>
      )}

      {selected.includes('items') && (
        <section className="reports-print-section">
          <h2>Item analytics</h2>
          <PrintTable
            headers={['Item', 'Received', 'Delivered', 'Pending', 'Mismatches', 'Clients']}
            rows={items.map(row => [row.item_name, row.total_received, row.total_delivered, row.pending, row.mismatch_count, row.client_count])}
          />
        </section>
      )}

      {selected.includes('gatepasses') && (
        <section className="reports-print-section">
          <h2>Gate pass activity</h2>
          <PrintTable
            headers={['Gate pass', 'Client', 'Date', 'Received by', 'Received', 'Delivered', 'Mismatches', 'Status']}
            rows={gatepasses.map(row => [
              row.gate_pass_number, row.client_name, formatCalendarDate(row.receiving_date), row.received_by,
              row.total_received, row.total_delivered, row.mismatch_count, row.status,
            ])}
          />
        </section>
      )}

      {selected.includes('audit') && (
        <section className="reports-print-section">
          <h2>Audit trail · latest 100 events</h2>
          <PrintTable
            headers={['Time', 'User', 'Action', 'Entity', 'Entity ID', 'Details']}
            rows={audit.map(row => [
              formatTimestamp(row.timestamp), row.user_id, row.action, row.entity,
              row.entity_id ? String(row.entity_id).slice(-8) : '—',
              row.details ? (typeof row.details === 'object' ? JSON.stringify(row.details) : row.details) : '—',
            ])}
          />
        </section>
      )}

      <footer className="reports-print-footer">
        {COMPANY.name} · {COMPANY.address.line1}, {COMPANY.address.line2} · {COMPANY.phone.primary} · {COMPANY.email}
      </footer>
    </div>
  )
}

const TABS: { id: ReportTab; label: string; icon: ElementType }[] = [
  { id: 'client', label: 'Client-Wise', icon: Users },
  { id: 'item', label: 'Item-Wise', icon: Package },
  { id: 'gatepass', label: 'Gate Pass', icon: ClipboardList },
  { id: 'billing', label: 'Billing', icon: Banknote },
  { id: 'audit', label: 'Audit Log', icon: History },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  const cfg =
    s === 'delivered' || s === 'paid' || s === 'completed' || s === 'full'
      ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
      : s === 'pending' || s === 'draft'
        ? 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
        : s === 'partial' || s === 'partially_paid'
          ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
          : s === 'cancelled'
            ? 'bg-[var(--surface-3)] text-[#4B5563] border-[var(--border)]'
            : 'bg-[var(--surface-2)] text-[#374151] border-[var(--border)]'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-micro font-semibold capitalize ${cfg}`}>
      {status || '—'}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const a = (action || '').toUpperCase()
  const cfg =
    a.includes('CREATE') ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]' :
      a.includes('UPDATE') || a.includes('EDIT') ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' :
        a.includes('DELETE') || a.includes('REMOVE') ? 'bg-[#FFF1F1] text-[#DC2626] border-[#FECACA]' :
          'bg-[var(--surface-2)] text-[#374151] border-[var(--border)]'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-micro font-semibold ${cfg}`}>
      {action || '—'}
    </span>
  )
}

function StatCard({ label, value, accent, icon: Icon }: { label: string; value: string | number; accent?: string; icon?: ElementType }) {
  const IconEl = Icon
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        {IconEl && <IconEl className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: accent || 'var(--text-tertiary)' }} />}
      </div>
      <p className="text-[20px] font-bold leading-tight" style={{ color: accent || 'var(--text-primary)' }}>{value}</p>
    </Card>
  )
}

// ── Client-Wise ───────────────────────────────────────────────────────────────

function ClientSearch() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')

  const { data: clientsData } = useQuery({
    queryKey: ['reports', 'client-wise'],
    queryFn: reports.clientWise as () => Promise<any[]>,
  })

  const clientNames = Array.from(new Set(
    (clientsData || []).map((c: any) => c.client_name).filter(Boolean)
  ))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'client-summary', search],
    queryFn: () => reports.clientSummary(search),
    enabled: Boolean(search),
  })

  const handleSearch = (e: SyntheticEvent) => {
    e.preventDefault()
    setSearch(input.trim())
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            list="client-list"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter client / hotel name…"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
          />
          <datalist id="client-list">
            {clientNames.map(name => (
              <option key={name} value={name as string} />
            ))}
          </datalist>
        </div>
        <button
          type="submit"
          className="h-10 px-5 rounded-lg bg-[#DC2626] text-white text-[13px] font-medium hover:bg-[#B91C1C] transition cursor-pointer"
        >
          Search
        </button>
      </form>

      {isLoading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-48" />
        </div>
      )}

      {isError && <ErrorState description="Failed to load client summary" />}

      {data && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Gate Passes" value={data.stats.total_gate_passes} icon={ClipboardList} />
            <StatCard label="Items Received" value={data.stats.total_items_received} icon={Package} />
            <StatCard label="Items Delivered" value={data.stats.total_items_delivered} icon={TrendingUp} accent="#16A34A" />
            <StatCard label="Pending Items" value={data.stats.pending_items} icon={Clock} accent="#D97706" />
            <StatCard label="Open Mismatches" value={data.stats.open_mismatches} icon={AlertTriangle} accent="#DC2626" />
            <StatCard label="Pending Bills" value={data.stats.pending_bills} icon={Banknote} accent="#C2410C" />
            <StatCard label="Total Billed" value={`LKR ${data.stats.total_billed.toLocaleString()}`} icon={Banknote} accent="#2563EB" />
            <StatCard label="Outstanding" value={`LKR ${data.stats.outstanding_amount.toLocaleString()}`} icon={AlertTriangle} accent="#DC2626" />
          </div>

          {/* Pending Balances */}
          {data.pending_balances?.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#D97706]" />
                  <CardTitle>Pending Item Balances</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <tr>
                      {['Item Name', 'Received', 'Delivered', 'Pending'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-2)]">
                    {data.pending_balances.map((b: any, i: number) => (
                      <tr key={i} className={b.pending > 0 ? 'bg-[#FFFBEB]' : ''}>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{b.item_name}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{b.received}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{b.delivered}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${b.pending > 0 ? 'text-[#D97706]' : 'text-[#16A34A]'}`}>
                            {b.pending > 0 ? b.pending : '✓ 0'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Recent Gate Passes */}
          {data.gatepasses?.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-[#2563EB]" />
                  <CardTitle>Recent Gate Passes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <tr>
                      {['GP Number', 'Date', 'Received By', 'Items', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-2)]">
                    {data.gatepasses.map((gp: any, i: number) => (
                      <tr key={i} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[var(--text-primary)]">{gp.gate_pass_number}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCalendarDate(gp.receiving_date)}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{gp.received_by || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{gp.total_received ?? gp.items?.length ?? '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={gp.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Recent Bills */}
          {data.bills?.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-[#16A34A]" />
                  <CardTitle>Recent Bills</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <tr>
                      {['Bill No.', 'Date', 'Amount', 'Paid', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-2)]">
                    {data.bills.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[var(--text-primary)]">{b.bill_number || b.id}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCalendarDate(b.created_at)}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">LKR {(b.total_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-[#16A34A]">LKR {(b.paid_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.payment_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {!data && !isLoading && !isError && (
        <div className="py-16 text-center space-y-2">
          <Users className="h-8 w-8 mx-auto text-[#D1D5DB]" />
          <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>Enter a client name above to view their complete summary</p>
        </div>
      )}
    </div>
  )
}

// ── Item-Wise ─────────────────────────────────────────────────────────────────

function ItemWiseReport() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['reports', 'item-wise'],
    queryFn: reports.itemWise as () => Promise<any[]>,
  })

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
  if (isError) return <ErrorState description="Failed to load item-wise report" />
  if (!data.length) return <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-tertiary)' }}>No data available</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
          <tr>
            {['Item Name', 'Total Received', 'Total Delivered', 'Pending', 'Mismatches', 'Clients'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--surface-2)] bg-white">
          {data.map((row: any, i: number) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`hover:bg-[var(--surface-2)] transition-colors ${(row.pending > 0) ? 'bg-[#FFFBEB]' : ''}`}
            >
              <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.item_name || '—'}</td>
              <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{row.total_received ?? '—'}</td>
              <td className="px-4 py-3 text-[#16A34A] font-semibold">{row.total_delivered ?? '—'}</td>
              <td className="px-4 py-3">
                {row.pending > 0
                  ? <span className="font-bold text-[#D97706]">{row.pending}</span>
                  : <span className="text-[#16A34A] font-semibold">✓ 0</span>
                }
              </td>
              <td className="px-4 py-3">
                {row.mismatch_count > 0
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F1] border border-[#FECACA] px-2 py-0.5 text-micro font-semibold text-[#DC2626]">
                    <AlertTriangle className="h-2.5 w-2.5" />{row.mismatch_count}
                  </span>
                  : <span className="text-[#16A34A]">—</span>
                }
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.client_count ?? '—'}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Gate Pass Report ──────────────────────────────────────────────────────────

function GatePassReport() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['reports', 'gatepass-wise'],
    queryFn: reports.gatepassWise as () => Promise<any[]>,
  })

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
  if (isError) return <ErrorState description="Failed to load gate pass report" />
  if (!data.length) return <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-tertiary)' }}>No data available</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
          <tr>
            {['GP No.', 'Client', 'Date', 'Received By', 'Received', 'Delivered', 'Mismatches', 'Status'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--surface-2)] bg-white">
          {data.map((row: any, i: number) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="hover:bg-[var(--surface-2)] transition-colors"
            >
              <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[var(--text-primary)] whitespace-nowrap">{row.gate_pass_number}</td>
              <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.client_name}</td>
              <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatCalendarDate(row.receiving_date)}</td>
              <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.received_by || '—'}</td>
              <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{row.total_received ?? '—'}</td>
              <td className="px-4 py-3 font-semibold text-[#16A34A]">{row.total_delivered ?? '—'}</td>
              <td className="px-4 py-3">
                {row.mismatch_count > 0
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F1] border border-[#FECACA] px-2 py-0.5 text-micro font-semibold text-[#DC2626]">
                    <AlertTriangle className="h-2.5 w-2.5" />{row.mismatch_count}
                  </span>
                  : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                }
              </td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Billing Report ────────────────────────────────────────────────────────────

function BillingReport() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'billing'],
    queryFn: reports.billing,
  })

  const { data: clientData = [], isLoading: clientLoading } = useQuery({
    queryKey: ['reports', 'client-wise'],
    queryFn: reports.clientWise as () => Promise<any[]>,
  })

  if (isLoading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
  if (isError) return <ErrorState description="Failed to load billing report" />
  if (!data) return null

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Revenue" value={`LKR ${(data.total_sales || 0).toLocaleString()}`} accent="#DC2626" icon={TrendingUp} />
        <StatCard label="Paid" value={`LKR ${(data.paid_bills_amount || 0).toLocaleString()}`} accent="#16A34A" icon={CheckCircle} />
        <StatCard label="Pending" value={`LKR ${(data.pending_bills_amount || 0).toLocaleString()}`} accent="#D97706" icon={Clock} />
        <StatCard label="Outstanding" value={`LKR ${(data.outstanding_amount || 0).toLocaleString()}`} accent="#2563EB" icon={AlertTriangle} />
      </div>

      {/* Per-client breakdown */}
      {clientLoading && <Skeleton className="h-48" />}
      {clientData.length > 0 && (
        <Card>
          <CardHeader className="border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#2563EB]" />
              <CardTitle>Per-Client Billing Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <tr>
                  {['Client', 'Gate Passes', 'Total Billed', 'Paid', 'Outstanding', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-2)]">
                {clientData.map((row: any, i: number) => {
                  const outstanding = (row.total_billed || 0) - (row.paid_amount || 0)
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={`hover:bg-[var(--surface-2)] transition-colors ${outstanding > 0 ? 'bg-[#FFFBEB]' : ''}`}
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{row.client_name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.gate_pass_count ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">LKR {(row.total_billed || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-[#16A34A]">LKR {(row.paid_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {outstanding > 0
                          ? <span className="font-bold text-[#DC2626]">LKR {outstanding.toLocaleString()}</span>
                          : <span className="text-[#16A34A] font-semibold">✓ Settled</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={outstanding > 0 ? 'pending' : 'paid'} />
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function AuditLog() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['reports', 'audit'],
    queryFn: () => reports.auditLogs(100) as Promise<any[]>,
  })

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
  if (isError) return <ErrorState description="Failed to load audit log" />
  if (!data.length) return <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-tertiary)' }}>No audit entries found</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
          <tr>
            {['Time', 'User', 'Action', 'Entity', 'Entity ID', 'Details'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--surface-2)] bg-white">
          {(data as any[]).map((row, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.01 }}
              className="hover:bg-[var(--surface-2)] transition-colors"
            >
              <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {formatTimestamp(row.timestamp)}
              </td>
              <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.user_id || '—'}</td>
              <td className="px-4 py-3"><ActionBadge action={row.action} /></td>
              <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{row.entity || '—'}</td>
              <td className="px-4 py-3 font-mono text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{row.entity_id ? String(row.entity_id).slice(-8) : '—'}</td>
              <td className="px-4 py-3 max-w-50 truncate text-[12px]" style={{ color: 'var(--text-tertiary)' }} title={row.details ? JSON.stringify(row.details) : ''}>
                {row.details
                  ? typeof row.details === 'object'
                    ? Object.entries(row.details)
                        .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
                        .map(([k, v]) => {
                          if (Array.isArray(v)) return `${k}: ${v.length}`
                          if (typeof v === 'object') return `${k}: {…}`
                          return `${k}: ${v}`
                        })
                        .join(', ') || '—'
                    : String(row.details)
                  : '—'}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { canAccess } = usePermissions()
  const canViewOperationalReports = canAccess({ adminOnly: true })
  const [activeTab, setActiveTab] = useState<ReportTab>('client')
  const [selectedAnalytics, setSelectedAnalytics] = useState<AnalyticsSection[]>(['clients', 'items', 'gatepasses', 'billing'])
  const printRef = useRef<HTMLDivElement>(null)
  const clientsQuery = useQuery({
    queryKey: ['reports', 'client-wise'],
    queryFn: reports.clientWise as () => Promise<any[]>,
    enabled: selectedAnalytics.includes('clients'),
  })
  const itemsQuery = useQuery({
    queryKey: ['reports', 'item-wise'],
    queryFn: reports.itemWise as () => Promise<any[]>,
    enabled: selectedAnalytics.includes('items'),
  })
  const gatepassesQuery = useQuery({
    queryKey: ['reports', 'gatepass-wise'],
    queryFn: reports.gatepassWise as () => Promise<any[]>,
    enabled: selectedAnalytics.includes('gatepasses'),
  })
  const billingQuery = useQuery({
    queryKey: ['reports', 'billing'],
    queryFn: reports.billing,
    enabled: selectedAnalytics.includes('billing'),
  })
  const auditQuery = useQuery({
    queryKey: ['reports', 'audit'],
    queryFn: () => reports.auditLogs(100) as Promise<any[]>,
    enabled: selectedAnalytics.includes('audit'),
  })
  const printQueries = [
    selectedAnalytics.includes('clients') ? clientsQuery : null,
    selectedAnalytics.includes('items') ? itemsQuery : null,
    selectedAnalytics.includes('gatepasses') ? gatepassesQuery : null,
    selectedAnalytics.includes('billing') ? billingQuery : null,
    selectedAnalytics.includes('audit') ? auditQuery : null,
  ].filter(Boolean)
  const printLoading = printQueries.some(query => query!.isLoading)
  const printError = printQueries.some(query => query!.isError)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Love-Laundry-Reports-${new Date().toISOString().slice(0, 10)}`,
  })

  const handleExport = async (type: 'gatepasses' | 'bills' | 'deliveries', format: 'csv' | 'xlsx' = 'csv') => {
    try {
      if (format === 'xlsx') {
        await reports.exportExcel(type)
      } else {
        await reports.exportCSV(type)
      }
      toast.success(`Exported ${type} as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Reports' }]} />
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF1F1] border border-[#FECACA]">
            <BarChart3 className="h-4 w-4 text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-dashboard-title">Reports</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Business analytics & audit trail</p>
          </div>
        </div>
      </div>

      {canViewOperationalReports && (
        <Link
          to="/management/reports"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 transition hover:bg-green-100 dark:border-green-900 dark:bg-green-950/30 dark:hover:bg-green-950/50"
        >
          <span>
            <span className="block text-sm font-semibold text-green-950 dark:text-green-100">Master operating report</span>
            <span className="mt-0.5 block text-xs text-green-800 dark:text-green-200">Confirmed daily receiving, quotation-priced income, payroll, expenses, and net result</span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-green-900 dark:text-green-100">Open report <ArrowRight size={16} /></span>
        </Link>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-md font-semibold" style={{ color: 'var(--text-primary)' }}>Build a printable report</h2>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              Choose the analytics to include, then print or save the invoice-style report as a PDF.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedAnalytics(ANALYTICS_SECTIONS.map(section => section.id))}
              className="rounded-lg border px-3 py-2 text-[12px] font-medium transition hover:bg-surface-hover"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelectedAnalytics([])}
              className="rounded-lg border px-3 py-2 text-[12px] font-medium transition hover:bg-surface-hover"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!selectedAnalytics.length || printLoading || printError}
              className="flex items-center gap-2 rounded-lg bg-[#DC2626] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
              title={printError ? 'A selected report could not be loaded' : undefined}
            >
              <Printer className="h-3.5 w-3.5" />
              {printLoading ? 'Preparing…' : 'Print / Save PDF'}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ANALYTICS_SECTIONS.map(section => {
            const checked = selectedAnalytics.includes(section.id)
            return (
              <label
                key={section.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition hover:bg-surface-hover"
                style={{ borderColor: checked ? '#FECACA' : 'var(--border)', backgroundColor: checked ? '#FFF8F8' : undefined }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSelectedAnalytics(current => (
                    checked ? current.filter(item => item !== section.id) : [...current, section.id]
                  ))}
                  className="mt-0.5 accent-[#DC2626]"
                />
                <span>
                  <span className="block text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{section.label}</span>
                  <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{section.description}</span>
                </span>
              </label>
            )
          })}
        </div>
        {printError && (
          <p className="mt-3 text-[12px] text-[#DC2626]" role="alert">
            One or more selected analytics could not be loaded. Retry after checking your connection.
          </p>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-0.5 scrollbar-hidden">
        <div className="flex gap-1 flex-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition cursor-pointer',
                activeTab === id
                  ? 'bg-[#DC2626] text-white shadow-sm'
                  : 'hover:bg-[var(--surface-3)]',
              ].join(' ')}
              style={activeTab !== id ? { color: 'var(--text-secondary)' } : {}}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {/* Export buttons */}
        <div className="flex gap-1.5 shrink-0">
          {([
            { type: 'gatepasses' as const, label: 'Gate Passes' },
            { type: 'bills' as const, label: 'Bills' },
            { type: 'deliveries' as const, label: 'Deliveries' },
          ]).map(exp => (
            <div key={exp.type} className="flex gap-1">
              <button
                onClick={() => handleExport(exp.type, 'csv')}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition cursor-pointer hover:bg-surface-hover"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Download className="h-3 w-3" />
                {exp.label} CSV
              </button>
              <button
                onClick={() => handleExport(exp.type, 'xlsx')}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition cursor-pointer hover:bg-surface-hover"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Download className="h-3 w-3" />
                {exp.label} Excel
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {activeTab === 'client' && <ClientSearch />}
        {activeTab === 'item' && <ItemWiseReport />}
        {activeTab === 'gatepass' && <GatePassReport />}
        {activeTab === 'billing' && <BillingReport />}
        {activeTab === 'audit' && <AuditLog />}
      </motion.div>

      <div ref={printRef}>
        <ReportsPrintDocument
          selected={selectedAnalytics}
          clients={clientsQuery.data || []}
          items={itemsQuery.data || []}
          gatepasses={gatepassesQuery.data || []}
          billing={billingQuery.data}
          audit={auditQuery.data || []}
        />
      </div>
    </div>
  )
}
