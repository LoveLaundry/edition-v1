import { Fragment, useEffect, useState } from 'react'
import { TableEmptyRow } from '../../../components/ui/empty-state'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reportsApi, customersApi } from '../api/management-api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Filter, Save, Pencil, Trash2, X, ChevronDown, ChevronRight, Printer, FileSpreadsheet } from 'lucide-react'
import { currentMonth, currentYear, todayISO } from '../../../lib/time'
import { useQuotations } from '../../quotations/hooks/useQuotations'
import { reports as operationsReports } from '../../quotations/services/reports.service'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { useAuth } from '../../../context/AuthContext'

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const LIST_LIMIT = 500

function PayrollBreakdown({ rows = [] }: { rows?: any[] }) {
  if (!rows.length) {
    return <p className="px-4 py-6 text-center text-sm text-gray-500">No payroll records for this period.</p>
  }

  const columns: [string, (row: any) => string | number][] = [
    ['Employee', row => row.employee_name || '—'],
    ['Pay type', row => row.salary_type || '—'],
    ['Calculation', row => row.calculation_method || '—'],
    ['Attendance', row => row.attendance_required ? 'Required' : 'Fixed'],
    ['Worked days', row => row.worked_days ?? 0],
    ['Absent days', row => row.absent_days ?? 0],
    ['Base pay', row => fmtMoney(row.base_salary_for_period)],
    ['Allowance', row => fmtMoney(row.allowance_for_period)],
    ['Overtime', row => fmtMoney(row.overtime_pay)],
    ['Extra work', row => fmtMoney(row.extra_work_total)],
    ['Bonus', row => fmtMoney(row.bonus)],
    ['Other pay', row => fmtMoney(row.other_payments)],
    ['Employee EPF', row => fmtMoney(row.epf_employee)],
    ['Employer EPF', row => fmtMoney(row.epf_employer)],
    ['Employer ETF', row => fmtMoney(row.etf_employer)],
    ['Deductions', row => fmtMoney(row.total_deductions)],
    ['Net salary', row => fmtMoney(row.net_salary)],
    ['Total salary expense', row => fmtMoney(row.salary_expense)],
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-375 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>{columns.map(([label]) => <th key={label} className="px-3 py-2 text-left whitespace-nowrap">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.employee_id}-${row.period_start}-${index}`} className="border-t">
              {columns.map(([label, value]) => <td key={label} className="px-3 py-2 whitespace-nowrap">{value(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmtMoney(value: unknown): string {
  return `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function payrollRows(data: any): any[] {
  if (Array.isArray(data?.salary_period_details)) return data.salary_period_details
  return (data?.salary_expenses || []).flatMap((employee: any) => employee.periods || [])
}

function normalizeClientName(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function dailyIncomeSeries(data: any): { date: string; income: number }[] {
  const incomeByDate = new Map<string, number>((data?.daily_summary || []).map((day: any) => [day.date, Number(day.value || 0)]))

  const start = new Date(`${data?.start_date}T00:00:00Z`)
  const end = new Date(`${data?.end_date}T00:00:00Z`)
  const days: { date: string; income: number }[] = []
  for (let current = start; current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    const key = current.toISOString().slice(0, 10)
    days.push({ date: key.slice(5), income: incomeByDate.get(key) || 0 })
  }
  return days
}

function CategorySummaryTable({
  categories,
  expanded,
  onToggle,
  scope,
}: {
  categories: any[]
  expanded: Record<string, boolean>
  onToggle: (key: string) => void
  scope: string
}) {
  const totalQuantity = categories.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const totalValue = categories.reduce((sum, row) => sum + Number(row.value || 0), 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-155 text-sm">
        <thead className="bg-gray-50 text-left dark:bg-gray-700">
          <tr>
            <th className="px-3 py-2">Linen category</th>
            <th className="px-3 py-2 text-right">Quantity</th>
            <th className="px-3 py-2 text-right">Rate</th>
            <th className="px-3 py-2 text-right">Total value</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(category => {
            const key = `${scope}::${category.category}`
            const isExpanded = Boolean(expanded[key])
            return <Fragment key={key}>
              <tr className="border-t font-medium">
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onToggle(key)} aria-expanded={isExpanded} className="inline-flex items-center gap-2 text-left">
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    {category.category}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">{category.quantity}</td>
                <td className="px-3 py-2 text-right">{category.rate_label}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtMoney(category.value)}</td>
              </tr>
              {isExpanded && (category.variants || []).map((variant: any, index: number) => (
                <tr key={`${key}-${variant.item_name}-${variant.specification}-${index}`} className="border-t bg-gray-50/70 text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
                  <td className="px-3 py-2 pl-10">{variant.item_name}{variant.specification ? ` · ${variant.specification}` : ''}</td>
                  <td className="px-3 py-2 text-right">{variant.quantity}</td>
                  <td className="px-3 py-2 text-right">{variant.rate_label}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(variant.value)}</td>
                </tr>
              ))}
            </Fragment>
          })}
          {!categories.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No received linen in this period.</td></tr>}
        </tbody>
        <tfoot className="border-t bg-gray-50 font-bold dark:bg-gray-700">
          <tr><td className="px-3 py-2">Subtotal</td><td className="px-3 py-2 text-right">{totalQuantity}</td><td className="px-3 py-2 text-right">—</td><td className="px-3 py-2 text-right">{fmtMoney(totalValue)}</td></tr>
        </tfoot>
      </table>
    </div>
  )
}

