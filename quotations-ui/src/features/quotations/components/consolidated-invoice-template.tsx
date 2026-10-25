import React from 'react'
import { type Bill, type BillItem } from '../../../types/bill'
import { COMPANY } from '../../../config/company'
import { formatBillNumber } from '../../../lib/bill-number'

interface ConsolidatedInvoiceTemplateProps {
  bills: Bill[]
  dateFrom?: string
  dateTo?: string
  invoiceNo: string
  clientAddress?: string
  managerSignature?: string
  /** Show the hotel-code prefix on bill numbers (default: yes). */
  includePrefix?: boolean
  bankDetails?: {
    bankName: string
    branch: string
    accountName: string
    accountNumber: string
  }
}

interface InvoiceColumn {
  key: string
  itemName: string
  label: string
  measure: 'quantity' | 'pieces'
}

const printStyles = `
  @page { size: A4 portrait; margin: 12mm; }
  .inv-root { width: 190mm; margin: 0 auto; background: white; color: #17202a; }
  .inv-page { min-height: 270mm; position: relative; padding-bottom: 22mm; }
  .inv-brand { display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 3px solid #b91c1c; padding-bottom: 12px; }
  .inv-brand img { width: 68px; height: 68px; object-fit: contain; }
  .inv-title { color: #b91c1c; font-size: 26px; letter-spacing: 3px; font-weight: 800; text-align: right; }
  .inv-table { width: 100%; border-collapse: collapse; font-size: 8px; table-layout: auto; }
  .inv-table th, .inv-table td { border: 1px solid #cbd5e1; padding: 5px 4px; vertical-align: middle; }
  .inv-table th { color: white; background: #b91c1c; text-align: center; font-weight: 700; }
  .inv-table td { text-align: center; overflow-wrap: anywhere; }
  .inv-table td.item-name { text-align: left; }
  .inv-table td.num { text-align: right; white-space: nowrap; }
  .inv-table tbody tr:nth-child(even) { background: #fff7ed; }
  .inv-table tfoot td { background: #fef3c7; font-weight: 800; }
  .inv-box { border: 1px solid #cbd5e1; padding: 10px 12px; }
  .inv-section-title { color: #991b1b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .inv-footer { position: absolute; bottom: 0; left: 0; right: 0; border-top: 2px solid #b91c1c; padding-top: 8px; text-align: center; font-size: 9px; }
  .inv-sign { display: flex; justify-content: space-between; gap: 30px; margin-top: 28px; text-align: center; font-size: 10px; font-weight: 700; }
  .inv-sign-block { display: flex; width: 42%; flex-direction: column; justify-content: flex-end; }
  .inv-sign-line { display: block; border-top: 1px solid #111827; padding-top: 5px; }
  .inv-sign-image { display: block; max-width: 140px; height: 38px; margin: 0 auto 4px; object-fit: contain; }
  .inv-terms-page { margin-top: 24px; border-top: 1px dashed #94a3b8; padding-top: 24px; }
  @media print {
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .inv-root { width: auto; margin: 0; }
    .inv-page { min-height: 270mm; page-break-inside: avoid; break-inside: avoid; }
    .inv-terms-page { margin: 0; padding-top: 0; border: 0; page-break-before: always; break-before: page; }
    .inv-table thead { display: table-header-group; }
    .inv-table tr { page-break-inside: avoid; break-inside: avoid; }
  }
`

