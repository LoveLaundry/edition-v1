import React from 'react'
import { COMPANY } from '../../../config/company'
import type { MonthlyAnalysis } from '../pages/monthly-operations-page'
import type { MonthlyMatrixResponse } from '../../../types/monthly'
import { formatBillNumber } from '../../../lib/bill-number'

export type MonthlyReportSection = 'summary' | 'daily' | 'items' | 'balances'

interface MonthlyOperationsReportProps {
  data: MonthlyMatrixResponse
  analysis: MonthlyAnalysis
  sections: MonthlyReportSection[]
  /** Show the hotel-code prefix on bill numbers (default: yes). */
  includePrefix?: boolean
}

const reportStyles = `
  @page { size: A4 portrait; margin: 12mm; }
  .mor-root { width: 190mm; margin: 0 auto; color: #17202a; background: #fff; font-family: Georgia, serif; }
  .mor-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid #b91c1c; }
  .mor-brand { color: #991b1b; font-size: 22px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  .mor-title { color: #b91c1c; font-size: 20px; font-weight: 800; letter-spacing: 2px; text-align: right; }
  .mor-meta { display: flex; justify-content: space-between; gap: 14px; margin: 14px 0; font-size: 10px; }
  .mor-box { flex: 1; border: 1px solid #cbd5e1; padding: 8px 10px; }
  .mor-section { margin-top: 16px; break-inside: avoid; }
  .mor-section h2 { margin: 0 0 7px; color: #991b1b; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  .mor-table { width: 100%; border-collapse: collapse; font-size: 8px; }
  .mor-table th, .mor-table td { border: 1px solid #cbd5e1; padding: 5px 4px; }
  .mor-table th { color: #fff; background: #b91c1c; text-align: left; }
  .mor-table td.num { text-align: right; white-space: nowrap; }
  .mor-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; }
  .mor-kpi { border: 1px solid #cbd5e1; padding: 8px; }
  .mor-label { color: #64748b; font-size: 8px; text-transform: uppercase; }
  .mor-value { margin-top: 4px; font-size: 12px; font-weight: 800; }
  .mor-footer { margin-top: 22px; padding-top: 8px; border-top: 2px solid #b91c1c; text-align: center; font-size: 8px; }
  @media print { .mor-root { width: auto; } .mor-table thead { display: table-header-group; } .mor-table tr { break-inside: avoid; } }
`

const money = (value: number) =>
  `LKR ${new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`

const quantity = (value: number) =>
  new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 }).format(value)

const quantityByUnit = (values: { pcs: number; kg: number }) =>
  `${quantity(values.pcs)} pcs · ${quantity(values.kg)} kg`

function formatPeriod(year: number, month: number): string {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}

export const MonthlyOperationsReport = React.forwardRef<
  HTMLDivElement,
  MonthlyOperationsReportProps
