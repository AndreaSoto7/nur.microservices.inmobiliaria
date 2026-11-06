import { memo } from 'react'

const PLACEHOLDER_CARDS = [1, 2, 3, 4, 5, 6]

/** Dumb: reserva el espacio de las tarjetas mientras cargan, para que la página no salte al llegar. */
export const PropertyGridSkeleton = memo(function PropertyGridSkeleton({
  label,
}: {
  label: string
}) {
  return (
    <div role="status">
      <span className="visually-hidden">{label}</span>
      <div className="property-grid" aria-hidden="true">
        {PLACEHOLDER_CARDS.map((card) => (
          <div key={card} className="property-card card">
            <div className="skeleton skeleton--media" />
            <div className="property-card__body">
              <div className="skeleton skeleton--line" />
              <div className="skeleton skeleton--line skeleton--short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
