import { useQuery } from '../api/hooks'
import { PageHeader, StateBox } from '../ui/kit'

interface StatementResponse {
  hotel: string
  year: number
  month: number
  opening_balance: number
  invoiced_amount: number
  paid_amount: number
  closing_balance: number
  currency: string
  period_start: string
  period_end: string
}

export function StatementsPage() {
  const { data, error, loading, reload } = useQuery<StatementResponse>('/client-portal/statements')

  return (
    <>
      <PageHeader
        title="Statements"
        subtitle={`Monthly statement for ${data?.year || new Date().getFullYear()}-${(data?.month || new Date().getMonth() + 1).toString().padStart(2, '0')}`}
      />

      <StateBox loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Opening Balance</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {data.currency} {data.opening_balance.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Invoiced</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {data.currency} {data.invoiced_amount.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Paid</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {data.currency} {data.paid_amount.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Closing Balance</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {data.currency} {data.closing_balance.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Statement Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Opening Balance</span>
                  <span className="font-medium text-slate-900">{data.currency} {data.opening_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Invoiced This Month</span>
                  <span className="font-medium text-slate-900">{data.currency} {data.invoiced_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Paid This Month</span>
                  <span className="font-medium text-slate-900">{data.currency} {data.paid_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 font-semibold">
                  <span className="text-slate-900">Closing Balance</span>
                  <span className="text-slate-900">{data.currency} {data.closing_balance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Period: {new Date(data.period_start).toLocaleDateString()} to {new Date(data.period_end).toLocaleDateString()}
            </p>
          </div>
        ) : null}
      </StateBox>
    </>
  )
}
