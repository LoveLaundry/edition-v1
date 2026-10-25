import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, salaryApi, salaryPackagesApi, holidaysApi } from '../api/management-api'
import { buildSalaryForecast, buildRemainingForecast } from '../utils/salary-forecast'
import { toast } from 'sonner'
import { Eye, Printer, Trash2, XCircle, CheckCircle, Wallet, PlayCircle, Settings2, ListChecks, X } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { SalarySlipPrint } from '../components/salary-slip-print'
import { TableEmptyRow } from '../../../components/ui/empty-state'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { Pagination } from '../../../components/ui/pagination'
import { currentMonth, currentYear } from '../../../lib/time'
import { invalidateResource } from '../../../cache/invalidation'
import { Portal } from '../../../components/ui/portal'

const PAGE_SIZE = 20

const CALC_METHOD_LABELS: Record<string, string> = {
  MONTHLY_ATTENDANCE: 'Monthly · attendance',
  FIXED_MONTHLY: 'Monthly · fixed',
  WEEKLY_ATTENDANCE: 'Weekly · attendance',
  WEEKLY_FIXED: 'Weekly · fixed',
  DAILY_WORKED_DAYS: 'Daily · worked days',
  CONTRACT: 'Contract · fixed',
}

const SALARY_TYPE_OPTIONS = ['MONTHLY', 'WEEKLY', 'DAILY', 'CONTRACT']

const PACKAGE_KEYS: (keyof any)[] = ['basic_salary', 'daily_rate', 'weekly_rate', 'contract_amount', 'overtime_rate', 'allowance', 'epf_rate', 'etf_rate']

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  FINALIZED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PAID: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  DELETED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

