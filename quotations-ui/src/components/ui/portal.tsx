import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders children into <body>.
 *
 * Overlays must not be positioned inside the page tree. `position: fixed` is
 * only relative to the viewport while no ancestor establishes a containing
 * block — and `transform`, `filter`, `perspective` and `will-change` all do.
 * Framer-motion wrappers set `transform` while animating, so a modal nested
 * under one centres itself on that panel instead of the screen. Portalling
 * removes the question entirely.
 */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
