import { Fragment, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companySettingsApi } from '../api/management-api'
import { toast } from 'sonner'
import { Activity, AlertCircle, Minus, Pencil, Plus, Save, Settings, Trash2, TrendingDown, TrendingUp, X, Zap } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { invalidateResource } from '../../../cache/invalidation'
import { useAuth } from '../../../context/AuthContext'
import { formatTimestamp, fromSriLankaDateTimeInput, toSriLankaDateTimeInput } from '../../../lib/time'
import { Portal } from '../../../components/ui/portal'

// Order follows JS Date.getDay(): 0=Sunday ... 6=Saturday.
const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Backend uses Python weekday(): 0=Monday ... 6=Sunday.
const pyToJs = (py: number) => (py + 1) % 7
const jsToPy = (js: number) => (js + 6) % 7
const formatLkr = (value: number) =>
  `LKR ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatKwh = (value: number) =>
  `${Number(value).toLocaleString('en-LK', { maximumFractionDigits: 1 })} kWh`

const USAGE_RANGES = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' },
] as const

function TrendBadge({ trend }: { trend?: any }) {
  if (!trend) return <span className="text-xs text-gray-400">—</span>
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus
  const color = trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 ${color}`}>
      <Icon size={14} />
      <span className="font-semibold">
        {trend.direction === 'up' ? '+' : trend.kwh_per_day > 0 ? '+' : ''}
        {Number(trend.kwh_per_day).toLocaleString('en-LK', { maximumFractionDigits: 1 })} kWh/day
      </span>
      <span className="text-gray-400 font-normal">r² {Number(trend.r_squared).toFixed(2)}</span>
    </span>
  )
}

