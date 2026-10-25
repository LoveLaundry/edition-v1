import { formatDate, pieces, useQuery } from '../api/hooks'
import { PageHeader, StateBox, StatusChip, Table } from '../ui/kit'

interface GatePass {
  id: string
  gate_pass_number: string
  receiving_date: string
  received_by: string
  status: string
  items: unknown[]
}

interface Response {
  total: number
  items: GatePass[]
}

export function GatePassesPage() {
  const { data, error, loading, reload } = useQuery<Response>('/client-portal/gate-passes')

  return (
    <>
      <PageHeader
        title="Gate passes"
        subtitle="Every collection taken from your property, newest first"
      />

      <StateBox loading={loading} error={error} empty={data?.items.length === 0} onRetry={reload}>
        <Table head={['Gate pass', 'Received', 'Collected by', 'Pieces', 'Status']}>
          {(data?.items ?? []).map((pass) => (
            <tr key={pass.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">{pass.gate_pass_number}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(pass.receiving_date)}</td>
              <td className="px-4 py-3 text-slate-600">{pass.received_by || '—'}</td>
              <td className="px-4 py-3 tabular-nums">{pieces(pass.items)}</td>
              <td className="px-4 py-3">
                <StatusChip status={pass.status} />
              </td>
            </tr>
          ))}
        </Table>
        {data ? (
          <p className="mt-3 text-xs text-slate-500">
            Showing {data.items.length} of {data.total} gate passes.
          </p>
        ) : null}
      </StateBox>
    </>
  )
}