>(({ data, analysis, sections, includePrefix = true }, ref) => {
  const included = new Set(sections)
  const activeDays = data.days.filter(
    (day) => day.status !== 'EMPTY' && day.status !== 'CANCELLED',
  )

  return (
    <div ref={ref} className="mor-root">
      <style dangerouslySetInnerHTML={{ __html: reportStyles }} />
      <header className="mor-header">
        <div>
          <div className="mor-brand">{COMPANY.name}</div>
          <div style={{ fontSize: 9 }}>{COMPANY.address.line1}, {COMPANY.address.line2}</div>
          <div style={{ fontSize: 9 }}>Tel: {COMPANY.phone.primary} · {COMPANY.email}</div>
        </div>
        <div>
          <div className="mor-title">MONTHLY REPORT</div>
          <div style={{ textAlign: 'right', fontSize: 9 }}>Operations analytics</div>
        </div>
      </header>

      <div className="mor-meta">
        <div className="mor-box"><strong>Client</strong><br />{data.client_name}</div>
        <div className="mor-box"><strong>Period</strong><br />{formatPeriod(data.year, data.month)}</div>
        <div className="mor-box"><strong>Operation</strong><br />{data.kind}</div>
        <div className="mor-box"><strong>Generated</strong><br />{new Date().toLocaleDateString('en-GB')}</div>
      </div>

      {included.has('summary') && (
        <section className="mor-section">
          <h2>Monthly summary</h2>
          <div className="mor-kpis">
            <div className="mor-kpi"><div className="mor-label">Quoted value</div><div className="mor-value">{money(analysis.quotedValue)}</div></div>
            <div className="mor-kpi"><div className="mor-label">Received</div><div className="mor-value">{quantityByUnit(data.operations_summary.totals.received_qty)}</div></div>
            <div className="mor-kpi"><div className="mor-label">Delivered</div><div className="mor-value">{quantityByUnit(data.operations_summary.totals.delivered_qty)}</div></div>
            <div className="mor-kpi"><div className="mor-label">Outstanding balance</div><div className="mor-value">{quantityByUnit(data.operations_summary.totals.outstanding_delivery_qty)}</div></div>
            <div className="mor-kpi"><div className="mor-label">Curtain weight</div><div className="mor-value">{quantity(analysis.curtainKg)} kg</div></div>
            <div className="mor-kpi"><div className="mor-label">Curtain pieces</div><div className="mor-value">{quantity(Object.values(analysis.itemCurtainPieces).reduce((sum, count) => sum + count, 0))} pcs</div></div>
          </div>
        </section>
      )}

      {included.has('daily') && (
        <section className="mor-section">
          <h2>Daily operations</h2>
          <table className="mor-table">
            <thead><tr><th>Date</th><th>Bill no.</th><th>Status</th><th>Qty</th><th>Curtain kg</th><th>Curtain pcs</th><th>Quoted value</th><th>Gate passes</th><th>Deliveries</th></tr></thead>
            <tbody>
              {activeDays.length === 0 ? (
                <tr><td colSpan={9}>No recorded days.</td></tr>
              ) : activeDays.map((day) => (
                <tr key={day.day}>
                  <td>{day.date || `${data.year}-${String(data.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`}</td>
                  <td>{day.bill_number ? formatBillNumber(day.bill_number, includePrefix) : '—'}</td>
                  <td>{day.status}</td>
                  <td className="num">{quantity(analysis.dayQuantities[day.day] ?? 0)}</td>
                  <td className="num">{quantity(analysis.dayCurtainKg[day.day] ?? 0)}</td>
                  <td className="num">{quantity(analysis.dayCurtainPieces[day.day] ?? 0)}</td>
                  <td className="num">{money(analysis.dayValues[day.day] ?? 0)}</td>
                  <td className="num">{day.gate_pass_ids.length}</td>
                  <td className="num">{day.delivery_ids.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {included.has('items') && (
        <section className="mor-section">
          <h2>Item analytics</h2>
          <table className="mor-table">
            <thead><tr><th>Item</th><th>Unit</th><th>Quantity</th><th>Curtain pcs</th><th>Unit price</th><th>Estimated value</th></tr></thead>
            <tbody>
              {data.rows.map((row) => {
                const key = `${row.item_name}||${row.specification ?? ''}`
                const qty = data.days.reduce(
                  (sum, day) => sum + (day.status === 'CANCELLED' ? 0 : Number(data.cells[key]?.[String(day.day)] ?? 0)),
                  0,
                )
                const pieces = data.days.reduce(
                  (sum, day) => sum + (day.status === 'CANCELLED' ? 0 : Number(day.piece_quantities[key] ?? 0)),
                  0,
                )
                return (
                  <tr key={key}>
                    <td>{[row.item_name, row.specification].filter(Boolean).join(' · ')}</td>
                    <td>{row.unit === 'kg' ? `kg${pieces ? ` / ${quantity(pieces)} pcs` : ''}` : 'pcs'}</td>
                    <td className="num">{quantity(qty)}</td>
                    <td className="num">{pieces ? quantity(pieces) : '—'}</td>
                    <td className="num">{row.has_price ? money(row.unit_price) : '—'}</td>
                    <td className="num">{row.has_price ? money(qty * row.unit_price) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {included.has('balances') && (
        <section className="mor-section">
          <h2>Received gate passes and live balances</h2>
          <table className="mor-table">
            <tbody>
              <tr><th>Active received gate passes</th><td className="num">{data.operations_summary.gate_pass_count}</td><th>Draft gate passes</th><td className="num">{data.operations_summary.draft_gate_pass_count}</td></tr>
              <tr><th>Received quantity</th><td className="num">{quantityByUnit(data.operations_summary.totals.received_qty)}</td><th>Delivered quantity</th><td className="num">{quantityByUnit(data.operations_summary.totals.delivered_qty)}</td></tr>
              <tr><th>Returned for re-send</th><td className="num">{quantityByUnit(data.operations_summary.totals.returned_back_qty)}</td><th>Outstanding delivery</th><td className="num">{quantityByUnit(data.operations_summary.totals.outstanding_delivery_qty)}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      <footer className="mor-footer">
        {COMPANY.name} · {COMPANY.address.line1}, {COMPANY.address.line2} · {COMPANY.phone.primary} · {COMPANY.email}
      </footer>
    </div>
  )
})

MonthlyOperationsReport.displayName = 'MonthlyOperationsReport'
