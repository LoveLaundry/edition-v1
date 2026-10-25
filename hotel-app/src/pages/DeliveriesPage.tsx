import { formatDate, pieces, useQuery } from '../api/hooks'
import { PageHeader, StateBox, StatusChip, Table } from '../ui/kit'

interface Delivery {
  id: string
  delivery_date: string
  delivered_by: string
  received_by: string
  status: string
  items: unknown[]
  corrections: unknown[]
}

interface Response {
  total: number
  items: Delivery[]
}

export function DeliveriesPage() {
  const { data, error, loading, reload } = useQuery<Response>('/client-portal/deliveries')

  return (
    <>
      <PageHeader
        title="Deliveries"
        subtitle="What came back, and whether anything was short"
      />

      <StateBox loading={loading} error={error} empty={data?.items.length === 0} onRetry={reload}>
        <Table head={['Delivered', 'Pieces', 'Handed over by', 'Signed for by', 'Corrections', 'Status']}>
          {(data?.items ?? []).map((delivery) => (
            <tr key={delivery.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{formatDate(delivery.delivery_date)}</td>
              <td className="px-4 py-3 tabular-nums">{pieces(delivery.items)}</td>
              <td className="px-4 py-3 text-slate-600">{delivery.delivered_by || '—'}</td>
              <td className="px-4 py-3 text-slate-600">{delivery.received_by || '—'}</td>
              <td className="px-4 py-3 tabular-nums">
                {delivery.corrections.length > 0 ? (
                  <span className="font-semibold text-amber-700">{delivery.corrections.length}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusChip status={delivery.status} />
              </td>
            </tr>
          ))}
        </Table>
        {data ? (
          <p className="mt-3 text-xs text-slate-500">
            Showing {data.items.length} of {data.total} deliveries.
          </p>
        ) : null}
      </StateBox>
    </>
  )
}
