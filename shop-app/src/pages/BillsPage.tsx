import { useState } from 'react'
import { dataApi, errorMessage } from '../api/client'
import { formatDate, formatMoney, useQuery } from '../api/hooks'
import { PageHeader, Panel, StateBox, StatusChip, Table } from '../ui/kit'

interface ShopBill {
  id: string
  bill_number: string | null
  created_at: string | null
  delivery_date: string | null
  grand_total: number
  paid_amount: number
  balance: number
  payment_status: string
  status: string
  total_quantity?: number
}

interface BillLine {
  item_name?: string
  quantity?: number
  unit_price?: number
  amount?: number
}

interface BillDetail extends ShopBill {
  items?: BillLine[]
  notes?: string | null
}

interface Response {
  total: number
  items: ShopBill[]
}

const PAGE_SIZE = 25

export function BillsPage() {
  const [skip, setSkip] = useState(0)
  const [detail, setDetail] = useState<BillDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const { data, error, loading, reload } = useQuery<Response>('/client-portal/shop/bills', {
    skip,
    limit: PAGE_SIZE,
  })

  async function open(bill: ShopBill) {
    setDetailError(null)
    try {
      const { data: full } = await dataApi.get<BillDetail>(`/client-portal/shop/bills/${bill.id}`)
      setDetail(full)
    } catch (caught) {
      setDetail(null)
      setDetailError(errorMessage(caught))
    }
  }

  const total = data?.total ?? 0

  return (
    <>
      <PageHeader title="Bills" subtitle="Invoices raised by the laundry for this shop" />

      <StateBox
        loading={loading}
        error={error}
        empty={!loading && !error && (data?.items.length ?? 0) === 0}
        onRetry={reload}
      >
        <Table head={['Bill', 'Raised', 'Total', 'Paid', 'Balance', 'Status', '']}>
          {(data?.items ?? []).map((bill) => (
            <tr key={bill.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{bill.bill_number ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(bill.created_at)}</td>
              <td className="px-4 py-3 tabular-nums">{formatMoney(bill.grand_total)}</td>
              <td className="px-4 py-3 tabular-nums">{formatMoney(bill.paid_amount)}</td>
              <td className="px-4 py-3 tabular-nums">{formatMoney(bill.balance)}</td>
              <td className="px-4 py-3">
                <StatusChip status={bill.payment_status} />
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => void open(bill)}
                  className="text-sm font-medium text-slate-700 underline"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </StateBox>

      {detailError ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {detailError}
        </p>
      ) : null}

      {detail ? (
        <Panel className="mt-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Bill</p>
              <p className="text-lg font-semibold text-slate-900">{detail.bill_number ?? '—'}</p>
            </div>
            <button onClick={() => setDetail(null)} className="text-sm text-slate-500 underline">
              Close
            </button>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Total</p>
              <p className="font-medium">{formatMoney(detail.grand_total)}</p>
            </div>
            <div>
              <p className="text-slate-500">Paid</p>
              <p className="font-medium">{formatMoney(detail.paid_amount)}</p>
            </div>
            <div>
              <p className="text-slate-500">Balance</p>
              <p className="font-medium">{formatMoney(detail.balance)}</p>
            </div>
          </div>

          {(detail.items?.length ?? 0) > 0 ? (
            <Table head={['Item', 'Qty', 'Unit price', 'Amount']}>
              {(detail.items ?? []).map((line, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">{line.item_name ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{line.quantity ?? ''}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {line.unit_price === undefined ? '—' : formatMoney(line.unit_price)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {line.amount === undefined ? '—' : formatMoney(line.amount)}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-slate-500">No line items recorded on this bill.</p>
          )}

          {detail.notes ? <p className="mt-3 text-sm text-slate-600">{detail.notes}</p> : null}
        </Panel>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} bill{total === 1 ? '' : 's'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
            disabled={skip === 0}
            className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setSkip((s) => s + PAGE_SIZE)}
            disabled={skip + PAGE_SIZE >= total}
            className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </>
  )
}
