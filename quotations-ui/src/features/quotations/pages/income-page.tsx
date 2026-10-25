import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Search, X, Banknote, Receipt, Wallet, AlertCircle, CircleDollarSign } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard, StatCardSkeleton } from '../../../components/ui/stat-card'
import { FilterBar } from '../../../components/ui/filter-bar'
import { Badge } from '../../../components/ui/badge'
import { DataTable } from '../../../components/ui/data-table'
import { EmptyState } from '../../../components/ui/empty-state'
import { SkeletonTable } from '../../../components/ui/skeleton'
import { ErrorState } from '../../../components/ui/empty-state'
import { ExportButton } from '../../../components/ui/export-button'
import { Pagination } from '../../../components/ui/pagination'
import { useHotelScope } from '../../../context/HotelContext'
import {
  billOutstanding,
  billPaid,
  billTotal,
  useGatepassIncome,
  type IncomeBilledStatus,
  type IncomeRow,
} from '../hooks/useGatepassIncome'
import { Portal } from '../../../components/ui/portal'
import {
  buildPriceIndex,
  normalizeName,
  selectQuotationForPass,
  valueGatePass,
} from '../services/gatepass-income'

const PAGE_SIZE = 20

const STATUS_TONE: Record<IncomeBilledStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  UNBILLED: 'warning',
  BILLED: 'info',
  PARTIAL: 'info',
  PAID: 'success',
}

const STATUS_LABEL: Record<IncomeBilledStatus, string> = {
  UNBILLED: 'Unbilled',
  BILLED: 'Billed · unpaid',
  PARTIAL: 'Partly received',
  PAID: 'Received',
}

/**
 * Income accrues at RECEIVING (received_qty x quotation price), not from
 * bills. Bills record billed-or-not; bill payments record received-or-not.
 */
