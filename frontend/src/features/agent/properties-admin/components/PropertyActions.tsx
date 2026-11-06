import { memo, useState } from 'react'
import type {
  OperationType,
  PropertyStatus,
  PropertyTransition,
} from '../../../../core/models/listing'
import { Button } from '../../../../shared/ui/Button'
import { availableActions, type PropertyAction } from '../propertyActions'

interface PropertyActionsProps {
  /** Nombre de la propiedad: distingue los botones de cada fila para un lector de pantalla. */
  title: string
  status: PropertyStatus
  operationType: OperationType
  busy: boolean
  /** Transición que se resalta como acción principal de la zona. */
  primary?: PropertyTransition
  onRun: (transition: PropertyTransition) => void
}

export const PropertyActions = memo(function PropertyActions({
  title,
  status,
  operationType,
  busy,
  primary,
  onRun,
}: PropertyActionsProps) {
  const [confirming, setConfirming] = useState<PropertyAction | null>(null)

  if (confirming) {
    return (
      <div className="confirm-bar">
        <p>
          {confirming.label} &quot;{title}&quot; no se puede deshacer.
        </p>
        <div className="action-bar">
          <Button
            disabled={busy}
            onClick={() => {
              setConfirming(null)
              onRun(confirming.transition)
            }}
          >
            Sí, {confirming.label.toLowerCase()}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            No, volver
          </Button>
        </div>
      </div>
    )
  }

  const actions = availableActions(status, operationType)
  if (actions.length === 0) return null

  return (
    <div className="action-bar">
      {actions.map((action) => (
        <Button
          key={action.transition}
          variant={action.transition === primary ? 'primary' : 'secondary'}
          disabled={busy}
          aria-label={`${action.label}: ${title}`}
          onClick={() => (action.irreversible ? setConfirming(action) : onRun(action.transition))}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
})
