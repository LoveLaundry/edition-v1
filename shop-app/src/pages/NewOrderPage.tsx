import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { dataApi, errorMessage } from '../api/client'
import { PageHeader, Panel } from '../ui/kit'

interface Line {
  item_name: string
  quantity: string
  unit: string
}

const EMPTY: Line = { item_name: '', quantity: '', unit: 'pcs' }

export function NewOrderPage() {
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const items = lines
      .filter((line) => line.item_name.trim() && Number(line.quantity) > 0)
      .map((line) => ({
        item_name: line.item_name.trim(),
        quantity: Number(line.quantity),
        unit: line.unit.trim() || 'pcs',
      }))

    if (items.length === 0) {
      setError('Add at least one item with a name and a quantity above zero.')
      return
    }

    setBusy(true)
    try {
      await dataApi.post('/client-portal/shop/orders', { items, notes: notes.trim() || null })
      navigate('/orders', { replace: true })
    } catch (caught) {
      // The server validates quantities and rejects a hotel session here, so
      // its message is more useful than anything that could be guessed.
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="New order"
        subtitle="Tell the laundry what you are sending. It is only an order until they confirm receipt."
      />

      <form onSubmit={submit} className="space-y-5">
        <Panel>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2">
                <input
                  className="col-span-6 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Item, e.g. Bed sheet"
                  value={line.item_name}
                  onChange={(event) => update(index, { item_name: event.target.value })}
                />
                <input
                  className="col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Qty"
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                />
                <input
                  className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Unit"
                  value={line.unit}
                  onChange={(event) => update(index, { unit: event.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setLines((c) => (c.length === 1 ? [{ ...EMPTY }] : c.filter((_, i) => i !== index)))}
                  className="col-span-1 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLines((current) => [...current, { ...EMPTY }])}
            className="mt-3 text-sm font-medium text-slate-600 underline"
          >
            Add another line
          </button>

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="notes">
            Notes for the laundry
          </label>
          <textarea
            id="notes"
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Collection time, gate code, anything the driver should know"
          />
        </Panel>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send order'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