function reportRange(preset: string, today: string): [string, string] | null {
  const asDate = (value: string) => new Date(`${value}T00:00:00Z`)
  const format = (value: Date) => value.toISOString().slice(0, 10)
  const current = asDate(today)
  if (preset === 'today') return [today, today]
  if (preset === 'yesterday') {
    current.setUTCDate(current.getUTCDate() - 1)
    const day = format(current)
    return [day, day]
  }
  if (preset === 'this-week') {
    current.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7))
    return [format(current), today]
  }
  if (preset === 'this-month') return [`${today.slice(0, 7)}-01`, today]
  if (preset === 'previous-month') {
    current.setUTCDate(1)
    current.setUTCMonth(current.getUTCMonth() - 1)
    const start = format(current)
    current.setUTCMonth(current.getUTCMonth() + 1)
    current.setUTCDate(0)
    return [start, format(current)]
  }
  return null
}

export default function ManagementReports() {
  const [report, setReport] = useState('master')
  const [startDate, setStartDate] = useState(() => `${todayISO().slice(0, 7)}-01`)
  const [endDate, setEndDate] = useState(() => todayISO())
  const [selectedHotel, setSelectedHotel] = useState('')
  const [summaryView, setSummaryView] = useState<'daily' | 'period'>('period')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [newMappingName, setNewMappingName] = useState('')
  const [newMappingCategory, setNewMappingCategory] = useState('')
  const [dailyDate, setDailyDate] = useState(() => todayISO())
  const [selectedQuotations, setSelectedQuotations] = useState<Record<string, string | null>>({})
  const [savedReportTitle, setSavedReportTitle] = useState('')
  const [editingSavedReportId, setEditingSavedReportId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [year, setYear] = useState(currentYear())
  const [month, setMonth] = useState(currentMonth())

  const { data: customersData = { items: [] } } = useQuery({
    queryKey: ['mgmt-customers-list'],
    queryFn: () => customersApi.list('', LIST_LIMIT, 0).then(r => r.data),
  })

  const customers = customersData.items
  const { user } = useAuth()
  const _role = (user?.role_id || '').toUpperCase()
  const isAdmin = _role === 'ADMIN' || _role === 'PLATFORM_ADMIN'
  const { data: quotations = [], isLoading: quotationsLoading } = useQuotations()
  const queryClient = useQueryClient()

  const { data: plData } = useQuery({
    queryKey: ['mgmt-pl-report', startDate, endDate, customerId],
    queryFn: () => reportsApi.profitLoss({ start_date: startDate, end_date: endDate, customer_id: customerId }).then(r => r.data),
    enabled: report === 'profit-loss',
  })

  const { data: dailyData } = useQuery({
    queryKey: ['mgmt-daily-report', dailyDate],
    queryFn: () => reportsApi.daily(dailyDate).then(r => r.data),
    enabled: report === 'daily',
  })

  const { data: monthlyData } = useQuery({
    queryKey: ['mgmt-monthly-report', year, month],
    queryFn: () => reportsApi.monthly(year, month).then(r => r.data),
    enabled: report === 'monthly',
  })

  const { data: masterData, isLoading: masterLoading, isError: masterError } = useQuery({
    queryKey: ['mgmt-master-report', startDate, endDate],
    queryFn: () => reportsApi.master({ start_date: startDate, end_date: endDate }).then(r => r.data),
    enabled: report === 'master' && Boolean(startDate && endDate),
  })

  const quotationSnapshots = quotations.reduce((snapshots, quotation: any) => {
    const quotationId = String(quotation.id)
    if (Object.values(selectedQuotations).some(selectedId => String(selectedId || '') === quotationId)) {
      snapshots[quotationId] = {
        id: quotation.id,
        client_name: quotation.client_name,
        line_items: quotation.line_items || [],
      }
    }
    return snapshots
  }, {} as Record<string, { id: string | number; client_name: string; line_items: unknown[] }>)

  const { data: operationsData, isLoading: operationsLoading, isFetching: operationsFetching, isError: operationsError } = useQuery({
    queryKey: ['monthly-operations-report', startDate, endDate, selectedHotel, selectedQuotations],
    queryFn: () => operationsReports.monthlyOperations({
      start_date: startDate,
      end_date: endDate,
      hotel_name: selectedHotel || null,
      selected_quotations: selectedQuotations,
      quotation_snapshots: quotationSnapshots,
    }),
    enabled: report === 'master' && Boolean(startDate && endDate) && !quotationsLoading,
  })

  const { data: savedReports = [] } = useQuery({
    queryKey: ['saved-master-reports'],
    queryFn: () => reportsApi.saved().then(r => r.data),
    enabled: report === 'master',
  })

  const { data: categoryConfiguration, isLoading: categoriesLoading } = useQuery({
    queryKey: ['linen-category-mappings'],
    queryFn: operationsReports.linenCategories,
    enabled: report === 'master',
  })

  useEffect(() => {
    if (!operationsData?.hotels?.length) return
    setSelectedQuotations(current => {
      let changed = false
      const next = { ...current }
      for (const hotel of operationsData.hotels) {
        if (!(hotel.client_name in next)) {
          next[hotel.client_name] = hotel.suggested_quotation_id || null
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [operationsData?.hotels])

  const { data: outstandingData = [] } = useQuery({
    queryKey: ['mgmt-outstanding'],
    queryFn: () => reportsApi.outstanding().then(r => r.data),
    enabled: report === 'outstanding',
  })

  const fmt = (n: number) => `LKR ${(n || 0).toLocaleString()}`

  const masterReportData = masterData && operationsData ? {
    ...masterData,
    ...operationsData,
    salary_expense_total: masterData.salary_expense_total,
    other_expense_total: masterData.other_expense_total,
    total_expenses: masterData.total_expenses,
    net_profit: Number(operationsData.total_income || 0) - Number(masterData.total_expenses || 0),
    salary_expenses: masterData.salary_expenses,
    salary_period_details: masterData.salary_period_details,
    other_expense_details: masterData.other_expense_details,
  } : null
  const receivingIncomeByDay = dailyIncomeSeries(masterReportData)
  const expenseMix = [
    { name: 'Salary', value: Number(masterReportData?.salary_expense_total || 0), color: '#dc2626' },
    { name: 'Other expenses', value: Number(masterReportData?.other_expense_total || 0), color: '#f59e0b' },
  ].filter(row => row.value > 0)
  const reportHotels = operationsData?.hotel_options || []
  const selectedHotelData = operationsData?.hotel_summary?.find((hotel: any) => normalizeClientName(hotel.client_name) === normalizeClientName(selectedHotel))
  const periodCategoryRows = selectedHotel
    ? selectedHotelData?.categories || []
    : operationsData?.period_summary || []

  const saveCategoryMapping = async () => {
    if (!newMappingName.trim() || !newMappingCategory) return
    try {
      await operationsReports.saveLinenCategoryMapping({ item_name: newMappingName, category: newMappingCategory })
      await queryClient.invalidateQueries({ queryKey: ['linen-category-mappings'] })
      await queryClient.invalidateQueries({ queryKey: ['monthly-operations-report'] })
      setNewMappingName('')
      toast.success('Linen category mapping saved')
    } catch {
      toast.error('Could not save category mapping')
    }
  }

  const exportLinenExcel = () => {
    if (!masterReportData) return
    const workbook = XLSX.utils.book_new()
    const dailyRows = (masterReportData.daily_details || []).flatMap((day: any) => day.items.map((item: any) => ({
      Date: day.date,
      Hotel: day.client_name,
      'Gate Pass': day.gate_pass_number,
      Category: item.category,
      Item: item.item_name,
      Specification: item.specification,
      Quantity: item.quantity,
      Unit: item.unit,
      Pieces: item.piece_count,
      'Unit Price LKR': item.unit_price,
      'Value LKR': item.value,
    })))
    const periodRows = (periodCategoryRows || []).flatMap((category: any) => [
      { Category: category.category, Item: 'Category total', Specification: '', Quantity: category.quantity, 'Unit price / rate': category.rate_label, 'Value LKR': category.value },
      ...(category.variants || []).map((item: any) => ({
        Category: category.category,
        Item: item.item_name,
        Specification: item.specification,
        Quantity: item.quantity,
        'Unit price / rate': item.rate_label,
        'Value LKR': item.value,
      })),
    ])
    const exceptionRows = [
      ...(masterReportData.unpriced_items || []).map((row: any) => ({ Type: 'Missing price', Date: row.date, Hotel: row.client_name, Item: row.item_name, Specification: row.specification, Quantity: row.quantity, Reason: row.reason })),
      ...(masterReportData.unmapped_items || []).map((row: any) => ({ Type: 'Unmapped item', Date: '', Hotel: '', Item: row.item_name, Specification: '', Quantity: row.quantity, Reason: 'Assigned to Other / Unclassified Items' })),
      ...(masterReportData.draft_receiving || []).map((row: any) => ({ Type: 'Draft receiving', Date: row.date, Hotel: row.client_name, Item: row.gate_pass_number, Specification: '', Quantity: row.quantity, Reason: 'Not included until activated' })),
    ]
    const append = (rows: object[], name: string) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name)
    append(dailyRows, 'Daily Details')
    append(periodRows, 'Period Summary')
    append(exceptionRows, 'Exceptions')
    XLSX.writeFile(workbook, `linen-report-${startDate}-${endDate}.xlsx`)
  }

  const applyDatePreset = (preset: string) => {
    const range = reportRange(preset, todayISO())
    if (range) {
      setStartDate(range[0])
      setEndDate(range[1])
    }
  }

  const toggleCategory = (key: string) => {
    setExpandedCategories(current => ({ ...current, [key]: !current[key] }))
  }

  const saveCurrentReport = async () => {
    if (!masterReportData || !startDate || !endDate) return
    const payload = {
      title: savedReportTitle.trim() || `Operations report ${startDate} to ${endDate}`,
      start_date: startDate,
      end_date: endDate,
      selected_quotations: selectedQuotations,
      report_data: masterReportData,
    }
    try {
      if (editingSavedReportId) {
        await reportsApi.updateSaved(editingSavedReportId, payload)
        toast.success('Saved report updated')
      } else {
        await reportsApi.save(payload)
        toast.success('Report saved')
      }
      await queryClient.invalidateQueries({ queryKey: ['saved-master-reports'] })
    } catch {
      toast.error('Could not save report')
    }
  }

  const editSavedReport = (saved: any) => {
    setEditingSavedReportId(saved.id)
    setSavedReportTitle(saved.title || '')
    setStartDate(saved.start_date)
    setEndDate(saved.end_date)
    setSelectedQuotations(saved.selected_quotations || {})
    setReport('master')
  }

  const deleteSavedReport = async (id: string) => {
    try {
      await reportsApi.deleteSaved(id)
      await queryClient.invalidateQueries({ queryKey: ['saved-master-reports'] })
      if (editingSavedReportId === id) setEditingSavedReportId(null)
      toast.success('Saved report deleted')
    } catch {
      toast.error('Could not delete report')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'master', label: 'Master Report' },
          { id: 'profit-loss', label: 'Profit & Loss' },
          { id: 'daily', label: 'Daily Report' },
          { id: 'monthly', label: 'Monthly Report' },
          { id: 'outstanding', label: 'Outstanding Payments' },
        ].map(r => (
          <button key={r.id} onClick={() => setReport(r.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${report === r.id ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end bg-white dark:bg-gray-800 rounded-xl border p-4">
        <Filter size={16} className="text-gray-400" />
        {(report === 'profit-loss' || report === 'master') && <>
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
          </div>
        </>}
        {report === 'master' && <>
          <div>
            <label className="text-xs text-gray-500">Hotel</label>
            <select value={selectedHotel} onChange={event => setSelectedHotel(event.target.value)} className="block h-10 min-w-52 rounded-lg border bg-white px-3 text-sm dark:bg-gray-900">
              <option value="">All hotels</option>
              {reportHotels.map((name: string) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Report date presets">
            {[
              ['today', 'Today'], ['yesterday', 'Yesterday'], ['this-week', 'This week'],
              ['this-month', 'This month'], ['previous-month', 'Previous month'], ['custom', 'Custom'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => applyDatePreset(value)} className="h-9 rounded-md border px-2.5 text-xs font-medium hover:bg-surface-hover">
                {label}
              </button>
            ))}
          </div>
        </>}
        {report === 'profit-loss' && <div>
          <label className="text-xs text-gray-500">Customer</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm">
            <option value="">All Customers</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>}
        {report === 'daily' && <div>
          <label className="text-xs text-gray-500">Report date</label>
          <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>}
        {report === 'monthly' && (
          <>
            <div>
              <label className="text-xs text-gray-500">Month</label>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="block px-3 py-2 border rounded-lg text-sm">
                {Array.from({length:12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Year</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="block px-3 py-2 border rounded-lg text-sm w-24" />
            </div>
          </>
        )}
      </div>

      {/* Profit & Loss */}
      {report === 'profit-loss' && plData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-green-600">{fmt(plData.total_revenue)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Cost of Goods</p>
              <p className="text-xl font-bold text-orange-600">{fmt(plData.total_cogs)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Gross Profit</p>
              <p className="text-xl font-bold">{fmt(plData.gross_profit)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Net Profit</p>
              <p className={`text-xl font-bold ${plData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(plData.net_profit)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Revenue by Customer</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={plData.revenue_by_customer || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
                  <Bar dataKey="value" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Revenue by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={plData.revenue_by_category || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {(plData.revenue_by_category || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-3">Expense Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(plData.expenses_by_category || []).map((e: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-500">{e.name}</p>
                  <p className="font-semibold">{fmt(e.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Daily Report */}
      {report === 'daily' && dailyData && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Daily Report - {dailyData.date}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-sm text-gray-500">Transactions</p><p className="text-xl font-bold">{dailyData.transactions}</p></div>
              <div><p className="text-sm text-gray-500">Total Quantity</p><p className="text-xl font-bold">{dailyData.total_quantity}</p></div>
              <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-green-600">{fmt(dailyData.total_revenue)}</p></div>
              <div><p className="text-sm text-gray-500">Gross Profit</p><p className="text-xl font-bold">{fmt(dailyData.gross_profit)}</p></div>
              <div><p className="text-sm text-gray-500">Salary Expense</p><p className="text-xl font-bold">{fmt(dailyData.salary_expense_total)}</p></div>
              <div><p className="text-sm text-gray-500">Other Expenses</p><p className="text-xl font-bold">{fmt(dailyData.other_expense_total)}</p></div>
              <div><p className="text-sm text-gray-500">Total Expenses</p><p className="text-xl font-bold">{fmt(dailyData.total_expenses)}</p></div>
              <div><p className="text-sm text-gray-500">Net Profit</p><p className={`text-xl font-bold ${dailyData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(dailyData.net_profit)}</p></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold">Employee salary details</h3>
            <PayrollBreakdown rows={payrollRows(dailyData)} />
          </div>
        </div>
      )}

      {/* Monthly Report */}
      {report === 'monthly' && monthlyData && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Monthly Report - {monthlyData.year}-{String(monthlyData.month).padStart(2, '0')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-sm text-gray-500">Transactions</p><p className="text-xl font-bold">{monthlyData.transactions}</p></div>
              <div><p className="text-sm text-gray-500">Total Quantity</p><p className="text-xl font-bold">{monthlyData.total_quantity}</p></div>
              <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-green-600">{fmt(monthlyData.total_revenue)}</p></div>
              <div><p className="text-sm text-gray-500">Gross Profit</p><p className="text-xl font-bold">{fmt(monthlyData.gross_profit)}</p></div>
              <div><p className="text-sm text-gray-500">Salary Expense</p><p className="text-xl font-bold">{fmt(monthlyData.salary_expense_total)}</p></div>
              <div><p className="text-sm text-gray-500">Other Expenses</p><p className="text-xl font-bold">{fmt(monthlyData.other_expense_total)}</p></div>
              <div><p className="text-sm text-gray-500">Total Expenses</p><p className="text-xl font-bold">{fmt(monthlyData.total_expenses)}</p></div>
              <div><p className="text-sm text-gray-500">Net Profit</p><p className={`text-xl font-bold ${monthlyData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(monthlyData.net_profit)}</p></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold">Employee salary details</h3>
            <PayrollBreakdown rows={payrollRows(monthlyData)} />
          </div>
          {monthlyData.revenue_by_customer?.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Revenue by Customer</h3>
              <div className="overflow-x-auto">
              <table className="w-full min-w-90 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-right">Revenue</th></tr>
                </thead>
                <tbody>
                  {monthlyData.revenue_by_customer.map((c: any, i: number) => (
                    <tr key={i} className="border-t"><td className="px-3 py-2">{c.name}</td><td className="px-3 py-2 text-right">{fmt(c.value)}</td></tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {report === 'master' && (
        !startDate || !endDate ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 dark:bg-gray-800">
            Select a start and end date to load the master report.
          </div>
        ) : masterLoading ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 dark:bg-gray-800">Loading report…</div>
        ) : operationsLoading || operationsFetching ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500 dark:bg-gray-800">Loading confirmed receiving records…</div>
        ) : masterError || operationsError ? (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center text-sm text-red-600 dark:bg-gray-800" role="alert">
            Unable to load the report. Check the date range and management and bill services.
          </div>
        ) : masterReportData && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4 dark:bg-gray-800">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Price coverage</h2>
                  <p className="mt-1 text-xs text-gray-500">Saved gate-pass rates take priority. Choose a quotation only to value older passes that have no stored price snapshot.</p>
                </div>
              </div>
              {operationsData.hotel_options?.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {operationsData.hotel_options.map((hotel: string) => {
                    const hotelQuotations = quotations.filter((quotation: any) =>
                      normalizeClientName(quotation.client_name) === normalizeClientName(hotel),
                    )
                    return (
                      <label key={hotel} className="min-w-0">
                        <span className="mb-1 block truncate text-xs font-medium text-gray-600 dark:text-gray-300" title={hotel}>{hotel}</span>
                        <select
                          value={selectedQuotations[hotel] || ''}
                          onChange={event => setSelectedQuotations(current => ({
                            ...current,
                            [hotel]: event.target.value || null,
                          }))}
                          className="block h-10 w-full rounded-lg border bg-white px-3 text-sm dark:bg-gray-900"
                        >
                          <option value="">No quotation selected</option>
                          {hotelQuotations.map((quotation: any) => (
                            <option key={String(quotation.id)} value={String(quotation.id)}>
                              {quotation.quotation_title || `Quotation ${quotation.id}`}
                            </option>
                          ))}
                        </select>
                        {!hotelQuotations.length && <span className="mt-1 block text-xs text-amber-700">No quotation found for this hotel.</span>}
                      </label>
                    )
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-gray-500">No active gate passes in this period.</p>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 dark:bg-gray-800">
              <label className="min-w-55 flex-1">
                <span className="mb-1 block text-xs text-gray-500">Saved report name</span>
                <input value={savedReportTitle} onChange={event => setSavedReportTitle(event.target.value)} maxLength={120}
                  placeholder={`Operations report ${startDate} to ${endDate}`}
                  className="h-10 w-full rounded-lg border bg-white px-3 text-sm dark:bg-gray-900" />
              </label>
              <button type="button" onClick={saveCurrentReport} disabled={!masterReportData}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Save size={15} />{editingSavedReportId ? 'Update saved report' : 'Save report'}
              </button>
              <button type="button" onClick={() => window.print()} disabled={!masterReportData} title="Print or save as PDF" className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50"><Printer size={15} />PDF</button>
              <button type="button" onClick={exportLinenExcel} disabled={!masterReportData} className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50"><FileSpreadsheet size={15} />Excel</button>
              {editingSavedReportId && <button type="button" title="Stop editing this saved report" onClick={() => setEditingSavedReportId(null)} className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm"><X size={15} />Cancel edit</button>}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Gate pass income', masterReportData.total_income, 'text-green-600'],
                ['Salary expense', masterReportData.salary_expense_total, ''],
                ['Other expenses', masterReportData.other_expense_total, ''],
                ['Total expenses', masterReportData.total_expenses, ''],
                ['Net profit', masterReportData.net_profit, masterReportData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'],
              ].map(([label, amount, color]) => (
                <div key={String(label)} className="rounded-xl border bg-white p-4 dark:bg-gray-800">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{fmt(Number(amount))}</p>
                </div>
              ))}
            </div>

            {operationsData.unpriced_count > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" role="status">
                <strong>{operationsData.unpriced_count} receiving line(s) have no usable quotation price.</strong>
                <span className="ml-1">Their quantities are listed below and excluded from income until the hotel quotation is corrected or selected.</span>
              </div>
            ) : operationsData.hotels?.length ? (
              <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-950 dark:bg-green-950/30 dark:text-green-100" role="status">
                Income is calculated from {operationsData.transaction_days} calendar transaction day(s), using stored gate-pass prices where available.
              </div>
            ) : (
              <div className="rounded-lg border bg-white px-4 py-3 text-sm text-gray-600 dark:bg-gray-800" role="status">
                No active gate passes exist in this date range. Draft and cancelled passes, deliveries, and rewash are not counted as received linen.
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
              <section className="min-w-0 rounded-xl border bg-white p-4 dark:bg-gray-800">
                <div className="mb-3">
                  <h3 className="font-semibold">Income by receiving day</h3>
                  <p className="text-xs text-gray-500">Quotation-priced value of confirmed items received each day.</p>
                </div>
                <div className="h-65 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={receivingIncomeByDay} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" minTickGap={24} tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={value => Number(value).toLocaleString()} tick={{ fontSize: 11 }} width={72} />
                      <Tooltip formatter={(value: number) => [fmtMoney(value), 'Receiving income']} />
                      <Bar dataKey="income" name="Receiving income" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="min-w-0 rounded-xl border bg-white p-4 dark:bg-gray-800">
                <div className="mb-3">
                  <h3 className="font-semibold">Where expenses went</h3>
                  <p className="text-xs text-gray-500">Payroll and other recorded expenses.</p>
                </div>
                {expenseMix.length ? (
                  <div className="h-65 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expenseMix} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={3}>
                          {expenseMix.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => fmtMoney(value)} />
                        <Legend verticalAlign="bottom" height={32} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="py-12 text-center text-sm text-gray-500">No expenses recorded for this period.</p>}
              </section>
            </div>

            <section className="overflow-hidden rounded-xl border bg-white dark:bg-gray-800 print-report-section">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h3 className="font-semibold">Linen received</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Same-category items are combined; expand a row to see their original variants and rates.</p>
                </div>
                <div className="inline-flex rounded-md border p-0.5" role="tablist" aria-label="Summary view">
                  {(['daily', 'period'] as const).map(mode => <button key={mode} role="tab" aria-selected={summaryView === mode} type="button" onClick={() => setSummaryView(mode)} className={`rounded px-3 py-1.5 text-xs font-semibold capitalize ${summaryView === mode ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}>{mode} summary</button>)}
                </div>
              </div>

              {summaryView === 'period' ? (
                <CategorySummaryTable
                  categories={periodCategoryRows}
                  expanded={expandedCategories}
                  onToggle={toggleCategory}
                  scope={selectedHotel || 'all-hotels-period'}
                />
              ) : (
                <div className="divide-y">
                  {(operationsData.daily_summary || []).map((day: any) => {
                    const dayKey = `day::${day.date}`
                    const isDayExpanded = Boolean(expandedCategories[dayKey])
                    return <section key={day.date}>
                      <button type="button" onClick={() => toggleCategory(dayKey)} aria-expanded={isDayExpanded} className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900">
                        <span className="inline-flex items-center gap-2 font-semibold">{isDayExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{day.date}</span>
                        <span className="text-right text-sm text-gray-600 dark:text-gray-300">{day.transaction_count} gate passes</span>
                        <span className="text-right text-sm">{day.quantity} items</span>
                        <span className="min-w-28 text-right font-semibold">{fmtMoney(day.value)}</span>
                      </button>
                      {isDayExpanded && <div className="border-t bg-gray-50/50 pl-4 dark:bg-gray-900/40">
                        <CategorySummaryTable categories={day.categories || []} expanded={expandedCategories} onToggle={toggleCategory} scope={dayKey} />
                      </div>}
                    </section>
                  })}
                  {!operationsData.daily_summary?.length && <p className="px-4 py-8 text-center text-sm text-gray-500">No days in this reporting period.</p>}
                </div>
              )}
            </section>

            <div className="overflow-hidden rounded-xl border bg-white dark:bg-gray-800">
              <h3 className="border-b px-4 py-3 font-semibold">Employee salary detail</h3>
              <PayrollBreakdown rows={payrollRows(masterReportData)} />
            </div>

            {masterReportData.unpriced_count > 0 && <div className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <h3 className="border-b border-amber-200 px-4 py-3 font-semibold text-amber-900 dark:text-amber-200">Unpriced receiving items ({masterReportData.unpriced_count})</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-620 text-sm">
                  <thead><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Hotel</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Quantity</th></tr></thead>
                  <tbody>{masterReportData.unpriced_items.map((row: any, index: number) => <tr key={`${row.date}-${row.client_name}-${row.item_name}-${index}`} className="border-t border-amber-200"><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2">{row.client_name}</td><td className="px-3 py-2">{row.item_name}{row.specification ? ` · ${row.specification}` : ''}</td><td className="px-3 py-2 text-right">{row.quantity}</td></tr>)}</tbody>
                </table>
              </div>
            </div>}

            {isAdmin && <section className="overflow-hidden rounded-xl border bg-white dark:bg-gray-800">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">Linen category mappings</h3>
                <p className="mt-1 text-xs text-gray-500">Map exact item names. Unmapped names stay visible as Other / Unclassified.</p>
              </div>
              <div className="flex flex-wrap items-end gap-3 p-4">
                <label className="min-w-56 flex-1">
                  <span className="mb-1 block text-xs text-gray-500">Exact item name</span>
                  <input value={newMappingName} onChange={event => setNewMappingName(event.target.value)} list="unmapped-linen-names" className="h-10 w-full rounded-lg border bg-white px-3 text-sm dark:bg-gray-900" placeholder="e.g. Bedsheet - King" />
                  <datalist id="unmapped-linen-names">{(masterReportData.unmapped_items || []).map((item: any) => <option key={item.item_name} value={item.item_name} />)}</datalist>
                </label>
                <label>
                  <span className="mb-1 block text-xs text-gray-500">Standard category</span>
                  <select value={newMappingCategory} onChange={event => setNewMappingCategory(event.target.value)} className="h-10 min-w-48 rounded-lg border bg-white px-3 text-sm dark:bg-gray-900">
                    <option value="">Choose category</option>
                    {(categoryConfiguration?.categories || []).filter((category: string) => category !== 'Other / Unclassified Items').map((category: string) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <button type="button" onClick={saveCategoryMapping} disabled={!newMappingName.trim() || !newMappingCategory} className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900">Save mapping</button>
              </div>
              {categoriesLoading ? <p className="px-4 pb-4 text-xs text-gray-500">Loading mappings…</p> : categoryConfiguration?.mappings?.length > 0 && <div className="divide-y border-t">
                {categoryConfiguration.mappings.map((mapping: any) => <div key={mapping.item_name} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span>{mapping.item_name}</span><span className="ml-auto text-gray-500">{mapping.category}</span>
                  <button type="button" title={`Remove mapping for ${mapping.item_name}`} onClick={async () => {
                    try {
                      await operationsReports.deleteLinenCategoryMapping(mapping.item_name)
                      await queryClient.invalidateQueries({ queryKey: ['linen-category-mappings'] })
                      await queryClient.invalidateQueries({ queryKey: ['monthly-operations-report'] })
                      toast.success('Category mapping removed')
                    } catch { toast.error('Could not remove mapping') }
                  }} className="rounded border p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>)}
              </div>}
            </section>}

            <div className="overflow-hidden rounded-xl border bg-white dark:bg-gray-800">
              <h3 className="border-b px-4 py-3 font-semibold">Daily receiving linen detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-620 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Hotel</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Specification</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-right">Pieces</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Income</th></tr></thead>
                  <tbody>{(masterReportData.daily_details || []).flatMap((day: any) => day.items.map((item: any, index: number) => <tr key={`${day.date}-${day.client_name}-${item.item_name}-${item.specification}-${index}`} className="border-t"><td className="px-3 py-2 whitespace-nowrap">{day.date}</td><td className="px-3 py-2">{day.client_name}</td><td className="px-3 py-2">{item.item_name}</td><td className="px-3 py-2">{item.specification || '—'}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2">{item.unit}</td><td className="px-3 py-2 text-right">{item.piece_count}</td><td className="px-3 py-2 text-right">{fmt(item.unit_price)}</td><td className="px-3 py-2 text-right">{fmt(item.income)}</td></tr>))}</tbody>
                </table>
                {!masterReportData.daily_details?.some((day: any) => day.items.length > 0) && <p className="px-4 py-5 text-center text-sm text-gray-500">No confirmed receiving quantities in this period.</p>}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white dark:bg-gray-800">
              <h3 className="border-b px-4 py-3 font-semibold">Other expense detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-155 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-left">Payment</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                  <tbody>{(masterReportData.other_expense_details || []).map((row: any, index: number) => <tr key={row.id || index} className="border-t"><td className="px-3 py-2">{row.date || '—'}</td><td className="px-3 py-2">{row.category_name || row.category_id || 'Uncategorized'}</td><td className="px-3 py-2">{row.description || '—'}</td><td className="px-3 py-2">{row.payment_method || '—'}</td><td className="px-3 py-2 text-right">{fmt(row.amount)}</td></tr>)}</tbody>
                </table>
                {!masterReportData.other_expense_details?.length && <p className="px-4 py-5 text-center text-sm text-gray-500">No other expenses in this period.</p>}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white dark:bg-gray-800">
              <h3 className="border-b px-4 py-3 font-semibold">Saved reports</h3>
              {savedReports.length ? <div className="divide-y">
                {savedReports.map((saved: any) => (
                  <div key={saved.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{saved.title}</p>
                      <p className="text-xs text-gray-500">{saved.start_date} to {saved.end_date} · {fmt(saved.report_data?.total_income || 0)} income</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" title="Load and edit this report" onClick={() => editSavedReport(saved)} className="rounded-md border p-2 hover:bg-gray-50 dark:hover:bg-gray-700"><Pencil size={14} /></button>
                      <button type="button" title="Delete saved report" onClick={() => deleteSavedReport(saved.id)} className="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div> : <p className="px-4 py-5 text-center text-sm text-gray-500">No saved reports.</p>}
            </div>
          </div>
        )
      )}

      {/* Outstanding */}
      {report === 'outstanding' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Outstanding Payments</h2>
          <div className="overflow-x-auto">
          <table className="w-full min-w-140 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-right">Total Billed</th>
                <th className="px-3 py-2 text-right">Total Paid</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {outstandingData.map((o: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-medium">{o.customer_name}</td>
                  <td className="px-3 py-2 text-right">{fmt(o.total_billed)}</td>
                  <td className="px-3 py-2 text-right">{fmt(o.total_paid)}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">{fmt(o.outstanding)}</td>
                </tr>
              ))}
              {outstandingData.length === 0 && (
                <TableEmptyRow colSpan={4} title="No outstanding payments" description="Every client is settled up." />
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
