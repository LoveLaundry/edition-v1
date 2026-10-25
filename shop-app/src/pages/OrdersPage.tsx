import { Link } from 'react-router-dom'
import { formatDate, useQuery } from '../api/hooks'
import { PageHeader, StateBox, StatusChip, Table } from '../ui/kit'

interface ShopOrder {
  id: string
  gate_pass_number: string
  status: string
  receiving_date: string | null
  line_count: number
  pieces: number
  received_pieces: number
}

interface Response {
  total: number
  items: ShopOrder[]
}

export function OrdersPage() {
  const { data, error, loading, reload } = useQuery<Response>('/client-portal/shop/orders')

  return (
    <>
      <PageHeader title="Orders" subtitle="What you sent, and what the laundry has counted in" />

      <div className="mb-4">
        <Link
          to="/orders/new"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New order
        </Link>
      </div>

      <StateBox
        loading={loading}
        error={error}
        empty={!loading && !error && (data?.items.length ?? 0) === 0}
        onRetry={reload}
      >
        <Table head={['Order', 'Raised', 'Items', 'Sent', 'Received', 'Status']}>
          {(data?.items ?? []).map((order) => (
            <tr key={order.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{order.gate_pass_number}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(order.receiving_date)}</td>
              <td className="px-4 py-3 tabular-nums">{order.line_count}</td>
              <td className="px-4 py-3 tabular-nums">{order.pieces}</td>
              {/* Zero until the laundry counts the delivery — that gap is what
                  the shop is waiting on, so it is shown per row. */}
              <td className="px-4 py-3 tabular-nums">
                {order.status === 'DRAFT' ? '—' : order.received_pieces}
              </td>
              <td className="px-4 py-3">
                <StatusChip status={order.status} />
              </td>
            </tr>
          ))}
        </Table>
        {data ? (
          <p className="mt-3 text-xs text-slate-500">
            Showing {data.items.length} of {data.total} orders.
          </p>
        ) : null}
      </StateBox>
    </>
  )
}
