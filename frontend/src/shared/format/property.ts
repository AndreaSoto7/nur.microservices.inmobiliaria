import type {
  Feature,
  Money,
  OperationType,
  PropertyStatus,
  PropertyType,
} from '../../core/models/listing'
import type { StatusTone } from '../ui/StatusBadge'

const money = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 })

const shortNumber = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 })

/**
 * Precio corto para el marcador del mapa: "Bs 1,29 M", "Bs 690 mil" o "Bs 6.200/mes". Un alquiler se lee
 * entero porque es chico; una venta se abrevia para que la píldora no tape a sus vecinas.
 */
export function formatPriceShort(price: Money, operation: OperationType): string {
  if (operation === 'RENT') return `Bs ${money.format(price.amount)}/mes`
  const amount = price.amount
  if (amount >= 1_000_000) return `Bs ${shortNumber.format(amount / 1_000_000)} M`
  if (amount >= 10_000) return `Bs ${Math.round(amount / 1_000)} mil`
  return `Bs ${money.format(amount)}`
}

/** "Bs 1.285.000" o "Bs 3.500 / mes" en alquiler (en RENT el precio es mensual, según el contrato). */
export function formatPrice(price: Money, operation: OperationType): string {
  const amount = `Bs ${money.format(price.amount)}`
  return operation === 'RENT' ? `${amount} / mes` : amount
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: 'Casa',
  APARTMENT: 'Departamento',
}

export const OPERATION_LABELS: Record<OperationType, string> = {
  SALE: 'Venta',
  RENT: 'Alquiler',
}

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicada',
  PAUSED: 'Pausada',
  RESERVED: 'Reservada',
  SOLD: 'Vendida',
  RENTED: 'Alquilada',
}

export const PROPERTY_STATUS_TONES: Record<PropertyStatus, StatusTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  PAUSED: 'neutral',
  RESERVED: 'warning',
  SOLD: 'closed',
  RENTED: 'closed',
}

export const FEATURE_LABELS: Record<Feature, string> = {
  GARAGE: 'Garaje',
  GARDEN: 'Jardín',
  POOL: 'Piscina',
  COMMON_AREAS: 'Áreas comunes',
  BALCONY: 'Balcón',
  ELEVATOR: 'Ascensor',
  SECURITY: 'Seguridad',
  FURNISHED: 'Amoblado',
  PET_FRIENDLY: 'Acepta mascotas',
  AIR_CONDITIONING: 'Aire acondicionado',
}
