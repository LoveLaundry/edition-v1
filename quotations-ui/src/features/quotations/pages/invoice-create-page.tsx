import { useMemo, useRef, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, Calendar, FileText, CheckSquare, Square } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { useBills } from '../hooks/useBills'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { BillStatusBadge } from '../../../components/ui/bill-status-badge'
import { PrintTarget } from '../../../components/ui/print-target'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Notice } from '../../../components/ui/notice'
import { formatDate } from '../../../lib/utils'
import { ConsolidatedInvoiceTemplate } from '../components/consolidated-invoice-template'
import type { Bill } from '../../../types/bill'
import { startOfMonthISO, todayISO } from '../../../lib/time'
import { customersApi } from '../../management/api/management-api'
import { SignatureUploadDialog } from '../../../components/ui/signature-upload-dialog'
import { usePrintPrefixChoice } from '../../../lib/use-print-prefix-choice'

interface InvoiceBankDetails {
  bankName: string
  branch: string
  accountName: string
  accountNumber: string
}

interface CustomerAddressEntry {
  name: string
  address?: string | null
}

function defaultThisMonthRange() {
  return { from: startOfMonthISO(), to: todayISO() }
}

function isUnpaid(b: Bill): boolean {
  const st = (b.payment_status || '').toUpperCase()
  if (st === 'PAID' || st === 'CANCELLED') return false
  const outstanding = b.outstanding_amount ?? (b.grand_total ?? b.total_amount) ?? 0
  if (st === 'PENDING' || st === 'PARTIALLY_PAID') return true
  return outstanding > 0
}

