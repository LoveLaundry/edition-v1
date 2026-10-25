import { Tag } from 'lucide-react'
import { Button } from './button'
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './dialog'

export interface PrintPrefixDialogProps {
  open: boolean
  /** Called with the operator's choice. */
  onChoose: (includePrefix: boolean) => void
  /** Called when the dialog is dismissed without choosing. */
  onCancel: () => void
}

/**
 * PrintPrefixDialog — asks whether printed documents should show the
 * hotel-code prefix on bill numbers (e.g. `RH-1001` vs `1001`).
 *
 * There is deliberately no default action: the operator must pick one of the
 * two options, so a bill is never printed with a surprising number.
 */
export function PrintPrefixDialog({ open, onChoose, onCancel }: PrintPrefixDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent size="sm">
        <DialogHeader className="border-0 pb-0 pr-10">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)]">
              <Tag className="size-[18px]" aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <DialogTitle>Include the hotel code in printed numbers?</DialogTitle>
              <DialogDescription>
                Choose how bill numbers appear on this document. The stored value is not changed.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] text-[var(--text-secondary)]">
            With code: <span className="font-semibold text-[var(--text-primary)]">RH-1001</span>
            <span className="mx-2 text-[var(--text-faint)]">·</span>
            Without code: <span className="font-semibold text-[var(--text-primary)]">1001</span>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="secondary" onClick={() => onChoose(false)}>Without code</Button>
          <Button variant="primary" onClick={() => onChoose(true)}>With code</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
