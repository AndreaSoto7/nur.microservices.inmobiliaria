// Reflejo de contracts/openapi/listing-service.yaml. No agregues campos que no estén ahí.

export const PROPERTY_TYPES = ['HOUSE', 'APARTMENT'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const OPERATION_TYPES = ['SALE', 'RENT'] as const
export type OperationType = (typeof OPERATION_TYPES)[number]

export const PROPERTY_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'RESERVED',
  'SOLD',
  'RENTED',
] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

/** Última parte de la ruta de cada transición: POST /api/v1/properties/{id}/{transition}. */
export type PropertyTransition =
  'publish' | 'pause' | 'reserve' | 'release-reservation' | 'mark-sold' | 'mark-rented'

export const FEATURES = [
  'GARAGE',
  'GARDEN',
  'POOL',
  'COMMON_AREAS',
  'BALCONY',
  'ELEVATOR',
  'SECURITY',
  'FURNISHED',
  'PET_FRIENDLY',
  'AIR_CONDITIONING',
] as const
export type Feature = (typeof FEATURES)[number]

export interface Money {
  amount: number
  currency: 'BOB'
}

export interface Location {
  zone: string
  address?: string
  latitude?: number
  longitude?: number
}

export interface PropertySummary {
  id: string
  title: string
  propertyType: PropertyType
  operationType: OperationType
  status: PropertyStatus
  price: Money
  zone: string
  bedrooms?: number | null
  bathrooms?: number | null
  areaM2?: number | null
  features: Feature[]
  /** Ruta relativa al gateway. */
  coverImageUrl?: string | null
  publishedAt?: string | null
  updatedAt?: string
}

export interface PropertyImage {
  id: string
  /** 0 es la portada. */
  position: number
  /** Ruta relativa al gateway. */
  url: string
}

export interface PropertyDetail {
  id: string
  agentId: string
  title: string
  description: string
  propertyType: PropertyType
  operationType: OperationType
  status: PropertyStatus
  price: Money
  location: Location
  bedrooms?: number | null
  bathrooms?: number | null
  areaM2?: number | null
  features: Feature[]
  images: PropertyImage[]
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface EditPropertyRequest {
  title: string
  description?: string
  price: Money
  location: Location
}

export interface CreatePropertyRequest extends EditPropertyRequest {
  propertyType: PropertyType
  operationType: OperationType
}

export interface UpdateFeaturesRequest {
  bedrooms: number
  bathrooms: number
  areaM2: number
  features: Feature[]
}

export interface IdResponse {
  id: string
}

export interface PageMeta {
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export interface Page<T> {
  data: T[]
  page: PageMeta
}
