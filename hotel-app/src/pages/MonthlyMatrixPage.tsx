import { useQuery } from '../api/hooks'
import { PageHeader, StateBox } from '../ui/kit'

interface MonthlyMatrixResponse {
  hotel: string
  year: number
  month: number
  matrix: Record<string, Record<string, number>>
  period_start: string
  period_end: string
}

export function MonthlyMatrixPage() {
  const { data, error, loading, reload } = useQuery<MonthlyMatrixResponse>('/client-portal/monthly')

  return (
    <>
      <PageHeader
        title="Monthly Matrix"
        subtitle={`Piece counts by day for ${data?.year || new Date().getFullYear()}-${(data?.month || new Date().getMonth() + 1).toString().padStart(2, '0')}`}
      />

      <StateBox loading={loading} error={error} onRetry={reload}>
        {data && data.matrix ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Item</th>
                    {Object.keys(data.matrix[""] || {}).map(day => (
                      <th key={day} className="px-4 py-3 text-center font-semibold text-slate-700 w-12">
                        {day}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.matrix).map(([itemName, dayData]) => (
                    <tr key={itemName} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{itemName}</td>
                      {Object.entries(dayData).map(([day, qty]) => (
                        <td key={day} className="px-4 py-3 text-center text-slate-600">
                          {qty > 0 ? qty : '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {Object.values(dayData).reduce((sum, qty) => sum + qty, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
