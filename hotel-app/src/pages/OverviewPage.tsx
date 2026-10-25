import { formatMoney, useQuery } from '../api/hooks'
import { PageHeader, Stat, StateBox } from '../ui/kit'

interface Summary {
  hotel: string
  laundry_id: string
  open_gate_passes: number
  deliveries_this_month: number
  outstanding_amount: number
  invoiced_this_month: number
  currency: string
  totals_truncated: boolean
}

export function OverviewPage() {
  const { data, error, loading, reload } = useQuery<Summary>('/client-portal/summary')

  return (
    <>
      <PageHeader
        title={data?.hotel ?? 'Overview'}
        subtitle="This month with your laundry provider"
      />

      <StateBox loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Open gate passes" value={String(data.open_gate_passes)} hint="Still at the laundry" />
            <Stat label="Deliveries this month" value={String(data.deliveries_this_month)} />
            <Stat
              label="Outstanding"
              value={formatMoney(data.outstanding_amount, data.currency)}
              hint="Unpaid invoices"
            />
            <Stat
              label="Invoiced this month"
              value={formatMoney(data.invoiced_this_month, data.currency)}
              hint={data.totals_truncated ? 'Partial total — older history not counted' : undefined}
            />
          </div>
        ) : null}
      </StateBox>

      <p className="mt-6 max-w-prose text-sm text-slate-500">
        Every figure on this page is computed by your provider&apos;s billing service from the
        records it holds. Nothing here is added up in the browser, so this screen and your
        paper statement always agree.
      </p>
    </>
  )
}
