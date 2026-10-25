import type { GatePass } from '../../../types/operations'
import type { Quotation } from '../../../types/quotation'

/**
 * Gate-pass income valuation (shared by the Income and Ledger tabs).
 *
 * Domain rule: income accrues when linen is RECEIVED, valued as
 * `received_qty × quotation unit price` per line. Bills only record whether
 * that income has been billed, and bill payments record whether it has been
 * received as cash. So neither bills nor management transactions are the
 * income source — gate passes priced by quotations are.
 *
 * This mirrors the server's pricing semantics:
 * - price lookup is `(item_name, specification)` with a fallback to the
 *   item-level price when a specification has no own price;
 * - `rewashed` lines are free re-wash and never accrue income;
 * - DRAFT / CANCELLED passes carry no income.
 */

export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** `item||spec` → unit price, item-level rows stored under `item||`. */
export type PriceIndex = Map<string, number>

export function buildPriceIndex(quotation: Quotation): PriceIndex {
  const index: PriceIndex = new Map()
  for (const line of quotation.line_items ?? []) {
    const name = normalizeName(line.item_name)
    if (!name) continue
    const base = Number(line.unit_price)
    if (Number.isFinite(base) && base > 0 && !index.has(`${name}||`)) {
      index.set(`${name}||`, base)
    }
    for (const spec of line.specifications ?? []) {
      const specName = normalizeName(spec.specification)
      const specPrice = Number(spec.unit_price)
      if (specName && Number.isFinite(specPrice) && specPrice > 0) {
        index.set(`${name}||${specName}`, specPrice)
      }
    }
  }
  return index
}

/** Specification price first, item-level price as fallback, else null. */
export function priceFor(
  index: PriceIndex,
  itemName: string,
  specification?: string | null,
): number | null {
  const name = normalizeName(itemName)
  const spec = normalizeName(specification)
  if (name && spec && index.has(`${name}||${spec}`)) {
    return index.get(`${name}||${spec}`) ?? null
  }
  if (name && index.has(`${name}||`)) {
    return index.get(`${name}||`) ?? null
  }
  return null
}

export type QuotationBasis = 'gate-pass' | 'client-best' | 'none'

/**
 * Pick the quotation that prices a gate pass:
 * 1. the pass's own `quotation_id` when it resolves, else
 * 2. the same client's quotation covering the most received lines, else
 * 3. none (the pass stays unpriced until a quotation is linked).
 */
export function selectQuotationForPass(
  pass: GatePass,
  byId: Map<string, Quotation>,
  clientQuotations: Quotation[],
  indexCache: Map<string, PriceIndex>,
): { quotation: Quotation | null; basis: QuotationBasis } {
  const ownId = pass.quotation_id ? String(pass.quotation_id) : ''
  if (ownId && byId.has(ownId)) {
    return { quotation: byId.get(ownId) ?? null, basis: 'gate-pass' }
  }
  let best: Quotation | null = null
  let bestCoverage = 0
  let bestBreadth = -1
  for (const candidate of clientQuotations) {
    const index = indexCache.get(String(candidate.id)) ?? buildPriceIndex(candidate)
    indexCache.set(String(candidate.id), index)
    let coverage = 0
    for (const item of pass.items ?? []) {
      if (item.rewashed) continue
      if (!(Number(item.received_qty) > 0)) continue
      if (priceFor(index, item.item_name, item.specification) != null) coverage += 1
    }
    const breadth = (candidate.line_items ?? []).length
    if (coverage > bestCoverage || (coverage === bestCoverage && coverage > 0 && breadth > bestBreadth)) {
      best = candidate
      bestCoverage = coverage
      bestBreadth = breadth
    }
  }
  if (best && bestCoverage > 0) return { quotation: best, basis: 'client-best' }
  return { quotation: null, basis: 'none' }
}

export interface ValuedLine {
  item_name: string
  specification: string
  qty: number
  unit_price: number | null
  line_total: number
  priced: boolean
}

export interface ValuedPass {
  income: number
  receivedQty: number
  unpricedQty: number
  lines: ValuedLine[]
}

/** Value one pass's received lines at quotation prices. */
export function valueGatePass(pass: GatePass, index: PriceIndex | null): ValuedPass {
  const lines: ValuedLine[] = []
  let income = 0
  let receivedQty = 0
  let unpricedQty = 0

  for (const item of pass.items ?? []) {
    const qty = Number(item.received_qty) || 0
    if (item.rewashed) continue
    if (!(qty > 0)) continue
    receivedQty += qty
    const unit = index ? priceFor(index, item.item_name, item.specification) : null
    const priced = unit != null && unit > 0
    const lineTotal = priced ? Math.round(qty * (unit as number) * 100) / 100 : 0
    const line: ValuedLine = {
      item_name: item.item_name,
      specification: item.specification ?? '',
      qty,
      unit_price: priced ? (unit as number) : null,
      line_total: lineTotal,
      priced,
    }
    lines.push(line)
    if (priced) {
      income += lineTotal
    } else {
      unpricedQty += qty
    }
  }

  return {
    income: Math.round(income * 100) / 100,
    receivedQty,
    unpricedQty,
    lines,
  }
}

export function isIncomeBearing(pass: GatePass): boolean {
  return pass.status !== 'DRAFT' && pass.status !== 'CANCELLED'
}