export default function IncomePage() {
  const { hotel, isAllScope } = useHotelScope()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [client, setClient] = useState('')
  const [status, setStatus] = useState<'' | IncomeBilledStatus>('')
  const [search, setSearch] = useState('')
  const [viewRow, setViewRow] = useState<IncomeRow | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!isAllScope && hotel) setClient(hotel)
    if (isAllScope) setClient('')
  }, [hotel, isAllScope])

  useEffect(() => {
    setOffset(0)
  }, [from, to, client, status, search, hotel, isAllScope])

  const scopeClient = isAllScope ? undefined : hotel
  const { rows, bills, billsTotal, quotations, isLoading, isError, refetch } = useGatepassIncome(scopeClient)

  const clients = useMemo(
    () => Array.from(new Set(rows.map((r) => r.client))).sort((a, b) => a.localeCompare(b)),
    [rows],
  )

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (from && r.date < from) return false
      if (to && r.date > to) return false
      if (client && r.client !== client) return false
      if (q && ![r.client, r.gpNumber, r.quotationTitle].some((v) => v.toLowerCase().includes(q))) return false
      return true
    })
  }, [rows, from, to, client, search])

  const visible = useMemo(
    () => (status ? scoped.filter((r) => r.billedStatus === status) : scoped),
    [scoped, status],
  )

  // Bill totals cover both billing legs (gate-pass and delivery bills);
  // per-pass amounts only cover the gate-pass leg.
  const scopedBills = useMemo(() => {
    return bills.filter((b) => {
      if (client && b.client_name !== client) return false
      const d = String(b.receiving_date ?? b.created_at ?? '').slice(0, 10)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
  }, [bills, client, from, to])

  const totalIncome = scoped.reduce((s, r) => s + r.income, 0)
  const unbilledIncome = scoped.filter((r) => r.billedStatus === 'UNBILLED').reduce((s, r) => s + r.income, 0)
  const billedTotal = scopedBills.reduce((s, b) => s + billTotal(b), 0)
  const collected = scopedBills.reduce((s, b) => s + billPaid(b), 0)
  const outstanding = scopedBills.reduce((s, b) => s + billOutstanding(b), 0)
  const unpricedQty = scoped.reduce((s, r) => s + r.unpricedQty, 0)
  const unpricedPasses = scoped.filter((r) => r.hasUnpriced).length

  const pageRows = visible.slice(offset, offset + PAGE_SIZE)
  // Flapping networks fail background refetches while good cached data sits
  // in the query cache. Only the truly-empty state is an error; otherwise
  // keep showing data with a slim retry notice.
  const hasData = rows.length > 0 || bills.length > 0
  const showError = isError && !isLoading && !hasData
  const showStale = isError && !isLoading && hasData

  const columns = [
    { key: 'date', header: 'Received', render: (r: IncomeRow) => <span className="whitespace-nowrap">{r.date}</span> },
    {
      key: 'client',
      header: 'Client',
      render: (r: IncomeRow) => <span className="font-medium">{r.client}</span>,
    },
    {
      key: 'gpNumber',
      header: 'Gate pass',
      render: (r: IncomeRow) => (
        <Link to={`/gate-passes/${r.pass.id}`} className="text-[var(--brand-text)] hover:underline">
          {r.gpNumber}
        </Link>
      ),
    },
    { key: 'receivedQty', header: 'Qty', align: 'right' as const, render: (r: IncomeRow) => r.receivedQty.toLocaleString() },
    {
      key: 'income',
      header: 'Income',
      align: 'right' as const,
      render: (r: IncomeRow) => (
        <span className="font-semibold text-[var(--success-text)]">
          LKR {r.income.toLocaleString()}
          {r.hasUnpriced && <span className="ml-1 text-[10px] font-normal text-[var(--warning-text)]">+ unpriced</span>}
        </span>
      ),
    },
    {
      key: 'billedStatus',
      header: 'Billed?',
      align: 'center' as const,
      render: (r: IncomeRow) => (
        <span title={r.billedVia === 'delivery' ? 'Billed through delivery bills' : undefined}>
          <Badge variant={STATUS_TONE[r.billedStatus]}>{STATUS_LABEL[r.billedStatus]}</Badge>
        </span>
      ),
    },
    {
      key: 'billedAmount',
      header: 'Billed',
      align: 'right' as const,
      render: (r: IncomeRow) =>
        r.billedVia === 'delivery' ? (
          <span className="text-gray-400" title="Billed through delivery bills — see Bills">via delivery</span>
        ) : r.billedAmount ? (
          `LKR ${r.billedAmount.toLocaleString()}`
        ) : (
          '—'
        ),
    },
    {
      key: 'paidAmount',
      header: 'Received',
      align: 'right' as const,
      render: (r: IncomeRow) =>
        r.billedVia === 'delivery' ? (
          <span className="text-gray-400">—</span>
        ) : r.paidAmount ? (
          <span className="text-[var(--success-text)]">LKR {r.paidAmount.toLocaleString()}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right' as const,
      render: (r: IncomeRow) =>
        r.billedVia === 'delivery' ? (
          <span className="text-gray-400">—</span>
        ) : r.outstanding ? (
          <span className="font-medium text-[var(--danger-text)]">LKR {r.outstanding.toLocaleString()}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: 'Detail',
      align: 'center' as const,
      render: (r: IncomeRow) => (
        <button onClick={() => setViewRow(r)} className="p-1 hover:bg-gray-100 rounded" aria-label={`View income detail for ${r.gpNumber}`}>
          <Eye size={14} />
        </button>
      ),
    },
  ]

  const exportCols = [
    { key: 'date', label: 'Received' },
    { key: 'client', label: 'Client' },
    { key: 'gpNumber', label: 'Gate pass' },
    { key: 'receivedQty', label: 'Qty' },
    { key: 'income', label: 'Income' },
    { key: 'unpricedQty', label: 'Unpriced qty' },
    { key: 'quotationTitle', label: 'Quotation' },
    { key: 'billedStatus', label: 'Billed status' },
    { key: 'billedAmount', label: 'Billed' },
    { key: 'paidAmount', label: 'Received' },
    { key: 'outstanding', label: 'Outstanding' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Income"
        subtitle={`${scoped.length} gate passes · accrued LKR ${Math.round(totalIncome).toLocaleString()} · received LKR ${Math.round(collected).toLocaleString()}`}
        actions={<ExportButton data={visible} filename="income" columns={exportCols} />}
      />

      {!showError && (isLoading ? (
        <StatCardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 stagger">
        <StatCard label="Accrued income" value={`LKR ${Math.round(totalIncome).toLocaleString()}`} icon={<Banknote size={20} />} color="green" />
        <StatCard label="Billed" value={`LKR ${Math.round(billedTotal).toLocaleString()}`} icon={<Receipt size={20} />} color="blue" to="/bills" />
        <StatCard label="Unbilled income" value={`LKR ${Math.round(unbilledIncome).toLocaleString()}`} icon={<CircleDollarSign size={20} />} color="amber" />
        <StatCard label="Received (paid)" value={`LKR ${Math.round(collected).toLocaleString()}`} icon={<Wallet size={20} />} color="green" />
        <StatCard label="Outstanding" value={`LKR ${Math.round(outstanding).toLocaleString()}`} icon={<AlertCircle size={20} />} tone="danger" to="/ledger" />
      </div>
      {unpricedPasses > 0 && (
        <p className="text-xs text-amber-950 bg-amber-50 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-100 rounded-lg px-3 py-2">
          {unpricedQty.toLocaleString()} received items across {unpricedPasses} gate pass{unpricedPasses === 1 ? '' : 'es'} have
          no quotation price and are valued at LKR 0. Link a quotation to the gate pass to count them as income.
        </p>
      )}

      {billsTotal > bills.length && (
        <p className="text-xs text-amber-950 bg-amber-50 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-100 rounded-lg px-3 py-2">
          Showing {bills.length} of {billsTotal} bills — billed, received and outstanding totals may be
          incomplete. Narrow the client or date range for exact bill money.
        </p>
      )}
        </>
      ))}

      {showStale && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          <span>Connection dropped — showing saved data. It will refresh when the network is back.</span>
          <button type="button" onClick={refetch} className="font-semibold underline underline-offset-2 hover:no-underline">
            Retry now
          </button>
        </div>
      )}

      <FilterBar>
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        {isAllScope && (
          <select value={client} onChange={(e) => setClient(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | IncomeBilledStatus)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All statuses</option>
          <option value="UNBILLED">Unbilled</option>
          <option value="BILLED">Billed · unpaid</option>
          <option value="PARTIAL">Partly received</option>
          <option value="PAID">Received</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, gate pass, quotation..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </FilterBar>

      {isLoading ? (
        <SkeletonTable rows={8} cols={10} />
      ) : isError ? (
        <ErrorState
          title="Income could not be loaded"
          description="Gate passes, quotations or bills did not load. Check the connection and try again."
          onRetry={refetch}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageRows}
            emptyState={<EmptyState title="No income found" description="No received gate passes match your filters." />}
          />
          <Pagination total={visible.length} limit={PAGE_SIZE} offset={offset} onChange={setOffset} className="px-1" />
        </>
      )}

      {viewRow && (
        <Portal><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-lg font-semibold">Income · {viewRow.gpNumber}</h2>
              <button onClick={() => setViewRow(null)} aria-label="Close details"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {viewRow.date} · {viewRow.client} · {viewRow.quotationTitle}
              {viewRow.quotationBasis === 'client-best' && ' (best-matching client quotation)'}
              {viewRow.quotationBasis === 'none' && ' (no quotation — lines unpriced)'}
              {viewRow.billedVia === 'delivery' && ' · billed through delivery bills'}
            </p>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Item</th>
                    <th className="px-2 py-1.5 text-right">Qty</th>
                    <th className="px-2 py-1.5 text-right">Rate</th>
                    <th className="px-2 py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const byId = new Map(quotations.map((q) => [String(q.id), q]))
                    const clientQuotes = quotations.filter((q) => normalizeName(q.client_name) === normalizeName(viewRow.client))
                    const { quotation } = selectQuotationForPass(viewRow.pass, byId, clientQuotes, new Map())
                    const valued = valueGatePass(viewRow.pass, quotation ? buildPriceIndex(quotation) : null)
                    return valued.lines.map((line, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5">
                          {line.item_name}
                          {line.specification ? <span className="text-gray-400"> · {line.specification}</span> : null}
                        </td>
                        <td className="px-2 py-1.5 text-right">{line.qty}</td>
                        <td className="px-2 py-1.5 text-right">{line.priced ? `LKR ${line.unit_price}` : <span className="text-[var(--warning-text)]">unpriced</span>}</td>
                        <td className="px-2 py-1.5 text-right font-medium">LKR {line.line_total.toLocaleString()}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold border-t pt-3 sm:justify-end">
              <span>Income: <span className="text-[var(--success-text)]">LKR {viewRow.income.toLocaleString()}</span></span>
              {viewRow.billedVia !== 'delivery' && (
                <>
                  <span>Billed: LKR {viewRow.billedAmount.toLocaleString()}</span>
                  <span className="text-[var(--success-text)]">Received: LKR {viewRow.paidAmount.toLocaleString()}</span>
                  {viewRow.outstanding > 0 && <span className="text-[var(--danger-text)]">Outstanding: LKR {viewRow.outstanding.toLocaleString()}</span>}
                </>
              )}
            </div>
            {viewRow.billIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {viewRow.billIds.map((id) => (
                  <Link key={id} to={`/bills/${id}`} className="rounded border px-2 py-1 text-[var(--brand-text)] hover:underline">
                    Bill {id.slice(0, 8)}…
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div></Portal>
      )}
    </div>
  )
}
