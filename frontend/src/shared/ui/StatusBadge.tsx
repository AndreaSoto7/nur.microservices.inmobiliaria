import { memo } from 'react'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'closed'

/** El estado siempre se lee en el texto: el color solo lo refuerza. */
export const StatusBadge = memo(function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone: StatusTone
}) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>
})