function formatInvoiceDate(value?: string): string {
  if (!value) return '—'
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

function itemUnit(item: BillItem): 'kg' | 'pcs' {
  if (item.unit === 'kg') return 'kg'
  if (item.unit === 'pcs') return 'pcs'
  return item.item_name.toLowerCase().includes('curtain') ? 'kg' : 'pcs'
}

function buildItemColumns(bills: Bill[]): InvoiceColumn[] {
  const columns: InvoiceColumn[] = []
  const seen = new Set<string>()
  for (const bill of bills) {
    for (const item of bill.items) {
      const unit = itemUnit(item)
      const kgKey = `${item.item_name}::kg`
      const itemKey = `${item.item_name}::item`
      if (unit === 'kg') {
        if (!seen.has(kgKey)) {
          columns.push({ key: kgKey, itemName: item.item_name, label: `${item.item_name} (kg)`, measure: 'quantity' })
          seen.add(kgKey)
        }
        if (item.item_name.toLowerCase().includes('curtain')) {
          const pieceKey = `${item.item_name}::pieces`
          if (!seen.has(pieceKey)) {
            columns.push({ key: pieceKey, itemName: item.item_name, label: `${item.item_name} (pcs)`, measure: 'pieces' })
            seen.add(pieceKey)
          }
        }
      } else if (!seen.has(itemKey)) {
        columns.push({ key: itemKey, itemName: item.item_name, label: item.item_name, measure: 'quantity' })
        seen.add(itemKey)
      }
    }
  }
  return columns
}

function quantityFor(bill: Bill, column: InvoiceColumn): number {
  return bill.items
    .filter((item) => item.item_name === column.itemName)
    .reduce((sum, item) => sum + (column.measure === 'pieces' ? item.piece_count ?? 0 : item.quantity), 0)
}

export const ConsolidatedInvoiceTemplate = React.forwardRef<HTMLDivElement, ConsolidatedInvoiceTemplateProps>(
  ({ bills, dateFrom, dateTo, invoiceNo, clientAddress, managerSignature, includePrefix = true, bankDetails }, ref) => {
    const invoiceBills = bills.filter((bill) => bill.payment_status !== 'CANCELLED')
    const itemColumns = buildItemColumns(invoiceBills)
    const clientNames = [...new Set(invoiceBills.map((bill) => bill.client_name))]
    const clientName = clientNames.length > 1 ? 'Multiple clients' : clientNames[0] ?? '—'
    const totalAmount = invoiceBills.reduce((sum, bill) => sum + (bill.grand_total ?? bill.total_amount), 0)
    const totalPaid = invoiceBills.reduce((sum, bill) => sum + (bill.paid_amount ?? 0), 0)
    const totalOutstanding = invoiceBills.reduce(
      (sum, bill) => sum + (bill.outstanding_amount ?? (bill.grand_total ?? bill.total_amount)),
      0,
    )
    const money = (amount: number) => `LKR ${amount.toFixed(2)}`
    const generatedOn = formatInvoiceDate(new Date().toISOString())

    return (
      <div ref={ref} className="inv-root" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
        <style dangerouslySetInnerHTML={{ __html: printStyles }} />
        <section className="inv-page">
          <header className="inv-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/icon.png" alt="Love Laundry" />
              <div>
                <h1 style={{ margin: 0, fontSize: 23, letterSpacing: 1.5, textTransform: 'uppercase' }}>{COMPANY.name}</h1>
                <p style={{ margin: '2px 0', fontSize: 12, fontStyle: 'italic' }}>{COMPANY.tagline}</p>
                <p style={{ margin: 0, fontSize: 9 }}>{COMPANY.address.line1}, {COMPANY.address.line2}</p>
                <p style={{ margin: 0, fontSize: 9 }}>Tel: {COMPANY.phone.primary} / {COMPANY.phone.secondary} · {COMPANY.email}</p>
              </div>
            </div>
            <div>
              <div className="inv-title">INVOICE</div>
              <div style={{ textAlign: 'right', fontSize: 10 }}>Reg. No. {COMPANY.registrationNo}</div>
            </div>
          </header>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 16 }}>
            <div className="inv-box" style={{ flex: 1 }}>
              <div className="inv-section-title" style={{ fontSize: 9 }}>Bill to</div>
              <div style={{ marginTop: 5, fontSize: 14, fontWeight: 800 }}>{clientName}</div>
              <div style={{ marginTop: 3, fontSize: 10, whiteSpace: 'pre-wrap' }}>
                {clientNames.length > 1 ? 'See customer name on each bill row.' : clientAddress?.trim() || 'Address not provided'}
              </div>
            </div>
            <div className="inv-box" style={{ minWidth: 190, fontSize: 10, lineHeight: 1.8 }}>
              <div><strong>Invoice No:</strong> {invoiceNo}</div>
              <div><strong>Invoice date:</strong> {generatedOn}</div>
              <div><strong>Period:</strong> {formatInvoiceDate(dateFrom)} – {formatInvoiceDate(dateTo)}</div>
              <div><strong>Payment terms:</strong> 7 days</div>
            </div>
          </div>

          <h2 style={{ margin: '18px 0 8px', textAlign: 'center', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Monthly laundry services · Received items
          </h2>

          <table className="inv-table">
            <thead>
              <tr>
                <th>Daily references</th>
                <th>Client</th>
                <th>Received date</th>
                {itemColumns.map((column) => <th key={column.key}>{column.label}</th>)}
                <th>Amount (LKR)</th>
              </tr>
            </thead>
            <tbody>
              {invoiceBills.length === 0 ? (
                <tr><td colSpan={itemColumns.length + 4}>No bills selected.</td></tr>
              ) : invoiceBills.map((bill) => (
                <tr key={bill.id}>
                  <td style={{ fontSize: 7, lineHeight: 1.5 }}>
                    <div><strong>Bill:</strong> {bill.manual_bill_number ? formatBillNumber(bill.manual_bill_number, includePrefix) : `BILL-${bill.id.slice(-6).toUpperCase()}`}</div>
                    {bill.manual_gate_pass_number && <div><strong>Gate pass:</strong> {bill.manual_gate_pass_number}</div>}
                    {bill.alrs_number && <div><strong>ALRS:</strong> {bill.alrs_number}</div>}
                  </td>
                  <td>{bill.client_name}</td>
                  <td>{formatInvoiceDate(bill.receiving_date || bill.created_at)}</td>
                  {itemColumns.map((column) => {
                    const qty = quantityFor(bill, column)
                    return <td key={column.key}>{qty ? new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 }).format(qty) : '—'}</td>
                  })}
                  <td className="num">{(bill.grand_total ?? bill.total_amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="item-name">MONTH TOTAL</td>
                <td colSpan={2}>{invoiceBills.length} bill(s)</td>
                {itemColumns.map((column) => {
                  const total = invoiceBills.reduce((sum, bill) => sum + quantityFor(bill, column), 0)
                  return <td key={column.key}>{total ? new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 }).format(total) : '—'}</td>
                })}
                <td className="num">{totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div className="inv-box" style={{ minWidth: 240, fontSize: 11, lineHeight: 1.9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><strong>Total amount</strong><span>{money(totalAmount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Paid</span><span>{money(totalPaid)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#991b1b', fontWeight: 800 }}><span>Balance due</span><span>{money(totalOutstanding)}</span></div>
            </div>
          </div>

          <footer className="inv-footer">
            {COMPANY.name} · {COMPANY.address.line1}, {COMPANY.address.line2} · {COMPANY.phone.primary} · {COMPANY.email}
          </footer>
        </section>

        <section className="inv-page inv-terms-page">
          <header className="inv-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/icon.png" alt="Love Laundry" />
              <div>
                <h1 style={{ margin: 0, fontSize: 21, textTransform: 'uppercase' }}>{COMPANY.name}</h1>
                <p style={{ margin: '2px 0', fontSize: 11 }}>{COMPANY.tagline}</p>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10 }}><strong>Invoice:</strong> {invoiceNo}<br /><strong>Customer:</strong> {clientName}</div>
          </header>

          <h2 className="inv-section-title" style={{ margin: '24px 0 12px', fontSize: 15 }}>Terms and conditions</h2>
          <ol style={{ paddingLeft: 22, fontSize: 11, lineHeight: 1.9 }}>
            <li>Payment is due within 7 days of the invoice date.</li>
            <li>Please quote the invoice number when making payment.</li>
            <li>Any discrepancy in the received-item quantities or invoice should be reported promptly.</li>
            <li>Payments received after this invoice is issued may not be reflected here.</li>
            <li>Any complaints about the quality of cleaning should be reported within 24 hours of delivery.</li>
            <li>Items should be collected within 10 days of delivery; after that period, Love Laundry cannot be responsible for loss or damage.</li>
          </ol>

          <div className="inv-box" style={{ marginTop: 24 }}>
            <h3 className="inv-section-title" style={{ margin: '0 0 8px', fontSize: 11 }}>Payment details</h3>
            <p style={{ margin: 0, fontSize: 10, lineHeight: 1.7 }}>
              {bankDetails ? (
                <>
                  Bank: {bankDetails.bankName}<br />
                  Branch: {bankDetails.branch}<br />
                  Account name: {bankDetails.accountName}<br />
                  Account number: {bankDetails.accountNumber}<br />
                  Include the invoice number with your payment reference.
                </>
              ) : (
                <>Please contact us at {COMPANY.phone.primary} or {COMPANY.email} for current bank transfer details. Include the invoice number with your payment reference.</>
              )}
            </p>
          </div>

          <div className="inv-sign">
            <div className="inv-sign-block">
              {managerSignature && <img src={managerSignature} alt="Laundry manager signature" className="inv-sign-image" />}
              <span className="inv-sign-line">Laundry manager authorization</span>
            </div>
            <div className="inv-sign-block">
              <span className="inv-sign-line">Customer acknowledgment</span>
            </div>
          </div>

          <p style={{ marginTop: 38, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#991b1b' }}>Thank you for choosing Love Laundry.</p>
          <footer className="inv-footer">
            {COMPANY.name} · {COMPANY.address.line1}, {COMPANY.address.line2} · {COMPANY.phone.primary} · {COMPANY.email}
          </footer>
        </section>
      </div>
    )
  },
)

ConsolidatedInvoiceTemplate.displayName = 'ConsolidatedInvoiceTemplate'
