import { useState } from 'react'
import { dataApi, errorMessage } from '../api/client'
import { formatMoney, useQuery } from '../api/hooks'
import { PageHeader, Panel, StateBox, Table } from '../ui/kit'

interface Template {
  id: string
  name: string
  items: TemplateItem[]
}

interface TemplateItem {
  item_name: string
  quantity: number
  unit_price: number
}

interface Item {
  id: string
  name: string
  price: number
}

interface NewBill {
  template_id?: string
  items: Array<{ item_id: string; quantity: number }>
}

const TEMPLATES: Template[] = [
  {
    id: 'daily-laundry',
    name: 'Daily Laundry Bundle',
    items: [
      { item_name: 'Bed Sheet', quantity: 2, unit_price: 50 },
      { item_name: 'Pillow Case', quantity: 4, unit_price: 15 },
      { item_name: 'Towel', quantity: 2, unit_price: 25 },
    ],
  },
  {
    id: 'uniform-bundle',
    name: 'Uniform Bundle',
    items: [
      { item_name: 'Shirt', quantity: 5, unit_price: 100 },
      { item_name: 'Pants', quantity: 5, unit_price: 80 },
    ],
  },
  {
    id: 'towels-only',
    name: 'Towels Only',
    items: [
      { item_name: 'Large Towel', quantity: 3, unit_price: 30 },
      { item_name: 'Hand Towel', quantity: 3, unit_price: 20 },
    ],
  },
]

export function QuickBillPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch available items (this would come from an API endpoint)
  const { data: items = [] } = useQuery<Item[]>('/items', {})

  async function createBill() {
    if (!selectedTemplate) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Convert template items to bill items
      const billItems = selectedTemplate.items.map(item => ({
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
      }))

      const total = billItems.reduce((sum, item) => sum + item.amount, 0)

      // Create the bill via API
      const response = await dataApi.post('/shop-bills', {
        items: billItems,
        total_amount: total,
        discounts: 0,
        transport_fee: 0,
        taxes: 0,
        grand_total: total,
        notes: `Created from template: ${selectedTemplate.name}`,
      })

      setSuccess(`Bill created successfully! Bill #: ${response.data.bill_number}`)
      setSelectedTemplate(null)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Quick Bill"
        subtitle="Create bills quickly from predefined templates"
      />

      {success ? (
        <Panel className="mb-4 bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-800">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="mt-2 text-sm font-medium text-emerald-700 underline"
          >
            Dismiss
          </button>
        </Panel>
      ) : null}

      {error ? (
        <Panel className="mb-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {!selectedTemplate ? (
        <Panel>
          <h2 className="text-lg font-semibold mb-4">Select a Template</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition text-left"
              >
                <h3 className="font-semibold text-slate-900">{template.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {template.items.length} item{template.items.length !== 1 ? 's' : ''}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {formatMoney(
                    template.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
                  )}
                </p>
              </button>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
              <p className="text-sm text-slate-500">Review items before creating bill</p>
            </div>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-sm text-slate-500 underline"
            >
              Cancel
            </button>
          </div>

          <Table head={['Item', 'Qty', 'Unit Price', 'Amount']}>
            {selectedTemplate.items.map((item, index) => (
              <tr key={index}>
                <td className="px-4 py-3">{item.item_name}</td>
                <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(item.unit_price)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {formatMoney(item.quantity * item.unit_price)}
                </td>
              </tr>
            ))}
          </Table>

          <div className="mt-4 text-right">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatMoney(
                selectedTemplate.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
              )}
            </p>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => setSelectedTemplate(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={createBill}
              disabled={loading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Bill'}
            </button>
          </div>
        </Panel>
      )}
    </>
  )
}
