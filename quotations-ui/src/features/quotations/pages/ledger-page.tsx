import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, BookOpen, Scale, ArrowDownCircle, ArrowUpCircle, FileText } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard, StatCardSkeleton } from '../../../components/ui/stat-card'
import { FilterBar } from '../../../components/ui/filter-bar'
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
} from '../hooks/useGatepassIncome'
import { payments } from '../services/reports.service'
import type { Payment } from '../../../types/operations'

const PAGE_SIZE = 20

type LedgerKind = 'INCOME' | 'BILL' | 'PAYMENT'

interface LedgerEvent {
  id: string
  date: string
  order: number
  kind: LedgerKind
  client: string
  reference: string
  detail: string
  debit: number
  credit: number
  balance: number
  link?: string
}

const KIND_ORDER: Record<LedgerKind, number> = { INCOME: 0, BILL: 1, PAYMENT: 2 }

/**
 * Ledger: INCOME debits (gate-pass receiving value), BILL memos (billed-or-not,
 * never move the balance), PAYMENT credits. Balance = accrued - received.
 */
export default function LedgerPage() {
  const { hotel, isAllScope } = useHotelScope()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [client, setClient] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!isAllScope && hotel) setClient(hotel)
    if (isAllScope) setClient('')
  }, [hotel, isAllScope])

  useEffect(() => {
    setOffset(0)
  }, [from, to, client, search, hotel, isAllScope])

  const scopeClient = isAllScope ? undefined : hotel
  const { rows, bills, billsTotal, isLoading: incomeLoading, isError: incomeError, refetch: refetchIncome } =
    useGatepassIncome(scopeClient)

  // Cash received: one bulk request; per-bill fan-out only as fallback for
  // servers predating GET /bills/payments. A recorded-receipt top-up covers
  // paid_amount with no payment rows so the ledger agrees with bill totals.
  const paidBills = useMemo(
    () => bills.filter((b) => billPaid(b) > 0),
    [bills],
  )
  const billIdsKey = useMemo(() => paidBills.map((b) => b.id).sort().join(','), [paidBills])
  const scopedBillIds = useMemo(() => new Set(bills.map((b) => b.id)), [bills])
  const {
    data: bulkReceipts,
    isLoading: bulkLoading,
    isError: bulkFailed,
    refetch: refetchBulk,
  } = useQuery<Payment[]>({
    queryKey: ['bills', 'ledger-receipts', scopeClient ?? 'all'],
    queryFn: () =>
      payments.listAll({ client_name: scopeClient || undefined, limit: 5000 }),
    enabled: !incomeLoading,
    retry: false,
    staleTime: 180_000,
  })
  const {
    data: fanoutReceipts = {},
    isLoading: fanoutLoading,
    isError: fanoutError,
    refetch: refetchPays,
  } = useQuery<Record<string, Payment[]>>({
    queryKey: ['bills', 'ledger-payments', scopeClient ?? 'all', billIdsKey],
    queryFn: async () => {
      const entries = await Promise.all(
        paidBills.map(async (b) => {
          try {
            return [b.id, (await payments.listForBill(b.id)) ?? []] as const
          } catch {
            return [b.id, []] as const
          }
        }),
      )
      return Object.fromEntries(entries)
    },
    enabled: bulkFailed && !incomeLoading && paidBills.length > 0,
    staleTime: 60_000,
  })
  const paymentsByBill: Record<string, Payment[]> = useMemo(() => {
    if (!bulkFailed) {
      // Only receipts for bills in scope count — anyone else's money stays out.
      const map: Record<string, Payment[]> = {}
      for (const p of bulkReceipts ?? []) {
        if (!p.bill_id || !scopedBillIds.has(p.bill_id)) continue
        if (!map[p.bill_id]) map[p.bill_id] = []
        map[p.bill_id].push(p)
      }
      return map
    }
    return fanoutReceipts
  }, [bulkFailed, bulkReceipts, fanoutReceipts, scopedBillIds])
  const paysLoading = bulkLoading || (bulkFailed && fanoutLoading)
  const paysError = bulkFailed && fanoutError

  const clients = useMemo(
    () =>
      Array.from(new Set([...rows.map((r) => r.client), ...bills.map((b) => b.client_name)])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows, bills],
  )

  const allEvents: LedgerEvent[] = useMemo(() => {
    const events: LedgerEvent[] = []

    for (const row of rows) {
      if (row.income === 0 && row.receivedQty === 0 && row.billIds.length === 0) continue
      events.push({
        id: `income-${row.pass.id}`,
        date: row.date,
        order: KIND_ORDER.INCOME,
        kind: 'INCOME',
        client: row.client,
        reference: row.gpNumber,
        detail:
          `${row.receivedQty.toLocaleString()} pcs received` +
          (row.hasUnpriced ? ` · ${row.unpricedQty.toLocaleString()} unpriced` : '') +
          (row.billedStatus === 'UNBILLED' ? ' · unbilled' : ' · billed'),
        debit: row.income,
        credit: 0,
        balance: 0,
        link: `/gate-passes/${row.pass.id}`,
      })
    }

    for (const bill of bills) {
      const date = String(bill.created_at ?? '').slice(0, 10)
      const total = billTotal(bill)
      const paid = billPaid(bill)
      events.push({
        id: `bill-${bill.id}`,
        date,
        order: KIND_ORDER.BILL,
        kind: 'BILL',
        client: bill.client_name,
        reference: `Bill ${bill.id.slice(0, 8)}…`,
        detail:
          `billed LKR ${Math.round(total).toLocaleString()} · ${bill.payment_status}` +
          (paid > 0 ? ` · paid LKR ${Math.round(paid).toLocaleString()}` : ''),
        debit: 0,
        credit: 0,
        balance: 0,
        link: `/bills/${bill.id}`,
      })

      const records = paymentsByBill[bill.id] ?? []
      let recorded = 0
      for (const p of records) {
        recorded += Number(p.amount || 0)
        events.push({
          id: `pay-${p.id}`,
          date: String(p.payment_date || p.created_at || '').slice(0, 10),
          order: KIND_ORDER.PAYMENT,
          kind: 'PAYMENT',
          client: p.client_name || bill.client_name,
          reference: `${p.payment_method}${p.reference ? ` · ${p.reference}` : ''}`,
          detail: `bill ${bill.id.slice(0, 8)}…`,
          debit: 0,
          credit: Number(p.amount || 0),
          balance: 0,
          link: `/bills/${bill.id}`,
        })
      }
      // Instant-paid bills carry paid_amount with no payment rows.
      const topUp = Math.round((paid - recorded) * 100) / 100
      if (topUp > 0) {
        events.push({
          id: `receipt-${bill.id}`,
          date: String(bill.updated_at ?? bill.created_at ?? '').slice(0, 10),
          order: KIND_ORDER.PAYMENT,
          kind: 'PAYMENT',
          client: bill.client_name,
          reference: 'Receipt on bill',
          detail: `bill ${bill.id.slice(0, 8)}… · no payment record`,
          debit: 0,
          credit: topUp,
          balance: 0,
          link: `/bills/${bill.id}`,
        })
      }
    }

    return events
  }, [rows, bills, paymentsByBill])

  const clientEvents = useMemo(
    () => (client ? allEvents.filter((e) => e.client === client) : allEvents),
    [allEvents, client],
  )

  const openingBalance = useMemo(() => {
    if (!from) return 0
    return clientEvents
      .filter((e) => e.date < from)
      .reduce((s, e) => s + e.debit - e.credit, 0)
  }, [clientEvents, from])

  const periodEvents = useMemo(() => {
    const list = clientEvents.filter((e) => {
      if (from && e.date < from) return false
      if (to && e.date > to) return false
      return true
    })
    list.sort((a, b) =>
      a.date === b.date
        ? a.order - b.order || a.reference.localeCompare(b.reference)
        : a.date < b.date
          ? -1
          : 1,
    )
    let running = openingBalance
    for (const e of list) {
      running = Math.round((running + e.debit - e.credit) * 100) / 100
      e.balance = running
    }
    return list
  }, [clientEvents, from, to, openingBalance])

  const displayEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return periodEvents
    return periodEvents.filter((e) =>
      [e.client, e.reference, e.detail].some((v) => v.toLowerCase().includes(q)),
    )
  }, [periodEvents, search])

  const periodDebit = periodEvents.reduce((s, e) => s + e.debit, 0)
  const periodCredit = periodEvents.reduce((s, e) => s + e.credit, 0)
  const closingBalance = periodEvents.length ? periodEvents[periodEvents.length - 1].balance : openingBalance

  const billedOutstanding = useMemo(() => {
    const list = client ? bills.filter((b) => b.client_name === client) : bills
    return list.reduce((s, b) => s + billOutstanding(b), 0)
  }, [bills, client])

  const balancesByClient = useMemo(() => {
    const map = new Map<string, { accrued: number; billed: number; received: number; outstanding: number }>()
    for (const e of clientEvents) {
      if (!map.has(e.client)) map.set(e.client, { accrued: 0, billed: 0, received: 0, outstanding: 0 })
      const row = map.get(e.client)
      if (!row) continue
      row.accrued += e.debit
      row.received += e.credit
    }
    const scopedBills = client ? bills.filter((b) => b.client_name === client) : bills
    for (const b of scopedBills) {
      if (!map.has(b.client_name)) map.set(b.client_name, { accrued: 0, billed: 0, received: 0, outstanding: 0 })
      const row = map.get(b.client_name)
      if (!row) continue
      row.billed += billTotal(b)
      row.outstanding += billOutstanding(b)
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, owes: Math.round((v.accrued - v.received) * 100) / 100 }))
      .sort((a, b) => b.owes - a.owes)
  }, [clientEvents, bills, client])

  const pageEvents = displayEvents.slice(offset, offset + PAGE_SIZE)
  const isLoading = incomeLoading || paysLoading
  const isError = incomeError || paysError
  // Same stale-data tolerance as Income: a failed background refresh must
  // never wipe the cached ledger on a flapping connection.
  const hasData = allEvents.length > 0
  const showError = isError && !isLoading && !hasData
  const showStale = isError && !isLoading && hasData
  const retry = () => {
    refetchIncome()
    void refetchBulk()
    void refetchPays()
  }
  const truncated = billsTotal > bills.length

  const columns = [
    { key: 'date', header: 'Date', render: (e: LedgerEvent) => <span className="whitespace-nowrap">{e.date}</span> },
    {
      key: 'kind',
      header: 'Type',
      align: 'center' as const,
      render: (e: LedgerEvent) =>
        e.kind === 'INCOME' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--warning-text)]"><ArrowUpCircle size={13} /> Income</span>
        ) : e.kind === 'BILL' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700"><FileText size={13} /> Bill</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success-text)]"><ArrowDownCircle size={13} /> Received</span>
        ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (e: LedgerEvent) => <span className="font-medium">{e.client}</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (e: LedgerEvent) => (
        <span className={e.kind === 'BILL' ? 'text-gray-500' : undefined}>
          {e.link ? (
            <Link to={e.link} className="text-[var(--brand-text)] hover:underline">{e.reference}</Link>
          ) : (
            e.reference
          )}
          {e.detail ? <span className="text-gray-400"> · {e.detail}</span> : null}
        </span>
      ),
    },
    {
      key: 'debit',
      header: 'Debit (accrued)',
      align: 'right' as const,
      render: (e: LedgerEvent) => (e.debit ? `LKR ${Math.round(e.debit).toLocaleString()}` : '—'),
    },
    {
      key: 'credit',
      header: 'Credit (received)',
      align: 'right' as const,
      render: (e: LedgerEvent) =>
        e.credit ? <span className="text-[var(--success-text)]">LKR ${Math.round(e.credit).toLocaleString()}</span> : '—',
    },
    {
      key: 'balance',
      header: 'Owed',
      align: 'right' as const,
      render: (e: LedgerEvent) =>
        e.kind === 'BILL' ? (
          <span className="text-[var(--text-faint)]">—</span>
        ) : (
          <span className={`font-semibold ${e.balance > 0 ? 'text-[var(--danger-text)]' : 'text-[var(--text-secondary)]'}`}>
            LKR {Math.round(e.balance).toLocaleString()}
          </span>
        ),
    },
  ]

  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'kind', label: 'Type' },
    { key: 'client', label: 'Client' },
    { key: 'reference', label: 'Reference' },
    { key: 'detail', label: 'Detail' },
    { key: 'debit', label: 'Debit' },
    { key: 'credit', label: 'Credit' },
    { key: 'balance', label: 'Owed' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ledger"
        subtitle={`${client || 'All clients'} · opening LKR ${Math.round(openingBalance).toLocaleString()} → owes LKR ${Math.round(closingBalance).toLocaleString()} · ${displayEvents.length} entries`}
        actions={<ExportButton data={displayEvents} filename={`ledger-${client || 'all'}`} columns={exportCols} />}
      />

      {!showError && (isLoading ? (
        <StatCardSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 stagger">
          <StatCard label="Opening owed" value={`LKR ${Math.round(openingBalance).toLocaleString()}`} icon={<BookOpen size={20} />} color="gray" />
          <StatCard label="Accrued in period" value={`LKR ${Math.round(periodDebit).toLocaleString()}`} icon={<ArrowUpCircle size={20} />} color="amber" to="/income" />
          <StatCard label="Received in period" value={`LKR ${Math.round(periodCredit).toLocaleString()}`} icon={<ArrowDownCircle size={20} />} color="green" to="/bills" />
          <StatCard label="Owes now" value={`LKR ${Math.round(closingBalance).toLocaleString()}`} icon={<Scale size={20} />} tone="danger" />
          <StatCard label="Billed outstanding" value={`LKR ${Math.round(billedOutstanding).toLocaleString()}`} icon={<FileText size={20} />} color="blue" to="/statements" />
        </div>
      ))}

      {showStale && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          <span>Connection dropped — showing saved ledger. Balances refresh when the network is back.</span>
          <button type="button" onClick={retry} className="font-semibold underline underline-offset-2 hover:no-underline">
            Retry now
          </button>
        </div>
      )}

      <FilterBar>
        {isAllScope && (
          <select value={client} onChange={(e) => setClient(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, gate pass, bill, reference..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </FilterBar>

      {truncated && (
        <p className="text-xs text-amber-950 bg-amber-50 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-100 rounded-lg px-3 py-2">
          Showing {bills.length} of {billsTotal} bills — narrow the client or date range for a complete ledger.
        </p>
      )}

      {isLoading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : isError ? (
        <ErrorState
          title="Ledger could not be loaded"
          description="Income, bills or receipts did not load, so balances would be wrong. Check the connection and try again."
          onRetry={retry}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageEvents}
            emptyState={<EmptyState title="No ledger entries" description="No income, bills or receipts match your filters." />}
          />
          <Pagination total={displayEvents.length} limit={PAGE_SIZE} offset={offset} onChange={setOffset} className="px-1" />
        </>
      )}

      {showError ? null : balancesByClient.length > 1 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2.5 text-left">Client balance</th>
                <th className="px-3 py-2.5 text-right">Accrued</th>
                <th className="px-3 py-2.5 text-right">Billed</th>
                <th className="px-3 py-2.5 text-right">Received</th>
                <th className="px-3 py-2.5 text-right">Owes</th>
                <th className="px-3 py-2.5 text-right">Billed outstanding</th>
              </tr>
            </thead>
            <tbody>
              {balancesByClient.map((b) => (
                <tr key={b.name} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 font-medium">{b.name}</td>
                  <td className="px-3 py-2 text-right">LKR {Math.round(b.accrued).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">LKR {Math.round(b.billed).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[var(--success-text)]">LKR {Math.round(b.received).toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${b.owes > 0 ? 'text-[var(--danger-text)]' : ''}`}>
                    LKR {Math.round(b.owes).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">LKR {Math.round(b.outstanding).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
