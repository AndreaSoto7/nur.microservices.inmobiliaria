import { memo } from 'react'

const PLACEHOLDER_ROWS = [1, 2, 3, 4]

/** Reserva el espacio de una lista de filas mientras carga, para que la página no salte al llegar. */
export const RowListSkeleton = memo(function RowListSkeleton({ label }: { label: string }) {
  return (
    <div role="status">
      <span className="visually-hidden">{label}</span>
      <div className="row-list" aria-hidden="true">
        {PLACEHOLDER_ROWS.map((row) => (
          <div key={row} className="skeleton row-card__skeleton" />
        ))}
      </div>
    </div>
  )
})
