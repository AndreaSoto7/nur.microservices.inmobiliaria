import type {
  OperationType,
  PropertyStatus,
  PropertyTransition,
} from '../../../core/models/listing'

export interface PropertyAction {
  transition: PropertyTransition
  label: string
  /** Vender y alquilar no tienen vuelta atrás: la UI pide confirmar. */
  irreversible: boolean
}

const PAUSE: PropertyAction = { transition: 'pause', label: 'Pausar', irreversible: false }
const RESERVE: PropertyAction = { transition: 'reserve', label: 'Reservar', irreversible: false }
const RELEASE: PropertyAction = {
  transition: 'release-reservation',
  label: 'Liberar reserva',
  irreversible: false,
}
const CLOSE: Record<OperationType, PropertyAction> = {
  SALE: { transition: 'mark-sold', label: 'Marcar vendida', irreversible: true },
  RENT: { transition: 'mark-rented', label: 'Marcar alquilada', irreversible: true },
}

/**
 * Qué botones ofrecer según la máquina de estados del contrato de listing. Es solo para no mostrar
 * acciones imposibles: quien hace cumplir las reglas es el dominio del servicio.
 */
export function availableActions(
  status: PropertyStatus,
  operation: OperationType,
): PropertyAction[] {
  switch (status) {
    case 'DRAFT':
      return [{ transition: 'publish', label: 'Publicar', irreversible: false }]
    case 'PAUSED':
      return [{ transition: 'publish', label: 'Volver a publicar', irreversible: false }]
    case 'PUBLISHED':
      return [PAUSE, RESERVE, CLOSE[operation]]
    case 'RESERVED':
      return [RELEASE, CLOSE[operation]]
    case 'SOLD':
    case 'RENTED':
      return []
  }
}
