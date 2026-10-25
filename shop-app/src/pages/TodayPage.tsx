import { formatMoney, useQuery } from '../api/hooks'
import { PageHeader, Stat, StateBox } from '../ui/kit'

interface Summary {
  shop: string
  laundry_id: string
  open_bills: number
  outstanding_amount: number
  invoiced_this_month: number
  scanned?: string | null
  currency: string
}

export function TodayPage() {
  const { data, error, loading, reload } = useQuery<Summary>('/client-portal/shop/summary')

  return (
    <>
      <PageHeader
        title={data?.shop ?? 'Account'}
        subtitle="Your account with this laundry — only this laundry's records are visible"
      />

      <StateBox loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Open bills"
              value={String(data.open_bills ?? 0)}
              hint="Issued and not yet settled"
            />
            <Stat
              label="Balance"
              value={formatMoney(data.outstanding_amount)}
              hint="Outstanding across all bills"
            />
            <Stat
              label="Invoiced this month"
              value={formatMoney(data.invoiced_this_month)}
              hint="Excludes cancelled bills"
            />
          </div>
        ) : null}
      </StateBox>
    </>
  )
}
