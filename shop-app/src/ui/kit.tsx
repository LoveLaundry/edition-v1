import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  )
}

export function Stat({ label, value, hint, trend, color = 'default' }: { label: string; value: string; hint?: string; trend?: 'up' | 'down' | 'neutral'; color?: 'default' | 'success' | 'warning' | 'danger' }) {
  const colorClasses = {
    default: 'text-slate-900',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }
  const bgColors = {
    default: 'bg-white',
    success: 'bg-emerald-50',
    warning: 'bg-amber-50',
    danger: 'bg-red-50',
  }
  const trendIcons = {
    up: <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>,
    down: <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>,
    neutral: null,
  }

  return (
    <div className={`rounded-2xl border border-slate-200 ${bgColors[color]} p-5 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {trend && trendIcons[trend] ? <span className="flex-shrink-0">{trendIcons[trend]}</span> : null}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${colorClasses[color]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `rounded-2xl border border-slate-200 bg-white ${className}` : "rounded-2xl border border-slate-200 bg-white p-5"}>{children}</div>
}

export function StateBox({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean
  error: string | null
  empty?: boolean
  onRetry?: () => void
  children: ReactNode
}) {
  if (loading) {
    return (
      <Panel className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </Panel>
    )
  }
  if (error) {
    return (
      <Panel className="flex flex-col items-center justify-center py-12 text-center">
        <svg className="mb-3 h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm text-red-700">{error}</p>
        {onRetry ? (
          <Button onClick={onRetry} variant="secondary" size="sm" className="mt-3">
            Try again
          </Button>
        ) : null}
      </Panel>
    )
  }
  if (empty) {
    return (
      <EmptyState
        icon={
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        }
        title="Nothing here yet"
        description="No data available at this time"
      />
    )
  }
  return <>{children}</>
}

const STATUS_TONE: Record<string, string> = {
  RECEIVED: 'bg-sky-50 text-sky-700 border-sky-200',
  PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
  READY_FOR_DELIVERY: 'bg-violet-50 text-violet-700 border-violet-200',
  PARTIALLY_DELIVERED: 'bg-orange-50 text-orange-700 border-orange-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUED: 'bg-sky-50 text-sky-700 border-sky-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PARTIALLY_PAID: 'bg-orange-50 text-orange-700 border-orange-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  const value = (status ?? '').toUpperCase()
  const tone = STATUS_TONE[value] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {value.replaceAll('_', ' ') || '—'}
    </span>
  )
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-4 py-3 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }
  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} text-slate-600`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  ...props
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'variant' | 'size'>) {
  const variantClasses = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900',
    secondary: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 focus:ring-slate-900',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
    ghost: 'text-slate-700 hover:bg-slate-100 focus:ring-slate-900',
  }
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]}`}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
      {icon && <div className="mb-4 text-slate-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
