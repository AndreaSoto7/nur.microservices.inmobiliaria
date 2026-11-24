import { memo } from 'react'

const PLACEHOLDER_ROWS = [1, 2, 3, 4]

/** Dumb: reserva el espacio de las filas mientras cargan, para que la página no salte al llegar. */
export const PropertyRowsSkeleton = memo(function PropertyRowsSkeleton({
  label,
}: {
  label: string
}) {
  return (
    <div role="status">
      <span className="visually-hidden">{label}</span>
      <div className="property-rows" aria-hidden="true">
        {PLACEHOLDER_ROWS.map((row) => (
          <div key={row} className="property-row property-row--skeleton">
            <div className="property-row__link">
              <div className="property-row__media skeleton" />
              <div className="property-row__body">
                <div className="skeleton skeleton--line skeleton--short" />
                <div className="skeleton skeleton--line" />
                <div className="skeleton skeleton--line skeleton--short" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
