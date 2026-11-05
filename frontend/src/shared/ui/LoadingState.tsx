import { memo } from 'react'

export const LoadingState = memo(function LoadingState({
  label = 'Cargando…',
}: {
  label?: string
}) {
  return (
    <p role="status" className="loading-state">
      {label}
    </p>
  )
})