function UsageCard({ meter, name }: { meter?: any; name: string }) {
  const hasData = meter && meter.measured_days > 0
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium truncate">{name}</h4>
        {meter?.reset_detected && (
          <span className="shrink-0 text-[11px] text-amber-700" title="A reading was lower than its previous reading">reset detected</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500">Total usage</p>
          <p className="font-semibold">{hasData ? formatKwh(meter.total_usage_kwh) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Daily average</p>
          <p className="font-semibold">{hasData ? formatKwh(meter.avg_daily_kwh) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Peak day</p>
          <p className="font-semibold">
            {hasData ? (
              <>
                {meter.peak_day.date}
                <span className="ml-1 text-gray-500 font-normal">{formatKwh(meter.peak_day.kwh)}</span>
              </>
            ) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Trend (slope)</p>
          <TrendBadge trend={meter?.trend} />
        </div>
      </div>
      <p className="text-xs text-gray-400">
        {hasData
          ? meter.latest_reading_kwh != null
            ? `${meter.measured_days} days with data · last reading ${formatKwh(meter.latest_reading_kwh)} on ${meter.latest_reading_date}`
            : `${meter.measured_days} days with data`
          : meter?.readings
            ? `${meter.readings} reading${meter.readings === 1 ? '' : 's'} recorded — add one more to see usage`
            : 'No readings recorded yet'}
      </p>
      {meter?.warnings?.length > 0 && (
        <ul className="space-y-1">
          {meter.warnings.map((warning: string, index: number) => (
            <li key={index} className="text-xs text-amber-700">{warning}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SlabBreakdown({ cost, name }: { cost?: any; name: string }) {
  if (!cost) return null
  return (
    <div className="rounded-md border p-3 bg-gray-50 dark:bg-gray-900/40">
      <p className="text-xs font-semibold mb-2">{name} — {formatKwh(cost.units)}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 pr-2 font-medium">Units block</th>
            <th className="py-1 pr-2 font-medium">Rate</th>
            <th className="py-1 pr-2 font-medium text-right">Units</th>
            <th className="py-1 font-medium text-right">Charge</th>
          </tr>
        </thead>
        <tbody>
          {(cost.breakdown || []).map((row: any, index: number) => (
            <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
              <td className="py-1 pr-2">
                {Number(row.from_units).toLocaleString()}–{row.up_to == null ? '∞' : Number(row.up_to).toLocaleString()}
                {index === cost.applied_slab && (
                  <span className="ml-1 text-[10px] text-amber-700">(fixed applies)</span>
                )}
              </td>
              <td className="py-1 pr-2">{Number(row.rate_lkr).toLocaleString()} LKR</td>
              <td className="py-1 pr-2 text-right">{Number(row.units).toLocaleString()}</td>
              <td className="py-1 text-right">{formatLkr(row.charge_lkr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 space-y-0.5 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Energy charge</span><span>{formatLkr(cost.energy_lkr)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Fixed charge (stepped)</span><span>{formatLkr(cost.fixed_charge_lkr)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Tax ({(Number(cost.tax_rate) * 100).toLocaleString()}%)</span><span>{formatLkr(cost.amount_lkr - cost.subtotal_lkr)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{formatLkr(cost.amount_lkr)}</span></div>
      </div>
    </div>
  )
}

function ProjectionCard({ entry, past }: { entry?: any; past: boolean }) {
  if (!entry) return null
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h4 className="font-medium truncate">{entry.name}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500">Units so far</p>
          <p className="font-semibold">{formatKwh(entry.units_so_far)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Daily pace</p>
          <p className="font-semibold">{formatKwh(entry.run_rate_kwh_per_day)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{past ? 'Billed units' : 'Projected units'}</p>
          <p className="font-semibold text-[#B91C1C]">{formatKwh(entry.projected_units)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Trend</p>
          <TrendBadge trend={entry.trend} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t pt-3">
        <div>
          <p className="text-xs text-gray-500">Cost so far</p>
          <p className="font-semibold">
            {entry.cost_so_far ? formatLkr(entry.cost_so_far.amount_lkr) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{past ? 'Billed cost' : 'Projected cost'}</p>
          <p className="font-semibold text-[#B91C1C]">
            {entry.projected_cost ? formatLkr(entry.projected_cost.amount_lkr) : '—'}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        {entry.method_label} · {formatKwh(entry.pace_kwh_per_day)}/day pace
        {entry.method_note ? ` · ${entry.method_note}` : ''}
        {entry.last_reading_date ? ` · last reading ${entry.last_reading_date}` : ' · no readings yet'}
      </p>
    </div>
  )
}

export default function CompanySettingsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const _role = user?.role_id?.toUpperCase()
  const isAdmin = _role === 'ADMIN' || _role === 'PLATFORM_ADMIN'
  const [form, setForm] = useState<any>(null)
  const [readingAt, setReadingAt] = useState(() => toSriLankaDateTimeInput())
  const [readingValues, setReadingValues] = useState<Record<string, string>>({
    meter_1: '',
    meter_2: '',
  })
  const [usageRange, setUsageRange] = useState<string>('30')
  const [editReading, setEditReading] = useState<any | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companySettingsApi.get().then(r => r.data),
  })

  useEffect(() => {
    if (settings && !form) {
      setForm({
        company_name: settings.company_name || 'Love Laundry',
        salary_basis_days: settings.salary_basis_days ?? 30,
        working_days_per_week: settings.working_days_per_week ?? 6,
        working_days_pattern: (settings.working_days_pattern || [0, 1, 2, 3, 4, 5]).map(pyToJs),
        default_overtime_rate: settings.default_overtime_rate ?? 0,
        electricity_meter_1_name: settings.electricity_meter_1_name || 'Chilaw Connection Line',
        electricity_meter_2_name: settings.electricity_meter_2_name || 'Madampe Connection Line',
        electricity_unit_slabs: settings.electricity_unit_slabs || [],
        electricity_tax_rate: settings.electricity_tax_rate ?? 0,
        electricity_billing_cycle_start_day: settings.electricity_billing_cycle_start_day ?? 1,
      })
    }
  }, [settings, form])

  const saveMut = useMutation({
    mutationFn: (data: any) => companySettingsApi.update(data),
    onSuccess: () => {
      toast.success('Company settings saved')
      invalidateResource(qc, 'settings')
      qc.invalidateQueries({ queryKey: ['electricity-meter-analytics'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-usage'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-projection'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save settings'),
  })

  const {
    data: meterReadings = [],
    isLoading: readingsLoading,
    isError: readingsError,
    refetch: refetchReadings,
  } = useQuery({
    queryKey: ['electricity-meter-readings'],
    queryFn: () => companySettingsApi.meterReadings().then(r => r.data),
  })

  const {
    data: meterAnalytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['electricity-meter-analytics'],
    queryFn: () => companySettingsApi.meterAnalytics().then(r => r.data),
  })

  const {
    data: meterUsage,
    isLoading: usageLoading,
    isError: usageError,
    refetch: refetchUsage,
  } = useQuery({
    queryKey: ['electricity-meter-usage'],
    queryFn: () => companySettingsApi.meterUsage().then(r => r.data),
  })

  const [projStart, setProjStart] = useState('')
  const [projEnd, setProjEnd] = useState('')
  const [projMeter, setProjMeter] = useState<'meter_1' | 'meter_2' | 'combined'>('combined')
  const [projMethod, setProjMethod] = useState('')
  const [formulaDraft, setFormulaDraft] = useState('')
  const [formulaApplied, setFormulaApplied] = useState<string | null>(null)
  const projBothSet = Boolean(projStart && projEnd)
  const {
    data: meterProjection,
    isLoading: projectionLoading,
    isError: projectionError,
    error: projectionErr,
    refetch: refetchProjection,
  } = useQuery({
    queryKey: ['electricity-meter-projection', projBothSet ? projStart : 'current', projBothSet ? projEnd : 'current', projMethod || 'saved', formulaApplied || 'stored'],
    queryFn: () => companySettingsApi.projection(
      projBothSet ? projStart : undefined,
      projBothSet ? projEnd : undefined,
      projMethod || undefined,
      projMethod === 'custom' && formulaApplied ? formulaApplied : undefined,
    ).then(r => r.data),
  })
  const effectiveMethod = projMethod || meterProjection?.method || 'linear_trend'
  const fmtDay = (iso?: string | null) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'
  const periodLabel = (start?: string | null, end?: string | null, fallback?: string) =>
    start && end ? `${fmtDay(start)} – ${fmtDay(end)}` : (fallback || '—')

  const addReadingMut = useMutation({
    mutationFn: (data: {
      meter_id: 'meter_1' | 'meter_2'
      reading_value: number
      recorded_at: string
    }) => companySettingsApi.addMeterReading(data),
    onSuccess: (_response, variables) => {
      toast.success('Electricity reading saved')
      setReadingValues(current => ({ ...current, [variables.meter_id]: '' }))
      qc.invalidateQueries({ queryKey: ['electricity-meter-readings'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-analytics'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-usage'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-projection'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save electricity reading'),
  })

  const updateReadingMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { reading_value: number; reason: string } }) =>
      companySettingsApi.updateMeterReading(id, data),
    onSuccess: () => {
      toast.success('Reading corrected — reason recorded')
      setEditReading(null)
      setEditValue('')
      setEditReason('')
      qc.invalidateQueries({ queryKey: ['electricity-meter-readings'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-analytics'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-usage'] })
      qc.invalidateQueries({ queryKey: ['electricity-meter-projection'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to correct the reading'),
  })

  const openEdit = (reading: any) => {
    setEditReading(reading)
    setEditValue(String(Number(reading.reading_value) || ''))
    setEditReason('')
  }

  const toggleDow = (i: number) => {
    if (!form) return
    const pattern = form.working_days_pattern.includes(i)
      ? form.working_days_pattern.filter((x: number) => x !== i)
      : [...form.working_days_pattern, i].sort((a: number, b: number) => a - b)
    setForm({ ...form, working_days_pattern: pattern, working_days_per_week: pattern.length })
  }

  const updateSlab = (index: number, field: 'up_to' | 'rate_lkr' | 'fixed_charge_lkr', value: string) => {
    const slabs = [...(form.electricity_unit_slabs || [])]
    slabs[index] = { ...slabs[index], [field]: value === '' ? null : Number(value) }
    setForm({ ...form, electricity_unit_slabs: slabs })
  }

  const addSlab = () => {
    setForm({
      ...form,
      electricity_unit_slabs: [
        ...(form.electricity_unit_slabs || []),
        { up_to: null, rate_lkr: 0, fixed_charge_lkr: 0 },
      ],
    })
  }

  const removeSlab = (index: number) => {
    setForm({
      ...form,
      electricity_unit_slabs: (form.electricity_unit_slabs || []).filter((_: any, i: number) => i !== index),
    })
  }

  const normalizeSlabsForSave = (): any[] | null => {
    const slabs = form.electricity_unit_slabs || []
    if (slabs.length === 0) return []
    let prevTop: number | null = null
    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i]
      const last = i === slabs.length - 1
      const rate = Number(slab.rate_lkr)
      const fixed = Number(slab.fixed_charge_lkr)
      if (slab.rate_lkr === null || slab.rate_lkr === '' || Number.isNaN(rate) || rate < 0) {
        toast.error(`Slab ${i + 1}: enter a rate of 0 or more`)
        return null
      }
      if (slab.fixed_charge_lkr === null || slab.fixed_charge_lkr === '' || Number.isNaN(fixed) || fixed < 0) {
        toast.error(`Slab ${i + 1}: enter a fixed charge of 0 or more`)
        return null
      }
      if (slab.up_to === null || slab.up_to === '') {
        if (!last) {
          toast.error(`Slab ${i + 1}: only the last slab may have no upper limit`)
          return null
        }
      } else {
        const top = Number(slab.up_to)
        if (Number.isNaN(top) || top <= 0) {
          toast.error(`Slab ${i + 1}: upper limit must be greater than 0`)
          return null
        }
        if (prevTop !== null && top <= prevTop) {
          toast.error('Slab limits must increase from the first row to the last')
          return null
        }
        prevTop = top
      }
    }
    return slabs.map((slab: any) => ({
      up_to: slab.up_to === null || slab.up_to === '' ? null : Number(slab.up_to),
      rate_lkr: Number(slab.rate_lkr),
      fixed_charge_lkr: Number(slab.fixed_charge_lkr),
    }))
  }

  const handleSave = () => {
    const slabs = isAdmin ? normalizeSlabsForSave() : []
    if (isAdmin && !slabs) return
    const data = {
      ...form,
      working_days_pattern: (form.working_days_pattern || []).map(jsToPy),
      electricity_unit_slabs: slabs,
    }
    if (!isAdmin) {
      delete data.electricity_meter_1_name
      delete data.electricity_meter_2_name
      delete data.electricity_unit_slabs
      delete data.electricity_tax_rate
      delete data.electricity_billing_cycle_start_day
      delete data.electricity_projection_method
      delete data.electricity_projection_formula
    }
    saveMut.mutate(data)
  }
  const meterNamesSaved =
    !!form &&
    !!settings &&
    form.electricity_meter_1_name === (settings.electricity_meter_1_name || 'Meter 1') &&
    form.electricity_meter_2_name === (settings.electricity_meter_2_name || 'Meter 2')
  const readingChartData = (meterAnalytics?.readings || []).map((reading: any) => ({
    recorded_at: reading.recorded_at,
    meter_1: reading.meter_id === 'meter_1' ? Number(reading.reading_value) : null,
    meter_2: reading.meter_id === 'meter_2' ? Number(reading.reading_value) : null,
  }))
  const monthlyAnalytics = meterAnalytics?.months || []
  const monthlyLabeled = monthlyAnalytics.map((month: any) => ({
    ...month,
    period: periodLabel(month.period_start, month.period_end, month.month),
  }))
  const projChartEntry =
    meterProjection?.is_current && meterProjection?.has_data && meterProjection?.combined?.projected_cost_lkr != null
      ? [{
        period: `${periodLabel(meterProjection.period_start, meterProjection.period_end)} (proj.)`,
        meter_1_amount_lkr: meterProjection.meters?.meter_1?.projected_cost?.amount_lkr ?? null,
        meter_2_amount_lkr: meterProjection.meters?.meter_2?.projected_cost?.amount_lkr ?? null,
        amount_lkr: meterProjection.combined.projected_cost_lkr,
        projected: true,
      }]
      : []
  const costChartData = [...monthlyLabeled, ...projChartEntry]
  const projSource = projMeter === 'combined' ? meterProjection?.combined : meterProjection?.meters?.[projMeter]
  const projColor = projMeter === 'meter_1' ? '#2563eb' : projMeter === 'meter_2' ? '#dc2626' : '#16a34a'
  const projChartData = (projSource?.series || []).map((day: any) => ({
    date: fmtDay(day.date),
    actual: day.actual,
    forecast: day.forecast,
    trend: day.trend,
  }))
  const projShowTrend = (projSource?.series || []).some((day: any) => day.trend != null)
  const projAvg = projMeter === 'combined'
    ? (meterProjection?.measured_days ? (meterProjection.combined?.units_so_far ?? 0) / meterProjection.measured_days : 0)
    : (projSource?.run_rate_kwh_per_day ?? 0)
  const usageDays = meterUsage?.days || []
  const usageRows = usageRange === 'all'
    ? usageDays
    : usageDays.slice(-Math.max(0, Math.min(Number(usageRange), usageDays.length)))
  const usageMeters = meterUsage?.meters || {}
  const usageCombined = meterUsage?.combined || {}

  if (isLoading || !form || !settings) {
    return <div className="text-center py-12 text-gray-400">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company Settings</h1>
        <button
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
        >
          <Save size={16} /> {saveMut.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap size={20} /> Electricity Meter Readings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Record each meter reading with Sri Lanka date and time (LKT). Readings are retained for future electricity-cost calculations.
          </p>
        </div>

        {isAdmin ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['electricity_meter_1_name', 'electricity_meter_2_name'] as const).map((key, index) => (
                <label key={key} className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Meter {index + 1} name
                  <input
                    value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    maxLength={60}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                </label>
              ))}
            </div>

            <div className="border-t pt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Unit slab tariff</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Sri Lanka style unit breakdown, applied to each meter separately. Each unit block is charged at its
                    slab rate, and the fixed charge of the slab the month&apos;s total units fall into is added on top.
                    Save with the main Save button.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSlab}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs font-medium cursor-pointer"
                >
                  <Plus size={14} /> Add slab
                </button>
              </div>
              {(form.electricity_unit_slabs || []).length === 0 ? (
                <p className="text-sm text-gray-500 py-2">
                  No tariff slabs configured yet — add rows for your unit blocks (e.g. 0–30, 31–60, …).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-3 font-medium">Slab</th>
                        <th className="py-2 pr-3 font-medium">Up to (units)</th>
                        <th className="py-2 pr-3 font-medium">Rate (LKR/unit)</th>
                        <th className="py-2 pr-3 font-medium">Fixed charge (LKR)</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(form.electricity_unit_slabs || []).map((slab: any, index: number, all: any[]) => {
                        const last = index === all.length - 1
                        const prevTop = index === 0 ? 0 : all[index - 1].up_to
                        return (
                          <tr key={index} className="border-b last:border-0">
                            <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                              {index === 0 ? '0' : Number(prevTop).toLocaleString()}–{slab.up_to === null || slab.up_to === '' ? '∞' : Number(slab.up_to).toLocaleString()}
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={slab.up_to ?? ''}
                                onChange={e => updateSlab(index, 'up_to', e.target.value)}
                                placeholder={last ? `No limit (above ${index === 0 ? 0 : Number(prevTop).toLocaleString()})` : 'e.g. 30'}
                                className="w-full px-3 py-1.5 border rounded-lg text-sm"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={slab.rate_lkr ?? ''}
                                onChange={e => updateSlab(index, 'rate_lkr', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-1.5 border rounded-lg text-sm"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={slab.fixed_charge_lkr ?? ''}
                                onChange={e => updateSlab(index, 'fixed_charge_lkr', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-1.5 border rounded-lg text-sm"
                              />
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => removeSlab(index)}
                                className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer"
                                aria-label={`Remove slab ${index + 1}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-gray-500">
                Leave the last row&apos;s “Up to” empty for the top slab (no upper limit). Only the last row may be left empty.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Tax rate (fraction; 0.18 = 18%)
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.001"
                    value={form.electricity_tax_rate}
                    onChange={e => setForm({ ...form, electricity_tax_rate: Number(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Billing month starts on day
                  <input
                    type="number"
                    min="1"
                    max="28"
                    step="1"
                    value={form.electricity_billing_cycle_start_day ?? 1}
                    onChange={e => {
                      const day = Math.round(Number(e.target.value) || 1)
                      setForm({ ...form, electricity_billing_cycle_start_day: Math.min(28, Math.max(1, day)) })
                    }}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <span className="block text-xs text-gray-400 mt-1">1 = calendar months. E.g. 15 means billing months run 15th–14th.</span>
                </label>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Only admins can configure meters, tariff slabs, or tax, or submit readings.
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Meter readings are visible here. An admin must add or configure readings.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['meter_1', 'meter_2'] as const).map((meterId, index) => {
            const name = form[index === 0 ? 'electricity_meter_1_name' : 'electricity_meter_2_name']
            return (
              <form
                key={meterId}
                onSubmit={e => {
                  e.preventDefault()
                  if (!isAdmin) return
                  const value = Number(readingValues[meterId])
                  if (!Number.isFinite(value) || value < 0) {
                    toast.error('Enter a valid non-negative meter reading')
                    return
                  }
                  try {
                    if (!readingAt) {
                      toast.error('Enter a Sri Lanka date and time')
                      return
                    }
                    addReadingMut.mutate({
                      meter_id: meterId,
                      reading_value: value,
                      recorded_at: fromSriLankaDateTimeInput(readingAt),
                    })
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Enter a valid date and time')
                  }
                }}
                className="rounded-lg border p-4 space-y-3"
              >
                <h3 className="font-medium">{name || `Meter ${index + 1}`}</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    disabled={!isAdmin}
                    value={readingValues[meterId]}
                    onChange={e => setReadingValues(current => ({ ...current, [meterId]: e.target.value }))}
                    placeholder="Meter reading"
                    aria-label={`${name || `Meter ${index + 1}`} reading`}
                    className="min-w-0 flex-1 px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700"
                  />
                  <button
                    type="submit"
                    disabled={!isAdmin || addReadingMut.isPending || !meterNamesSaved}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {!isAdmin ? 'Admin required' : addReadingMut.isPending ? 'Saving…' : 'Save reading'}
                  </button>
                </div>
              </form>
            )
          })}
        </div>

        {isAdmin && (
          <>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
              Reading date and time (Sri Lanka)
              <input
                type="datetime-local"
                value={readingAt}
                onChange={e => setReadingAt(e.target.value)}
                className="block mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </label>
            {!meterNamesSaved && (
              <p className="text-xs text-amber-700">
                Save the meter names first before recording readings.
              </p>
            )}
          </>
        )}

        <div className="overflow-x-auto">
          <h3 className="font-medium mb-2">Recent readings</h3>
          {readingsLoading ? (
            <p className="text-sm text-gray-500 py-3">Loading readings…</p>
          ) : readingsError ? (
            <button type="button" onClick={() => refetchReadings()} className="text-sm text-red-600 py-3">
              Could not load readings — retry
            </button>
          ) : meterReadings.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">No meter readings recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Meter</th>
                  <th className="py-2 pr-4">Reading (kWh)</th>
                  <th className="py-2 pr-4">Date and time (LKT)</th>
                  {isAdmin && <th className="py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {meterReadings.map((reading: any) => (
                  <tr key={reading.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{reading.meter_name}</td>
                    <td className="py-2 pr-4">
                      {Number(reading.reading_value).toLocaleString()}
                      {reading.correction_reason && (
                        <span
                          title={reading.correction_reason}
                          className="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
                        >
                          <AlertCircle size={11} /> corrected
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatTimestamp(reading.recorded_at)} LKT</td>
                    {isAdmin && (
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => openEdit(reading)}
                          className="inline-flex items-center gap-1 text-xs text-[#B91C1C] hover:text-red-700 cursor-pointer"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium">Meter readings over time</h3>
            <p className="text-xs text-gray-500 mt-1">Meter values are plotted against their LKT reading dates.</p>
            {analyticsLoading ? (
              <p className="py-8 text-sm text-gray-500">Loading meter analytics…</p>
            ) : analyticsError ? (
              <button type="button" onClick={() => refetchAnalytics()} className="py-8 text-sm text-red-600">
                Could not load meter analytics — retry
              </button>
            ) : readingChartData.length === 0 ? (
              <p className="py-8 text-sm text-gray-500">Add meter readings to see the chart.</p>
            ) : (
              <div className="h-72 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readingChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="recorded_at"
                      tickFormatter={(value: string) => formatTimestamp(value)}
                      minTickGap={28}
                    />
                    <YAxis
                      label={{ value: 'Reading (kWh)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      labelFormatter={(value: string) => `${formatTimestamp(value)} LKT`}
                      formatter={(value: number, name: string) => [
                        Number(value).toLocaleString(),
                        name === 'meter_1'
                          ? form.electricity_meter_1_name
                          : form.electricity_meter_2_name,
                      ]}
                    />
                    <Legend
                      formatter={(value: string) => value === 'meter_1'
                        ? form.electricity_meter_1_name
                        : form.electricity_meter_2_name}
                    />
                    <Line type="monotone" dataKey="meter_1" name="meter_1" stroke="#2563eb" connectNulls dot />
                    <Line type="monotone" dataKey="meter_2" name="meter_2" stroke="#dc2626" connectNulls dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-medium">Monthly electricity cost (LKR)</h3>
            <p className="text-xs text-gray-500 mt-1">Calculated per meter from the saved unit-slab tariff.</p>
            {analyticsLoading ? (
              <p className="py-8 text-sm text-gray-500">Loading monthly costs…</p>
            ) : analyticsError ? (
              <button type="button" onClick={() => refetchAnalytics()} className="py-8 text-sm text-red-600">
                Could not load monthly costs — retry
              </button>
            ) : !monthlyAnalytics.some((month: any) =>
              month.amount_lkr !== null ||
              month.meter_1_amount_lkr !== null ||
              month.meter_2_amount_lkr !== null
            ) ? (
              <p className="py-8 text-sm text-gray-500">
                {meterAnalytics?.configuration_error ||
                  'A cost appears after a meter has at least two readings in its history.'}
              </p>
            ) : (
              <div className="h-72 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis
                      tickFormatter={(value: number) => Number(value).toLocaleString()}
                      label={{ value: 'LKR', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={value =>
                        value == null || typeof value !== 'number' ? '—' : formatLkr(value)
                      }
                    />
                    <Legend />
                    <Bar dataKey="meter_1_amount_lkr" name={form.electricity_meter_1_name} fill="#2563eb">
                      {costChartData.map((entry: any, index: number) => (
                        <Cell key={index} fillOpacity={entry.projected ? 0.4 : 1} />
                      ))}
                    </Bar>
                    <Bar dataKey="meter_2_amount_lkr" name={form.electricity_meter_2_name} fill="#dc2626">
                      {costChartData.map((entry: any, index: number) => (
                        <Cell key={index} fillOpacity={entry.projected ? 0.4 : 1} />
                      ))}
                    </Bar>
                    <Bar dataKey="amount_lkr" name="Combined total (sum of both meters)" fill="#16a34a">
                      {costChartData.map((entry: any, index: number) => (
                        <Cell key={index} fillOpacity={entry.projected ? 0.4 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4 xl:col-span-2">
            <h3 className="font-medium">Monthly consumption and separate LKR amounts</h3>
            <p className="text-xs text-gray-500 mt-1">
              Each meter&apos;s amount includes its slab-based energy charge, the stepped fixed charge for its
              consumption block, and tax. The combined total is the sum of both meters.
            </p>
            {analyticsLoading ? (
              <p className="py-4 text-sm text-gray-500">Loading monthly details…</p>
            ) : analyticsError ? (
              <p className="py-4 text-sm text-red-600">Monthly calculation details could not be loaded.</p>
            ) : monthlyAnalytics.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No monthly reading history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4">{form.electricity_meter_1_name} (kWh)</th>
                      <th className="py-2 pr-4">{form.electricity_meter_2_name} (kWh)</th>
                      <th className="py-2 pr-4">Total (kWh)</th>
                      <th className="py-2 pr-4">{form.electricity_meter_1_name} (LKR)</th>
                      <th className="py-2 pr-4">{form.electricity_meter_2_name} (LKR)</th>
                      <th className="py-2 pr-4">Amount (LKR)</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAnalytics.map((month: any) => (
                      <Fragment key={month.month}>
                        <tr className="border-b last:border-0 align-top">
                          <td className="py-2 pr-4 whitespace-nowrap">{periodLabel(month.period_start, month.period_end, month.month)}</td>
                          <td className="py-2 pr-4">{Number(month.meter_1_units).toLocaleString()}</td>
                          <td className="py-2 pr-4">{Number(month.meter_2_units).toLocaleString()}</td>
                          <td className="py-2 pr-4">{Number(month.total_units).toLocaleString()}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {month.meter_1_amount_lkr === null ? '—' : formatLkr(month.meter_1_amount_lkr)}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {month.meter_2_amount_lkr === null ? '—' : formatLkr(month.meter_2_amount_lkr)}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {month.amount_lkr === null ? '—' : formatLkr(month.amount_lkr)}
                          </td>
                          <td className="py-2">
                            {month.errors?.length ? (
                              <span className="text-red-600">{month.errors.join(' ')}</span>
                            ) : month.warnings?.length ? (
                              <span className="text-amber-700">{month.warnings.join(' ')}</span>
                            ) : month.amount_lkr === null ? (
                              <span className="text-gray-500">Needs another reading</span>
                            ) : (
                              <span className="text-green-700">Calculated</span>
                            )}
                            {(month.meter_1_cost || month.meter_2_cost) && (
                              <button
                                type="button"
                                onClick={() => setExpandedMonth(current => (current === month.month ? null : month.month))}
                                className="ml-2 text-xs text-[#B91C1C] hover:text-red-700 underline underline-offset-2 cursor-pointer"
                              >
                                {expandedMonth === month.month ? 'Hide breakdown' : 'Breakdown'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedMonth === month.month && (month.meter_1_cost || month.meter_2_cost) && (
                          <tr className="border-b last:border-0">
                            <td colSpan={8} className="py-2 pr-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <SlabBreakdown cost={month.meter_1_cost} name={form.electricity_meter_1_name} />
                                <SlabBreakdown cost={month.meter_2_cost} name={form.electricity_meter_2_name} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp size={20} /> Monthly projection
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {meterProjection
                ? `${periodLabel(meterProjection.period_start, meterProjection.period_end)} · ${meterProjection.method_label}`
                : 'Projected month-end units and slab cost.'}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Start
              <input
                type="date"
                value={projStart}
                max={projEnd || undefined}
                onChange={e => setProjStart(e.target.value)}
                className="block mt-1 px-3 py-1.5 border rounded-lg text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              End
              <input
                type="date"
                value={projEnd}
                min={projStart || undefined}
                onChange={e => setProjEnd(e.target.value)}
                className="block mt-1 px-3 py-1.5 border rounded-lg text-sm"
              />
            </label>
            {(projStart || projEnd) && (
              <button
                type="button"
                onClick={() => { setProjStart(''); setProjEnd('') }}
                className="px-3 py-1.5 border rounded-lg text-xs font-medium cursor-pointer"
              >
                Current month
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border p-3 bg-gray-50 dark:bg-gray-900/40">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Projection method
              <select
                value={projMethod}
                onChange={e => { setProjMethod(e.target.value); setFormulaApplied(null) }}
                className="block mt-1 px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-gray-800"
              >
                <option value="">Saved default{meterProjection ? ` (${meterProjection.method_label})` : ''}</option>
                {(meterProjection?.methods || []).map((m: any) => (
                  <option key={m.id} value={m.id} title={m.description}>{m.label}</option>
                ))}
              </select>
            </label>
            {effectiveMethod === 'custom' && (
              isAdmin ? (
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Custom pace formula (kWh/day)
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      value={formulaDraft}
                      onChange={e => setFormulaDraft(e.target.value)}
                      placeholder="e.g. avg_7d + trend_slope"
                      maxLength={300}
                      className="flex-1 min-w-0 px-3 py-1.5 border rounded-lg text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setFormulaApplied(formulaDraft.trim())}
                      disabled={!formulaDraft.trim()}
                      className="shrink-0 px-3 py-1.5 border rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 self-center">Custom formula (set by an admin).</p>
              )
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const data: any = { electricity_projection_method: effectiveMethod }
                  if (effectiveMethod === 'custom' && formulaDraft.trim()) {
                    data.electricity_projection_formula = formulaDraft.trim()
                  }
                  saveMut.mutate(data, {
                    onSuccess: () => {
                      setProjMethod('')
                      setFormulaApplied(null)
                      setFormulaDraft('')
                    },
                  })
                }}
                disabled={saveMut.isPending || (!projMethod && !formulaDraft.trim())}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer disabled:opacity-40 lg:ml-auto"
              >
                {saveMut.isPending ? 'Saving…' : 'Save as default'}
              </button>
            )}
          </div>
          {effectiveMethod === 'custom' && (
            <p className="text-xs text-gray-500">
              Variables: units_so_far, measured_days, remaining_days, total_days, avg_daily, avg_7d, avg_14d,
              median_daily, trend_slope, trend_intercept, last_daily. Functions: min, max, abs, round.
              {formulaApplied ? ` Previewing “${formulaApplied}” — not saved yet.` : ''}
            </p>
          )}
          {meterProjection?.methods?.find((m: any) => m.id === effectiveMethod)?.description && effectiveMethod !== 'custom' && (
            <p className="text-xs text-gray-500">
              {meterProjection.methods.find((m: any) => m.id === effectiveMethod).description}
            </p>
          )}
        </div>

        {(projStart && !projEnd) || (!projStart && projEnd) ? (
          <p className="text-sm text-amber-700">Set both the start and end dates, or clear both for the current billing month.</p>
        ) : projectionLoading ? (
          <p className="py-4 text-sm text-gray-500">Loading projection…</p>
        ) : projectionError ? (
          <button type="button" onClick={() => refetchProjection()} className="py-4 text-sm text-red-600">
            {(projectionErr as any)?.response?.data?.detail || 'Could not load projection — retry'}
          </button>
        ) : !meterProjection?.has_data ? (
          <p className="py-4 text-sm text-gray-500">No readings in this window yet — add a reading to see a projection.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Day {meterProjection.elapsed_days} of {meterProjection.total_days} · {meterProjection.remaining_days} remaining</span>
                <span>{meterProjection.is_current ? 'In progress' : 'Completed window'}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-[#B91C1C] rounded-full"
                  style={{ width: `${meterProjection.total_days ? Math.min(100, (meterProjection.elapsed_days / meterProjection.total_days) * 100) : 0}%` }}
                />
              </div>
            </div>
            {meterProjection.configuration_error && (
              <p className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                {meterProjection.configuration_error} Unit totals below exclude LKR costs.
              </p>
            )}
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-medium">Daily pace, trend and forecast (kWh)</h3>
                <div className="flex flex-wrap gap-1">
                  {([
                    ['meter_1', form.electricity_meter_1_name],
                    ['meter_2', form.electricity_meter_2_name],
                    ['combined', 'Combined'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProjMeter(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                        projMeter === value
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" minTickGap={28} tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(value: number) => Number(value).toLocaleString()}
                      label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={value =>
                        value == null || typeof value !== 'number'
                          ? '—'
                          : `${Number(value).toLocaleString('en-LK', { maximumFractionDigits: 1 })} kWh`
                      }
                    />
                    <Legend />
                    <Bar dataKey="actual" name="Measured (kWh)" fill={projColor} />
                    <Bar dataKey="forecast" name="Forecast (kWh)" fill={projColor} fillOpacity={0.35} />
                    {projShowTrend && (
                      <Line
                        type="monotone"
                        dataKey="trend"
                        name="Trend (kWh/day)"
                        stroke="#111827"
                        strokeDasharray="6 4"
                        dot={false}
                        connectNulls
                      />
                    )}
                    <ReferenceLine
                      y={projAvg}
                      label={{ value: 'Average pace', position: 'insideTopRight', fontSize: 11 }}
                      stroke="#6b7280"
                      strokeDasharray="2 3"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Solid bars are measured days, faded bars the forecast. The dashed line is the fitted usage trend;
                the dotted line the average daily pace.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProjectionCard entry={meterProjection.meters?.meter_1} past={!meterProjection.is_current} />
              <ProjectionCard entry={meterProjection.meters?.meter_2} past={!meterProjection.is_current} />
            </div>
            <div className="rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Combined so far</p>
                <p className="font-semibold">{formatKwh(meterProjection.combined?.units_so_far ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{meterProjection.is_current ? 'Projected total' : 'Billed total'} (kWh)</p>
                <p className="font-semibold text-[#B91C1C]">{formatKwh(meterProjection.combined?.projected_units ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cost so far</p>
                <p className="font-semibold">
                  {meterProjection.combined?.cost_so_far_lkr == null ? '—' : formatLkr(meterProjection.combined.cost_so_far_lkr)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{meterProjection.is_current ? 'Projected cost' : 'Billed cost'}</p>
                <p className="font-semibold text-[#B91C1C]">
                  {meterProjection.combined?.projected_cost_lkr == null ? '—' : formatLkr(meterProjection.combined.projected_cost_lkr)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity size={20} /> Daily usage &amp; trends
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Usage per day per meter (intervals between readings are distributed evenly across the days they span, in kWh).
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {USAGE_RANGES.map(range => (
              <button
                key={range.value}
                onClick={() => setUsageRange(range.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                  usageRange === range.value
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {usageLoading ? (
          <p className="py-8 text-sm text-gray-500">Loading daily usage…</p>
        ) : usageError ? (
          <button type="button" onClick={() => refetchUsage()} className="py-8 text-sm text-red-600">
            Could not load usage analytics — retry
          </button>
        ) : usageDays.length === 0 ? (
          <p className="py-8 text-sm text-gray-500">
            Add at least two readings for a meter to see daily usage, trend and statistics.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <UsageCard meter={usageMeters?.meter_1} name={usageMeters?.meter_1?.name || form.electricity_meter_1_name} />
              <UsageCard meter={usageMeters?.meter_2} name={usageMeters?.meter_2?.name || form.electricity_meter_2_name} />
              <UsageCard meter={usageCombined} name="Combined (both meters)" />
            </div>

            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Daily usage with 7-day trend lines</h3>
              <p className="text-xs text-gray-500 mt-1">
                Bars are kWh per day; the analytical lines are the 7-day trailing averages of each meter (and the combined total).
              </p>
              <div className="h-80 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={usageRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" minTickGap={24} />
                    <YAxis label={{ value: 'kWh / day', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      labelFormatter={(value: string) => `Date: ${value}`}
                      formatter={(value: any, name: string) =>
                        value == null ? ['—', name] : [formatKwh(value), name]
                      }
                    />
                    <Legend />
                    <Bar dataKey="meter_1" name={`${usageMeters?.meter_1?.name || form.electricity_meter_1_name} · daily`} fill="#bfdbfe" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="meter_2" name={`${usageMeters?.meter_2?.name || form.electricity_meter_2_name} · daily`} fill="#fecaca" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Line type="monotone" dataKey="meter_1_ma7" name={`${usageMeters?.meter_1?.name || form.electricity_meter_1_name} · 7-day avg`} stroke="#1d4ed8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="meter_2_ma7" name={`${usageMeters?.meter_2?.name || form.electricity_meter_2_name} · 7-day avg`} stroke="#b91c1c" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="combined_ma7" name="Combined · 7-day avg" stroke="#15803d" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-x-auto">
              <h3 className="font-medium mb-2">Recent days</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">{usageMeters?.meter_1?.name || form.electricity_meter_1_name} (kWh)</th>
                    <th className="py-2 pr-4">{usageMeters?.meter_2?.name || form.electricity_meter_2_name} (kWh)</th>
                    <th className="py-2">Combined (kWh)</th>
                  </tr>
                </thead>
                <tbody>
                  {usageRows.slice(-10).reverse().map((row: any) => (
                    <tr key={row.date} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.date}</td>
                      <td className="py-2 pr-4">{row.meter_1 == null ? '—' : formatKwh(row.meter_1)}</td>
                      <td className="py-2 pr-4">{row.meter_2 == null ? '—' : formatKwh(row.meter_2)}</td>
                      <td className="py-2">{row.combined == null ? '—' : formatKwh(row.combined)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings size={20} /> Payroll Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company Name</label>
            <input
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Salary Basis Days (per month)</label>
            <input
              type="number"
              min="1"
              value={form.salary_basis_days}
              onChange={e => setForm({ ...form, salary_basis_days: Number(e.target.value) || 30 })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Monthly salary is divided by this to get the per-day rate.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Default Overtime Rate (LKR/hr)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.default_overtime_rate}
              onChange={e => setForm({ ...form, default_overtime_rate: Number(e.target.value) || 0 })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Working Days ({form.working_days_per_week} of 7)
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DOW_LABELS.map((label, i) => {
              const active = form.working_days_pattern.includes(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleDow(i)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    active
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">Non-working days are skipped in salary calculation. Sundays and Saturdays follow your selection.</p>
        </div>
      </div>

      {editReading && isAdmin && (
        <Portal><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditReading(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold">Correct meter reading</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editReading.meter_name} · {formatTimestamp(editReading.recorded_at)} LKT · current value{' '}
                  {Number(editReading.reading_value).toLocaleString()} kWh
                </p>
              </div>
              <button type="button" onClick={() => setEditReading(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New reading (kWh)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason for correction *</label>
                <textarea
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Mistyped the reading — actual meter value was …"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditReading(null)}
                  className="rounded-md border px-4 py-2 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    updateReadingMut.isPending ||
                    !editReason.trim() ||
                    editValue === '' ||
                    Number(editValue) < 0 ||
                    Number(editValue) === Number(editReading.reading_value)
                  }
                  onClick={() =>
                    updateReadingMut.mutate({
                      id: editReading.id,
                      data: { reading_value: Number(editValue), reason: editReason.trim() },
                    })
                  }
                  className="rounded-md bg-[#B91C1C] px-4 py-2 text-sm text-white font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  {updateReadingMut.isPending ? 'Saving…' : 'Save correction'}
                </button>
              </div>
            </div>
          </div>
        </div></Portal>
      )}
    </div>
  )
}