import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Printer, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'

export interface SignatureSlot {
  id: string
  label: string
  value?: string
}

interface SignatureUploadDialogProps {
  open: boolean
  slots: SignatureSlot[]
  onClose: () => void
  onConfirm: (signatures: Record<string, string>) => void
  title?: string
  description?: string
  confirmLabel?: string
  children?: ReactNode
}

const MAX_SIZE = 3 * 1024 * 1024

export function SignatureUploadDialog({
  open,
  slots,
  onClose,
  onConfirm,
  title = 'Add laundry sign',
  description = "Upload the laundry's sign (PNG) for this print. It is used for this print only and is never saved to the database.",
  confirmLabel = 'Print with laundry sign',
  children,
}: SignatureUploadDialogProps) {
  const [pending, setPending] = useState<Record<string, string>>({})
  const [place, setPlace] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const activeSlot = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPending(
      slots.reduce<Record<string, string>>((a, s) => (s.value ? { ...a, [s.id]: s.value } : a), {}),
    )
    setPlace(
      slots.reduce<Record<string, boolean>>((a, s) => (s.value ? { ...a, [s.id]: true } : a), {}),
    )
    activeSlot.current = slots[0]?.id ?? null
  }, [open, slots])

  const pickFor = (id: string) => {
    activeSlot.current = id
    inputRef.current?.click()
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const id = activeSlot.current
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!id || !file) return
    if (file.type !== 'image/png') {
      toast.error('Only PNG images are supported.')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('Signature image is too large (max 3 MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPending(p => ({ ...p, [id]: String(reader.result) }))
      setPlace(p => ({ ...p, [id]: true }))
    }
    reader.readAsDataURL(file)
  }

  const payload = slots.reduce<Record<string, string>>(
    (a, s) => (place[s.id] && pending[s.id] ? { ...a, [s.id]: pending[s.id] } : a),
    {},
  )

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <input ref={inputRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
          {slots.map(slot => {
            const has = Boolean(pending[slot.id])
            return (
              <div
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded border border-[var(--border)] p-3"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={Boolean(place[slot.id])}
                    onChange={e => setPlace(p => ({ ...p, [slot.id]: e.target.checked }))}
                    disabled={!has}
                    className="accent-[var(--brand)] shrink-0 cursor-pointer"
                  />
                  <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">{slot.label}</span>
                </label>
                {has ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <img
                      src={pending[slot.id]}
                      alt={slot.label}
                      className="h-10 max-w-[110px] rounded-xs border border-[var(--border)] bg-[var(--surface)] object-contain"
                    />
                    <button
                      onClick={() => {
                        setPending(p => { const n = { ...p }; delete n[slot.id]; return n })
                        setPlace(p => ({ ...p, [slot.id]: false }))
                      }}
                      className="cursor-pointer rounded p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--danger-text)]"
                      aria-label={`Remove ${slot.label}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => pickFor(slot.id)}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-[var(--border-2)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-text)] transition-colors hover:bg-[var(--brand-soft)]"
                  >
                    <Upload size={14} /> Upload PNG
                  </button>
                )}
              </div>
            )
          })}
          {children}
        </DialogBody>
        {/* flex-col (not col-reverse): DOM order is Cancel-then-confirm, which
            already gives cancel-on-top / confirm-under-the-thumb on a mobile
            bottom sheet, and cancel-left / confirm-right on desktop. */}
        <DialogFooter className="flex-col">
          <Button variant="outline" onClick={onClose} className="w-full cursor-pointer sm:w-auto">
            Cancel
          </Button>
          <Button onClick={() => onConfirm(payload)} className="w-full cursor-pointer gap-2 sm:w-auto">
            <Printer size={15} /> {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}