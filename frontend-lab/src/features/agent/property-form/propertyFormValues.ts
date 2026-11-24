import type {
  CreatePropertyRequest,
  EditPropertyRequest,
  Location,
  OperationType,
  PropertyDetail,
  PropertyType,
} from '../../../core/models/listing'
import { coordinatesOf, type Coordinates } from '../../../shared/map/mapConfig'

/** Lo que edita el formulario, como texto: un input numérico vacío no es 0. */
export interface PropertyFormValues {
  title: string
  description: string
  propertyType: PropertyType
  operationType: OperationType
  amount: string
  zone: string
  address: string
  /** Lo que el agente marcó en el mapa, o null. */
  coordinates: Coordinates | null
}

export const EMPTY_PROPERTY_VALUES: PropertyFormValues = {
  title: '',
  description: '',
  propertyType: 'HOUSE',
  operationType: 'SALE',
  amount: '',
  zone: '',
  address: '',
  coordinates: null,
}

export function valuesFromDetail(property: PropertyDetail): PropertyFormValues {
  return {
    title: property.title,
    description: property.description,
    propertyType: property.propertyType,
    operationType: property.operationType,
    amount: String(property.price.amount),
    zone: property.location.zone,
    address: property.location.address ?? '',
    coordinates: coordinatesOf(property.location),
  }
}

/** El PUT reemplaza la ubicación completa: zona, dirección y coordenadas salen del formulario. */
function toLocation(values: PropertyFormValues, base?: Location): Location {
  const location: Location = { ...base, zone: values.zone.trim() }
  const address = values.address.trim()
  if (address) location.address = address
  else delete location.address
  // Las dos coordenadas van juntas o no va ninguna (contrato de listing).
  if (values.coordinates) {
    location.latitude = values.coordinates.latitude
    location.longitude = values.coordinates.longitude
  } else {
    delete location.latitude
    delete location.longitude
  }
  return location
}

export function toEditRequest(values: PropertyFormValues, base: Location): EditPropertyRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    price: { amount: Number(values.amount), currency: 'BOB' },
    location: toLocation(values, base),
  }
}

export function toCreateRequest(values: PropertyFormValues): CreatePropertyRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    propertyType: values.propertyType,
    operationType: values.operationType,
    price: { amount: Number(values.amount), currency: 'BOB' },
    location: toLocation(values),
  }
}