export default function SalaryHistoryPage() {
  const qc = useQueryClient()
  const slipRef = useRef<HTMLDivElement>(null)
  const [selectedEmp, setSelectedEmp] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(currentYear())
  const [viewSlip, setViewSlip] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'SUMMARY' | 'FULL'>('SUMMARY')
  const [slipLang, setSlipLang] = useState<'EN' | 'SI'>('EN')
  const [payYear, setPayYear] = useState(currentYear())
  const [payMonth, setPayMonth] = useState(currentMonth())
  const [preview, setPreview] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [tab, setTab] = useState<'ACTIVE' | 'DELETED'>('ACTIVE')
  const [offset, setOffset] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const limit = PAGE_SIZE

  useEffect(() => {
    setOffset(0)
  }, [tab, selectedEmp, statusFilter, yearFilter])

  const { data: employees = [] } = useQuery({
    queryKey: ['mgmt-employees'],
    queryFn: () => employeesApi.list('').then(r => r.data),
  })

  const { data: holidaysData = [] } = useQuery({
    queryKey: ['mgmt-holidays', payYear],
    queryFn: () => holidaysApi.list(payYear).then(r => r.data),
  })

  const { data: slipsData = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['salary-slips', tab, selectedEmp, statusFilter, yearFilter, offset, limit],
    queryFn: () => salaryApi.listSlips({
      employee_id: selectedEmp || undefined,
      status: tab === 'ACTIVE' ? (statusFilter || undefined) : undefined,
      deleted: tab === 'DELETED',
      year: yearFilter,
      limit,
      offset,
    }).then(r => {
      const d = r.data
      const items = Array.isArray(d) ? d : d?.items ?? []
      return { items, total: Array.isArray(d) ? d.length : d?.total ?? items.length ?? 0 }
    }),
  })

  const slips = slipsData.items

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const allPageSelected = slips.length > 0 && slips.every((s: any) => selectedIds.includes(s.id))

  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.length === 0) return prev
      const ids = new Set(slips.map((s: any) => s.id))
      const next = prev.filter(id => ids.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [slips])

  const selectedSlips = slips.filter((s: any) => selectedIds.includes(s.id))
  const selTotGross = selectedSlips.reduce((a: number, s: any) => a + (Number(s.total_earnings) || 0), 0)
  const selTotDed = selectedSlips.reduce((a: number, s: any) => a + (Number(s.total_deductions) || 0), 0)
  const selTotNet = selectedSlips.reduce((a: number, s: any) => a + (Number(s.net_salary) || 0), 0)
  const selTotPaid = selectedSlips.reduce((a: number, s: any) => a + (s.paid ? (Number(s.amount_paid) || 0) : 0), 0)
  const selStatusCounts = selectedSlips.reduce((acc: Record<string, number>, s: any) => {
    acc[s.status] = (acc[s.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const selByEmp = [...selectedSlips.reduce((m: Map<string, any>, s: any) => {
    const k = s.employee_id || s.employee_name || 'unknown'
    const cur = m.get(k) || { name: s.employee_name || 'Unknown employee', count: 0, earnings: 0, deductions: 0, net: 0, paid: 0 }
    cur.count += 1
    cur.earnings += Number(s.total_earnings) || 0
    cur.deductions += Number(s.total_deductions) || 0
    cur.net += Number(s.net_salary) || 0
    cur.paid += s.paid ? (Number(s.amount_paid) || 0) : 0
    m.set(k, cur)
    return m
  }, new Map()).values()].sort((a, b) => b.net - a.net)

  const finalizeMut = useMutation({
    mutationFn: (slipId: string) => salaryApi.finalizeSlip(slipId),
    onSuccess: () => { toast.success('Salary slip finalized'); invalidateResource(qc, 'salary') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const cancelMut = useMutation({
    mutationFn: (slipId: string) => salaryApi.cancelSlip(slipId),
    onSuccess: () => { toast.success('Salary slip cancelled'); invalidateResource(qc, 'salary'); setViewSlip(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (slipId: string) => salaryApi.deleteSlip(slipId),
    onSuccess: () => { toast.success('Salary slip deleted'); invalidateResource(qc, 'salary'); setViewSlip(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const payMut = useMutation({
    mutationFn: ({ slipId, amount }: { slipId: string; amount: number }) => salaryApi.paySlip(slipId, amount),
    onSuccess: () => { toast.success('Marked as paid'); invalidateResource(qc, 'salary'); setViewSlip(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const handleMarkPaid = (slip: any) => {
    const amount = prompt('Payment amount (LKR):', String(slip.net_salary ?? slip.total_earnings ?? 0))
    if (amount === null) return
    const n = Number(amount)
    if (!n || n <= 0) { toast.error('Enter a valid amount'); return }
    payMut.mutate({ slipId: slip.id, amount: n })
  }

  const loadPreview = async () => {
    setPreviewLoading(true)
    try {
      const r = await salaryApi.payrollPreview(payYear, payMonth)
      setPreview(r.data)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const runPayroll = async () => {
    if (!confirm(`Create salary slips for ${payYear}-${payMonth} for all active employees?`)) return
    setPayrollLoading(true)
    try {
      const r = await salaryApi.payrollRun(payYear, payMonth)
      toast.success(`${r.data.created?.length ?? 0} slip(s) created, ${r.data.skipped?.length ?? 0} skipped`)
      setPreview(null)
      invalidateResource(qc, 'salary')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Payroll run failed')
    } finally {
      setPayrollLoading(false)
    }
  }

  const handlePrint = useReactToPrint({
    contentRef: slipRef,
    documentTitle: viewSlip?.slip_number ? `SalarySlip-${viewSlip.slip_number}` : 'SalarySlip',
  })

  const formatNumber = (value: unknown) => Number(value ?? 0).toLocaleString()
  const lkr = (n: number | string | null | undefined) => 'LKR ' + Number(n || 0).toLocaleString('en-LK')

  const [overrideEmp, setOverrideEmp] = useState<any>(null)
  const [overrideMonth, setOverrideMonth] = useState('')

  const overrideMut = useMutation({
    mutationFn: (data: any) => salaryPackagesApi.upsert(data),
    onSuccess: () => { toast.success('Month arrangement saved'); invalidateResource(qc, 'salary'); setOverrideEmp(null); setPreview(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const openOverride = (row: any) => {
    setOverrideMonth(`${payYear}-${String(payMonth).padStart(2, '0')}`)
    setOverrideEmp({
      employee_id: row.employee_id,
      name: row.employee_name,
      salary_type: row.salary_type || 'MONTHLY',
      attendance_required: row.attendance_required !== false,
      basic_salary: row.basic_salary || 0,
      daily_rate: row.daily_rate || 0,
      weekly_rate: row.weekly_rate || 0,
      contract_amount: row.contract_amount || 0,
      overtime_rate: row.overtime_rate || 0,
      allowance: row.allowance || 0,
      allowance_type: row.allowance_type || 'FIXED',
      epf_rate: row.epf_rate || 0,
      etf_rate: row.etf_rate || 0,
      epf_base: row.epf_base || 'ADJUSTED',
    })
  }

  const projectRow = (row: any) =>
    buildSalaryForecast(row, row.overtime_hours || 0, { year: payYear, month: payMonth, holidays: holidaysData })

  const remainingRow = (row: any) =>
    buildRemainingForecast(row, { year: payYear, month: payMonth, holidays: holidaysData })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salary History</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('ACTIVE')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'ACTIVE'
            ? 'border-red-600 text-red-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Active Slips
        </button>
        <button
          onClick={() => setTab('DELETED')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'DELETED'
            ? 'border-red-600 text-red-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Deleted Slips
        </button>
      </div>

      {/* Payroll Run card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <PlayCircle size={18} /> Run Payroll
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year</label>
            <input type="number" value={payYear} onChange={e => setPayYear(Number(e.target.value))}
              className="w-28 mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Month</label>
            <select value={payMonth} onChange={e => setPayMonth(Number(e.target.value))}
              className="w-40 mt-1 px-3 py-2 border rounded-lg text-sm">
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <button onClick={loadPreview} disabled={previewLoading || payrollLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {previewLoading ? 'Previewing...' : 'Preview Month'}
          </button>
          <button onClick={runPayroll} disabled={payrollLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {payrollLoading ? 'Running...' : 'Run Payroll (DRAFT all missing)'}
          </button>
        </div>

        {preview && (
          <div className="mt-4 border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div><div className="text-2xl font-bold">{preview.count}</div><div className="text-xs text-gray-400">Employees</div></div>
              <div><div className="text-2xl font-bold text-red-600">LKR {formatNumber(preview.total_gross)}</div><div className="text-xs text-gray-400">Gross Total</div></div>
              <div><div className="text-2xl font-bold text-red-600">LKR {formatNumber(preview.total_deductions)}</div><div className="text-xs text-gray-400">Deductions</div></div>
              <div><div className="text-2xl font-bold text-green-600">LKR {formatNumber(preview.total_net)}</div><div className="text-xs text-gray-400">Net Payroll</div></div>
              <div className="text-xs text-gray-400">Missing slips will be created on Run Payroll. Existing slips are skipped.</div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800/60 dark:bg-indigo-900/10 p-3">
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-2">Projection — if every employee attends all remaining working days</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-xl font-bold text-indigo-700 dark:text-indigo-200">LKR {formatNumber(preview.projected_total_gross)}</div><div className="text-xs text-gray-400">Gross Total</div></div>
                <div><div className="text-xl font-bold text-indigo-700 dark:text-indigo-200">LKR {formatNumber(preview.projected_total_deductions)}</div><div className="text-xs text-gray-400">Deductions</div></div>
                <div><div className="text-xl font-bold text-indigo-700 dark:text-indigo-200">LKR {formatNumber(preview.projected_total_net)}</div><div className="text-xs text-gray-400">Net Payroll</div></div>
                <div><div className="text-xl font-bold text-green-700 dark:text-green-300">+ LKR {formatNumber(preview.projected_total_net_variance)}</div><div className="text-xs text-gray-400">Additional if all attend</div></div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-700/50 text-left">
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Salary Type</th>
                    <th className="px-3 py-2 font-medium">Arrangement</th>
                    <th className="px-3 py-2 font-medium">Attendance</th>
                    <th className="px-3 py-2 font-medium text-right">Base (Period)</th>
                    <th className="px-3 py-2 font-medium text-right">Net</th>
                    <th className="px-3 py-2 font-medium text-right">Month if all attend</th>
                    <th className="px-3 py-2 font-medium text-right">Remaining days if attend</th>
                    <th className="px-3 py-2 font-medium">Existing Slip</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.employees || []).map((row: any) => (
                    <tr key={row.employee_id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 font-medium">{row.employee_name}</td>
                      <td className="px-3 py-2">{row.salary_type || 'MONTHLY'}</td>
                      <td className="px-3 py-2 text-xs">{CALC_METHOD_LABELS[row.calculation_method] || row.calculation_method || '—'}</td>
                      <td className="px-3 py-2">{row.attendance_required !== false ? 'Required' : <span className="text-amber-600 font-medium">Not required (fixed)</span>}</td>
                      <td className="px-3 py-2 text-right">LKR {formatNumber(row.base_salary_for_period)}</td>
                      <td className="px-3 py-2 text-right font-semibold">LKR {formatNumber(row.net_salary)}</td>
                      <td className="px-3 py-2 text-right" title={`Projection if all remaining working days are attended (base + allowance + OT so far − EPF)`}>
                        {(() => {
                          const f = projectRow(row)
                          const extra = f.projected - (row.net_salary || 0)
                          return (
                            <>
                              <span className="font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">LKR {formatNumber(f.projected)}</span>
                              {extra > 0 && (
                                <span className="block text-[10px] text-green-600 dark:text-green-400">+ LKR {formatNumber(extra)} if all attend</span>
                              )}
                            </>
                          )
                        })()}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        title={`Working days left in the month: ${remainingRow(row).remaining_working_days} — extra the employee can earn if they attend them all (base + allowance pro-rata; OT not assumed)`}>
                        {(() => {
                          const r = remainingRow(row)
                          return (
                            <>
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">+ LKR {formatNumber(r.remaining_amount)}</span>
                              <span className="block text-[10px] text-gray-400">{r.remaining_working_days} working days left</span>
                            </>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.existing_slip_status ? <span className="text-green-600">{row.existing_slip_status}</span> : <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => openOverride(row)}
                          disabled={!!row.existing_slip_id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={row.existing_slip_id ? 'A slip already exists for this month — finalize-protected' : 'Override this month\'s arrangement before running payroll'}>
                          <Settings2 size={12} /> Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Employee</label>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="">All Employees</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          {tab === 'ACTIVE' && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="FINALIZED">Finalized</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year</label>
            <input type="number" value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-500 py-2">{slipsData.total} slip{slipsData.total !== 1 ? 's' : ''} found</div>
          </div>
        </div>
      </div>

      {selectedSlips.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ListChecks size={20} /> Selected Slips Summary — {selectedSlips.length} slip{selectedSlips.length !== 1 ? 's' : ''}
            </h2>
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1">
              <X size={14} /> Clear selection
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <div className="text-xl font-bold">{selectedSlips.length}</div>
              <div className="text-xs text-gray-400">Slips Selected</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <div className="text-xl font-bold text-red-600">LKR {formatNumber(selTotGross)}</div>
              <div className="text-xs text-gray-400">Total Earnings (Gross)</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <div className="text-xl font-bold text-red-600">- LKR {formatNumber(selTotDed)}</div>
              <div className="text-xs text-gray-400">Total Deductions</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <div className="text-xl font-bold text-green-600">LKR {formatNumber(selTotNet)}</div>
              <div className="text-xs text-gray-400">Total Net Salary</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <div className="text-xl font-bold text-sky-600">LKR {formatNumber(selTotPaid)}</div>
              <div className="text-xs text-gray-400">Total Paid{selTotNet > selTotPaid ? ` · ${formatNumber(selTotNet - selTotPaid)} outstanding` : ''}</div>
            </div>
          </div>

          {Object.keys(selStatusCounts).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.entries(selStatusCounts) as [string, number][]).map(([st, c]) => (
                <span key={st} className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[st] || ''}`}>
                  {st} · {c}
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-700/50 text-left">
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">Slips</th>
                  <th className="px-3 py-2 font-medium text-right">Earnings</th>
                  <th className="px-3 py-2 font-medium text-right">Deductions</th>
                  <th className="px-3 py-2 font-medium text-right">Net</th>
                  <th className="px-3 py-2 font-medium text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {selByEmp.map((row: any) => (
                  <tr key={row.name} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-right">{row.count}</td>
                    <td className="px-3 py-2 text-right">LKR {formatNumber(row.earnings)}</td>
                    <td className="px-3 py-2 text-right text-red-600">LKR {formatNumber(row.deductions)}</td>
                    <td className="px-3 py-2 text-right font-semibold">LKR {formatNumber(row.net)}</td>
                    <td className="px-3 py-2 text-right text-sky-600">LKR {formatNumber(row.paid)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <td className="px-3 py-2 font-bold">Totals</td>
                  <td className="px-3 py-2 text-right font-bold">{selectedSlips.length}</td>
                  <td className="px-3 py-2 text-right font-bold">LKR {formatNumber(selTotGross)}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">LKR {formatNumber(selTotDed)}</td>
                  <td className="px-3 py-2 text-right font-bold text-green-600">LKR {formatNumber(selTotNet)}</td>
                  <td className="px-3 py-2 text-right font-bold text-sky-600">LKR {formatNumber(selTotPaid)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    className="rounded cursor-pointer"
                    checked={allPageSelected}
                    title="Select all slips on this page"
                    onChange={() => {
                      if (allPageSelected) setSelectedIds(prev => prev.filter(id => !slips.some((s: any) => s.id === id)))
                      else setSelectedIds(prev => [...new Set([...prev, ...slips.map((s: any) => s.id)])])
                    }}
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Slip #</th>
                <th className="text-left px-4 py-3 font-medium">Employee</th>
                <th className="text-left px-4 py-3 font-medium">Arrangement</th>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-right px-4 py-3 font-medium">Earnings</th>
                <th className="text-right px-4 py-3 font-medium">Deductions</th>
                <th className="text-right px-4 py-3 font-medium">Net Salary</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="text-center py-8"><LoadingSpinner size="sm" /></td></tr>
              ) : slipsData.items.length === 0 ? (
                <TableEmptyRow
                  colSpan={10}
                  title={tab === 'DELETED' ? 'No deleted salary slips' : 'No salary slips found'}
                  description={tab === 'DELETED' ? 'Slips you delete will be listed here.' : 'Generated salary slips will appear here.'}
                />
              ) : (
                slips.map((slip: any) => (
                  <tr key={slip.id} onClick={() => { setViewSlip(slip); setViewMode('SUMMARY') }}
                    className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" title="Click to view summary">
                    <td className="px-4 py-3 w-8" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer"
                        checked={selectedIds.includes(slip.id)}
                        onChange={() => toggleSelect(slip.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{slip.slip_number}</td>
                    <td className="px-4 py-3">{slip.employee_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {CALC_METHOD_LABELS[slip.calculation_method] || slip.calculation_method || slip.salary_type || '—'}
                      {slip.attendance_required === false && <span className="ml-1 text-amber-600 font-medium">· fixed</span>}
                    </td>
                    <td className="px-4 py-3">{slip.period_start}</td>
                    <td className="px-4 py-3 text-right">LKR {formatNumber(slip.total_earnings)}</td>
                    <td className="px-4 py-3 text-right text-red-600">LKR {formatNumber(slip.total_deductions)}</td>
                    <td className="px-4 py-3 text-right font-semibold">LKR {formatNumber(slip.net_salary)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[slip.status] || ''}`}>
                          {slip.status}
                        </span>
                        {slip.paid && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title={`Paid ${slip.paid_date} — LKR ${slip.amount_paid}`}>
                            Paid LKR {formatNumber(slip.amount_paid)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setViewSlip(slip); setViewMode('SUMMARY') }} className="p-1.5 hover:bg-gray-100 rounded" title="View summary">
                          <Eye size={14} />
                        </button>
                        {slip.status === 'DRAFT' && (
                          <button onClick={() => finalizeMut.mutate(slip.id)} className="p-1.5 hover:bg-green-100 text-green-600 rounded" title="Finalize" disabled={finalizeMut.isPending}>
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {slip.status === 'FINALIZED' && !slip.paid && (
                          <button onClick={() => handleMarkPaid(slip)} className="p-1.5 hover:bg-sky-100 text-sky-600 rounded" title="Mark Paid" disabled={payMut.isPending}>
                            <Wallet size={14} />
                          </button>
                        )}
                        {slip.status !== 'PAID' && slip.status !== 'CANCELLED' && slip.status !== 'DELETED' && (
                          <button
                            onClick={() => { if (confirm('Cancel this salary slip? Advances will be restored.')) cancelMut.mutate(slip.id) }}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded" title="Cancel" disabled={cancelMut.isPending}>
                            <XCircle size={14} />
                          </button>
                        )}
                        {slip.status === 'CANCELLED' && (
                          <button
                            onClick={() => { if (confirm('Delete this cancelled salary slip? It will be moved to the Deleted section and excluded from all calculations.')) deleteMut.mutate(slip.id) }}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded" title="Delete" disabled={deleteMut.isPending}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination total={slipsData.total} limit={limit} offset={offset} onChange={setOffset} className="px-1" />

      {overrideEmp && (
        <Portal><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-semibold flex items-center gap-2"><Settings2 size={18} /> Adjust Month Arrangement</h3>
              <button onClick={() => setOverrideEmp(null)} aria-label="Close"><XCircle size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {overrideEmp.name} · {overrideMonth} — saved as a per-month override for this employee. Past finalized months are never changed.
            </p>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data: any = { ...overrideEmp }
              PACKAGE_KEYS.forEach(k => { data[k] = Number(fd.get(k as string)) || 0 })
              data.salary_type = fd.get('salary_type') as string
              data.allowance_type = (fd.get('allowance_type') as string) || 'FIXED'
              data.epf_base = (fd.get('epf_base') as string) || 'ADJUSTED'
              data.attendance_required = fd.get('attendance_required') === 'on'
              data.month = overrideMonth
              data.salary_components = []
              overrideMut.mutate(data)
            }} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Pay Frequency</label>
                <select name="salary_type" defaultValue={overrideEmp.salary_type || 'MONTHLY'} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {SALARY_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="attendance_required" type="checkbox" defaultChecked={overrideEmp.attendance_required !== false} className="rounded" />
                Attendance required for salary <span className="text-[11px] text-gray-400">(off = fixed amount, attendance not needed)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Basic Salary (month)</label>
                  <input name="basic_salary" type="number" step="0.01" defaultValue={overrideEmp.basic_salary} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Daily Rate</label>
                  <input name="daily_rate" type="number" step="0.01" defaultValue={overrideEmp.daily_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Weekly Rate</label>
                  <input name="weekly_rate" type="number" step="0.01" defaultValue={overrideEmp.weekly_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Contract Amount</label>
                  <input name="contract_amount" type="number" step="0.01" defaultValue={overrideEmp.contract_amount} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Overtime Rate (LKR/hr)</label>
                  <input name="overtime_rate" type="number" step="0.01" defaultValue={overrideEmp.overtime_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Allowance</label>
                  <input name="allowance" type="number" step="0.01" defaultValue={overrideEmp.allowance} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Allowance Type</label>
                  <select name="allowance_type" defaultValue={overrideEmp.allowance_type || 'FIXED'} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="FIXED">Fixed</option>
                    <option value="ADJUSTED">Adjusted</option>
                    <option value="ATTENDANCE">Attendance</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">EPF Base</label>
                  <select name="epf_base" defaultValue={overrideEmp.epf_base || 'ADJUSTED'} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="ADJUSTED">Adjusted</option>
                    <option value="ATTENDANCE">Attendance</option>
                    <option value="FULL">Full</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">EPF Rate %</label>
                  <input name="epf_rate" type="number" step="0.01" defaultValue={overrideEmp.epf_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">ETF Rate %</label>
                  <input name="etf_rate" type="number" step="0.01" defaultValue={overrideEmp.etf_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOverrideEmp(null)} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={overrideMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">{overrideMut.isPending ? 'Saving…' : 'Save Arrangement'}</button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}

      {viewSlip && (
        <Portal><div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b px-6 py-3 flex items-center justify-between z-10 flex-wrap gap-2">
              <h3 className="font-semibold">{viewSlip.slip_number} — {viewSlip.employee_name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 border rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('SUMMARY')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${viewMode === 'SUMMARY' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    Summary
                  </button>
                  <button
                    onClick={() => setViewMode('FULL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${viewMode === 'FULL' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    Full Slip
                  </button>
                </div>
                {viewMode === 'FULL' && (
                  <div className="flex items-center gap-1 border rounded-lg p-1">
                    <button
                      onClick={() => setSlipLang('EN')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium ${slipLang === 'EN' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      English
                    </button>
                    <button
                      onClick={() => setSlipLang('SI')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium ${slipLang === 'SI' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      සිංහල
                    </button>
                  </div>
                )}
                <button onClick={() => handlePrint()} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1">
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setViewSlip(null)} className="p-1.5 hover:bg-gray-100 rounded">
                  <XCircle size={18} />
                </button>
              </div>
            </div>
            <div className="p-6" ref={slipRef}>
              {viewMode === 'SUMMARY' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[viewSlip.status] || ''}`}>
                      {viewSlip.status}
                    </span>
                    {viewSlip.paid && (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Paid {lkr(viewSlip.amount_paid)}{viewSlip.paid_date ? ` · ${viewSlip.paid_date}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border p-5 space-y-3">
                      <h3 className="font-semibold text-lg">Period & Attendance</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Employee</span><span className="font-medium">{viewSlip.employee_name}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Salary Type</span><span className="font-medium">{viewSlip.salary_type || '-'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-medium">{CALC_METHOD_LABELS[viewSlip.calculation_method] || viewSlip.calculation_method || '-'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Period</span><span className="font-medium">{viewSlip.period_start} → {viewSlip.period_end}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-medium">{(viewSlip.created_at || '').slice(0, 10) || '-'}</span></div>
                        {viewSlip.attendance_required !== false && (
                          <>
                            <div className="flex justify-between"><span className="text-gray-500">Worked Days</span><span className="font-medium text-green-600">{viewSlip.worked_days ?? '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Leave Days</span><span className="font-medium text-blue-600">{viewSlip.leave_days ?? '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Absent Days</span><span className="font-medium text-red-600">{viewSlip.absent_days ?? '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Calendar / Working Days</span><span className="font-medium">{viewSlip.calendar_days ?? '-'} / {viewSlip.working_days ?? '-'}</span></div>
                          </>
                        )}
                        {viewSlip.epf_employee > 0 && (
                          <div className="flex justify-between"><span className="text-gray-500">EPF Base</span><span className="font-medium">{viewSlip.epf_base || '-'}</span></div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border p-5 space-y-3">
                      <h3 className="font-semibold text-lg">Earnings & Deductions Summary</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Base Salary (Period)</span><span>{lkr(viewSlip.base_salary_for_period)}</span></div>
                        {viewSlip.overtime_pay > 0 && <div className="flex justify-between"><span>Overtime ({viewSlip.overtime_hours} hrs)</span><span>{lkr(viewSlip.overtime_pay)}</span></div>}
                        {viewSlip.extra_work_total > 0 && <div className="flex justify-between"><span>Extra Work</span><span>{lkr(viewSlip.extra_work_total)}</span></div>}
                        {viewSlip.bonus > 0 && <div className="flex justify-between"><span>Bonus</span><span>{lkr(viewSlip.bonus)}</span></div>}
                        {viewSlip.other_payments > 0 && <div className="flex justify-between"><span>Other Payments</span><span>{lkr(viewSlip.other_payments)}</span></div>}
                        {viewSlip.allowance_for_period > 0 && <div className="flex justify-between"><span>Allowance</span><span>{lkr(viewSlip.allowance_for_period)}</span></div>}
                        <div className="border-t pt-2 flex justify-between"><span className="font-medium">Total Earnings</span><span className="font-bold">{lkr(viewSlip.total_earnings)}</span></div>
                        {viewSlip.epf_employee > 0 && <div className="flex justify-between"><span>EPF (Employee)</span><span className="text-red-600">- {lkr(viewSlip.epf_employee)}</span></div>}
                        {viewSlip.advance_deductions > 0 && <div className="flex justify-between"><span>Advance Deductions</span><span className="text-red-600">- {lkr(viewSlip.advance_deductions)}</span></div>}
                        {viewSlip.loan_deduction > 0 && <div className="flex justify-between"><span>Loan Deduction</span><span className="text-red-600">- {lkr(viewSlip.loan_deduction)}</span></div>}
                        {viewSlip.other_deductions > 0 && <div className="flex justify-between"><span>Other Deductions</span><span className="text-red-600">- {lkr(viewSlip.other_deductions)}</span></div>}
                        <div className="border-t pt-2 space-y-1.5">
                          <div className="flex justify-between"><span className="font-medium">Total Deductions</span><span className="font-bold text-red-600">- {lkr(viewSlip.total_deductions)}</span></div>
                          <div className="flex justify-between text-lg"><span className="font-bold">Net Salary</span><span className="font-bold text-green-600">{lkr(viewSlip.net_salary)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <SalarySlipPrint slip={viewSlip} lang={slipLang} />
              )}
            </div>
          </div>
        </div></Portal>
      )}
    </div>
  )
}