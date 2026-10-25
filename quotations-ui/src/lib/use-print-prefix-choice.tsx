import { useCallback, useRef, useState } from 'react'
import { PrintPrefixDialog } from '../components/ui/print-prefix-dialog'

/**
 * usePrintPrefixChoice — promise-based controller for {@link PrintPrefixDialog}.
 *
 * Render the returned `dialog` somewhere in the page and `await choose()`
 * before printing. The promise resolves to `true`/`false` for the operator's
 * choice, or `null` if they dismissed the dialog (in which case the caller
 * should abort the print).
 */
export function usePrintPrefixChoice() {
  const [open, setOpen] = useState(false)
  const resolver = useRef<((value: boolean | null) => void) | null>(null)

  const choose = useCallback(() => {
    setOpen(true)
    return new Promise<boolean | null>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((value: boolean | null) => {
    setOpen(false)
    resolver.current?.(value)
    resolver.current = null
  }, [])

  const dialog = (
    <PrintPrefixDialog
      open={open}
      onChoose={(includePrefix) => settle(includePrefix)}
      onCancel={() => settle(null)}
    />
  )

  return { choose, dialog }
}