export default function InvoiceCreatePage() {
  const init = defaultThisMonthRange()
  const [searchParams] = useSearchParams()
  const billIdsParam = searchParams.get('bill_ids')
  const requestedBillIds = useMemo(
    () => new Set((billIdsParam ?? '').split(',').filter(Boolean)),
    [billIdsParam],
  )
  const clientName = searchParams.get('client_name') || undefined
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') ?? init.from)
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') ?? init.to)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [managerSignature, setManagerSignature] = useState('')
  const [bankDetails, setBankDetails] = useState<InvoiceBankDetails>({
    bankName: '',
    branch: '',
    accountName: '',
    accountNumber: '',
  })
  const [pendingBankDetails, setPendingBankDetails] = useState<InvoiceBankDetails>(bankDetails)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data, isLoading, isError, error } = useBills({
    client_name: clientName,
    gate_pass_date_from: dateFrom || undefined,
    gate_pass_date_to: dateTo || undefined,
    limit: 1000,
  })

  const unpaid = useMemo(() => (data?.items ?? []).filter(isUnpaid), [data])
  const nowStr = todayISO().replace(/-/g, '')
  const invoiceNo = `INV-${nowStr}-${String(unpaid.length + 1).padStart(4, '0')}`

  // Default all unpaid bills as selected whenever the list changes
  useEffect(() => {
    setSelected(prev => {
      if (billIdsParam) {
        return new Set(unpaid.filter(b => requestedBillIds.has(b.id)).map(b => b.id))
      }
      const set = new Set(unpaid.map(b => b.id))
      prev.forEach(id => {
        if (unpaid.some(b => b.id === id)) set.add(id)
      })
      return set
    })
  }, [unpaid, billIdsParam, requestedBillIds])

  const chosen = useMemo(() => unpaid.filter(b => selected.has(b.id)), [unpaid, selected])
  const chosenClientNames = useMemo(
    () => [...new Set(chosen.map((bill) => bill.client_name))],
    [chosen],
  )
  const addressClientName = clientName ?? (chosenClientNames.length === 1 ? chosenClientNames[0] : undefined)
  const {
    data: clientAddress = '',
    isLoading: isClientAddressLoading,
    isError: isClientAddressError,
    error: clientAddressError,
  } = useQuery({
    queryKey: ['invoice-customer-address', addressClientName ?? ''],
    queryFn: async () => {
      if (!addressClientName) return ''
      const response = await customersApi.list(addressClientName, 100, 0)
      const customers: CustomerAddressEntry[] = response.data.items
      return customers.find((customer) => customer.name.trim().toLowerCase() === addressClientName.trim().toLowerCase())?.address ?? ''
    },
    enabled: Boolean(addressClientName),
  })
  const totalOutstanding = chosen.reduce((s, b) => s + (b.outstanding_amount ?? (b.grand_total ?? b.total_amount) ?? 0), 0)

  const allSelected = unpaid.length > 0 && chosen.length === unpaid.length

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(unpaid.map(b => b.id)))
  }
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Consolidated-Invoice-${dateFrom}-${dateTo}`,
  })
  const [includePrefix, setIncludePrefix] = useState(true)
  const { choose: choosePrefix, dialog: prefixDialog } = usePrintPrefixChoice()
  const signatureSlots = useMemo(
    () => [{ id: 'manager', label: 'Laundry manager signature', value: managerSignature }],
    [managerSignature],
  )
  const confirmPrint = (signatures: Record<string, string>) => {
    const details: InvoiceBankDetails = {
      bankName: pendingBankDetails.bankName.trim(),
      branch: pendingBankDetails.branch.trim(),
      accountName: pendingBankDetails.accountName.trim(),
      accountNumber: pendingBankDetails.accountNumber.trim(),
    }
    if (Object.values(details).some((value) => !value)) {
      toast.error('Complete all bank details before printing.')
      return
    }
    if (!signatures.manager) {
      toast.error('Upload the laundry manager signature before printing.')
      return
    }
    setManagerSignature(signatures.manager)
    setBankDetails(details)
    setPrintDialogOpen(false)
    void choosePrefix().then((choice: boolean | null) => {
      if (choice === null) return
      setIncludePrefix(choice)
      window.setTimeout(() => handlePrint(), 180)
    })
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="min-w-0 flex-1">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Bills', href: '/bills' },
              { label: 'Consolidated Invoice' },
            ]}
          />
          <h1 className="text-dashboard-title mt-1">Consolidated Invoice</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {invoiceNo} · Select unpaid bills and generate one professional invoice document.
          </p>
        </div>
        <Button
          onClick={() => {
            setPendingBankDetails(bankDetails)
            setPrintDialogOpen(true)
          }}
          disabled={chosen.length === 0 || isClientAddressLoading}
          className="shrink-0"
        >
          <Printer className="h-4 w-4 mr-2" /> Print Invoice
        </Button>
      </div>

      {isClientAddressError && (
        <div className="print:hidden">
          <Notice tone="warning" title="Customer address could not be loaded">
            {clientAddressError instanceof Error ? clientAddressError.message : 'The invoice can still be printed, but its address may be missing.'}
          </Notice>
        </div>
      )}

      {/* Date range */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>From</span>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-8 pr-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
                />
              </label>
            </div>

            {unpaid.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
              >
                {allSelected ? <CheckSquare className="h-4 w-4 text-[#DC2626]" /> : <Square className="h-4 w-4" />}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Unpaid bills selection */}
      <div className="print:hidden">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState description={error instanceof Error ? error.message : 'Unable to load bills'} />
        ) : unpaid.length === 0 ? (
          <EmptyState
            title="No unpaid bills in this period"
            description="Try widening the date range, or create a bill from an existing quotation."
            action={
              <Link to="/bills/new">
                <Button variant="secondary"><FileText className="h-4 w-4 mr-2" /> New Bill</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                {unpaid.length} unpaid bill{unpaid.length === 1 ? '' : 's'} in range
              </p>
              <p className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{chosen.length}</span> selected · Outstanding{' '}
                <span className="font-bold text-[#DC2626]">LKR {totalOutstanding.toFixed(2)}</span>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {unpaid.map(bill => {
                const checked = selected.has(bill.id)
                const outstanding = bill.outstanding_amount ?? (bill.grand_total ?? bill.total_amount) ?? 0
                return (
                  <button
                    key={bill.id}
                    type="button"
                    onClick={() => toggleOne(bill.id)}
                    className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                      checked
                        ? 'border-[#DC2626] bg-[color-mix(in_srgb,var(--red-600)_6%,var(--surface))] shadow-sm'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {checked
                          ? <CheckSquare className="h-5 w-5 shrink-0 text-[#DC2626]" />
                          : <Square className="h-5 w-5 shrink-0 text-[var(--text-faint)]" />}
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {bill.client_name}
                          </p>
                          <p className="text-[11px] text-[var(--text-faint)] truncate">
                            {bill.id.slice(0, 10).toUpperCase()} · {formatDate(bill.created_at)}
                          </p>
                        </div>
                      </div>
                      <BillStatusBadge status={bill.payment_status} />
                    </div>
                    <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                      <Badge variant="secondary">{bill.total_quantity} items</Badge>
                      <span className="text-[13px] font-bold text-[#DC2626]">LKR {outstanding.toFixed(2)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Hidden Print Template */}
      <PrintTarget>
        <ConsolidatedInvoiceTemplate
          ref={printRef}
          bills={chosen}
          dateFrom={dateFrom}
          dateTo={dateTo}
          invoiceNo={invoiceNo}
          clientAddress={clientAddress}
          managerSignature={managerSignature}
          includePrefix={includePrefix}
          bankDetails={bankDetails}
        />
      </PrintTarget>
      <SignatureUploadDialog
        open={printDialogOpen}
        slots={signatureSlots}
        onClose={() => setPrintDialogOpen(false)}
        onConfirm={confirmPrint}
        title="Prepare invoice for printing"
        description="Upload the laundry manager's PNG signature and enter the bank details to print on this invoice. The values are not saved to the account."
        confirmLabel="Print invoice"
      >
        <div className="space-y-3">
          <div>
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Bank details to print</p>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              All four values are required. They are used for this invoice only and are not saved.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['bankName', 'Bank name'],
              ['branch', 'Branch'],
              ['accountName', 'Account name'],
              ['accountNumber', 'Account number'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] font-medium text-[var(--text-secondary)]">{label}</span>
                <input
                  required
                  value={pendingBankDetails[key]}
                  onChange={(event) =>
                    setPendingBankDetails((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10"
                />
              </label>
            ))}
          </div>
        </div>
      </SignatureUploadDialog>

      {prefixDialog}
    </div>
  )
}
