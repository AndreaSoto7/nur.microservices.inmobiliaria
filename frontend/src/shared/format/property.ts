import type { Feature, Money, OperationType, PropertyType } from '../../core/models/listing'

const money = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 })

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
