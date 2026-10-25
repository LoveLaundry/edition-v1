import { useMemo } from 'react'
import { useGatePasses } from './useGatePasses'
import { useQuotations } from './useQuotations'
import { useBills, useUnbilledGatePasses } from './useBills'
import {
  buildPriceIndex,
  isIncomeBearing,
  normalizeName,
  selectQuotationForPass,
  valueGatePass,
  type PriceIndex,
} from '../services/gatepass-income'
import type { Bill } from '../../../types/bill'
import type { GatePass } from '../../../types/operations'
import type { Quotation } from '../../../types/quotation'

export type IncomeBilledStatus = 'UNBILLED' | 'BILLED' | 'PARTIAL' | 'PAID'

export interface IncomeRow {
  pass: GatePass
  date: string
  client: string
  gpNumber: string
  receivedQty: number
  income: number
  unpricedQty: number
  hasUnpriced: boolean
  quotationTitle: string
  quotationBasis: string
  billedStatus: IncomeBilledStatus
  /** 'gate-pass' bills reference the pass directly; 'delivery' bills were raised via its deliveries. */
  billedVia: 'gate-pass' | 'delivery' | null
  billedAmount: number
  paidAmount: number
  outstanding: number
  billIds: string[]
}

export function billTotal(bill: Bill): number {
  return Number(bill.grand_total ?? bill.total_amount ?? 0)
}

export function billPaid(bill: Bill): number {
  return Number(bill.paid_amount ?? 0)
}

export function billOutstanding(bill: Bill): number {
  if (bill.outstanding_amount != null) return Math.max(0, Number(bill.outstanding_amount))
  return Math.max(0, billTotal(bill) - billPaid(bill))
}

export interface GatepassIncome {
  quotations: Quotation[]
  /** Non-cancelled bills in scope (the money-bearing set). */
  bills: Bill[]
  /** Server-side bill total — when it exceeds `bills.length` the list was truncated. */
  billsTotal: number
  rows: IncomeRow[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/**
 * Every received pass valued at its quotation prices, joined with the bills
 * raised against it. Shared by the Income and Ledger tabs so the two agree
 * on what a pass is worth and whether it is billed.
 */
export function useGatepassIncome(scopeClient?: string): GatepassIncome {
  const {
    data: passes = [],
    isLoading: passesLoading,
    isError: passesError,
    refetch: refetchPasses,
  } = useGatePasses(scopeClient ? { client_name: scopeClient } : undefined)
  const {
    data: quotations = [],
    isLoading: quotesLoading,
    isError: quotesError,
    refetch: refetchQuotes,
  } = useQuotations()
  const {
    data: billsResp,
    isLoading: billsLoading,
    isError: billsError,
    refetch: refetchBills,
  } = useBills({
    client_name: scopeClient,
    limit: 500,
  })
  const {
    data: unbilled = [],
    isLoading: unbilledLoading,
    isError: unbilledError,
  } = useUnbilledGatePasses(scopeClient)

  const bills = useMemo(
    () => (billsResp?.items ?? []).filter((b) => b.payment_status !== 'CANCELLED'),
    [billsResp],
  )

  const rows: IncomeRow[] = useMemo(() => {
    const byId = new Map<string, Quotation>()
    const byClient = new Map<string, Quotation[]>()
    for (const q of quotations) {
      byId.set(String(q.id), q)
      const key = normalizeName(q.client_name)
      if (!byClient.has(key)) byClient.set(key, [])
      byClient.get(key)?.push(q)
    }
    const indexCache = new Map<string, PriceIndex>()

    const billsByPass = new Map<string, Bill[]>()
    for (const bill of bills) {
      if (!bill.gate_pass_id) continue
      if (!billsByPass.has(bill.gate_pass_id)) billsByPass.set(bill.gate_pass_id, [])
      billsByPass.get(bill.gate_pass_id)?.push(bill)
    }
    const unbilledIds = new Set<string>()
    for (const u of unbilled) {
      if (u.id) unbilledIds.add(String(u.id))
      if (u.gate_pass_number) unbilledIds.add(`num:${u.gate_pass_number}`)
    }

    const out: IncomeRow[] = []
    for (const pass of passes) {
      if (!isIncomeBearing(pass)) continue
      const clientQuotes = byClient.get(normalizeName(pass.client_name)) ?? []
      const { quotation, basis } = selectQuotationForPass(pass, byId, clientQuotes, indexCache)
      const index = quotation ? (indexCache.get(String(quotation.id)) ?? buildPriceIndex(quotation)) : null
      if (quotation) indexCache.set(String(quotation.id), index as PriceIndex)
      const valued = valueGatePass(pass, index)

      // GP-leg bills reference the pass directly. Delivery-leg bills reference
      // its deliveries instead — those passes are absent from the unbilled
      // list even though no bill points at the pass id.
      const passBills = billsByPass.get(pass.id) ?? []
      const billedAmount = passBills.reduce((s, b) => s + billTotal(b), 0)
      const paidAmount = passBills.reduce((s, b) => s + billPaid(b), 0)
      const outstanding = passBills.reduce((s, b) => s + billOutstanding(b), 0)
      const inUnbilled = unbilledIds.has(pass.id) || unbilledIds.has(`num:${pass.gate_pass_number}`)
      let billedStatus: IncomeBilledStatus = 'UNBILLED'
      let billedVia: 'gate-pass' | 'delivery' | null = null
      if (passBills.length > 0) {
        billedVia = 'gate-pass'
        billedStatus =
          paidAmount >= billedAmount && billedAmount > 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'BILLED'
      } else if (!unbilledError && !inUnbilled && valued.receivedQty > 0) {
        // Absent from the unbilled list with no direct bill: billed through
        // its deliveries. When the unbilled lookup itself failed, stay
        // UNBILLED rather than claiming billed without evidence.
        billedVia = 'delivery'
        billedStatus = 'BILLED'
      }

      out.push({
        pass,
        date: String(pass.receiving_date ?? '').slice(0, 10),
        client: pass.client_name,
        gpNumber: pass.gate_pass_number,
        receivedQty: valued.receivedQty,
        income: valued.income,
        unpricedQty: valued.unpricedQty,
        hasUnpriced: valued.unpricedQty > 0,
        quotationTitle: quotation?.quotation_title || (quotation ? `Quotation ${quotation.id}` : 'No quotation'),
        quotationBasis: basis,
        billedStatus,
        billedVia,
        billedAmount: Math.round(billedAmount * 100) / 100,
        paidAmount: Math.round(paidAmount * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        billIds: passBills.map((b) => b.id),
      })
    }
    out.sort((a, b) => (a.date === b.date ? b.gpNumber.localeCompare(a.gpNumber) : a.date < b.date ? 1 : -1))
    return out
  }, [passes, quotations, bills, unbilled, unbilledError])

  return {
    quotations,
    bills,
    billsTotal: billsResp?.total ?? bills.length,
    rows,
    isLoading: passesLoading || quotesLoading || billsLoading || unbilledLoading,
    isError: passesError || quotesError || billsError,
    refetch: () => {
      refetchPasses()
      refetchQuotes()
      refetchBills()
    },
  }
}
