import type { Feature, PropertyDetail, UpdateFeaturesRequest } from '../../../core/models/listing'

/** Los pasos del asistente, en orden. Los tres primeros se completan antes de crear el borrador. */
export const WIZARD_STEPS = ['datos', 'ubicacion', 'detalles', 'fotos', 'publicar'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

/** Hasta este paso se llega sin que la propiedad exista: las fotos se suben a un borrador ya creado. */
export const LAST_LOCAL_STEP = WIZARD_STEPS.indexOf('detalles')

export const STEP_LABELS: Record<WizardStep, string> = {
  datos: 'Datos',
  ubicacion: 'Ubicación',
  detalles: 'Detalles',
  fotos: 'Fotos',
  publicar: 'Publicar',
}

export const STEP_TITLES: Record<WizardStep, { title: string; hint: string }> = {
  datos: { title: '¿Qué vas a publicar?', hint: 'El tipo, la operación, un título y el precio.' },
  ubicacion: {
    title: '¿Dónde está?',
    hint: 'La zona sirve para que la encuentren al buscar; el mapa, para mostrarla en el catálogo.',
  },
  detalles: {
    title: '¿Cómo es?',
    hint: 'Lo que más comparan los interesados: ambientes, superficie y extras.',
  },
  fotos: { title: 'Fotos', hint: 'Hasta 5 fotos JPG o PNG. La primera es la portada.' },
  publicar: {
    title: 'Revisar y publicar',
    hint: 'Así queda la propiedad. Mientras sea borrador, nadie más la ve.',
  },
}

/** Los pasos que tienen campos: al salir de uno de ellos se valida y, al editar, se guarda. */
export function hasFields(step: WizardStep): boolean {
  return WIZARD_STEPS.indexOf(step) <= LAST_LOCAL_STEP
}

/** El paso de la URL, sin pasar del último al que la persona puede llegar. */
export function parseStep(value: string | null, maxIndex: number): WizardStep {
  const index = WIZARD_STEPS.findIndex((step) => step === value)
  if (index < 0) return WIZARD_STEPS[0]
  return WIZARD_STEPS[Math.min(index, maxIndex)]
}

/** En qué paso está el campo de un error de la API (nombres del contrato), para llevar a la persona ahí. */
export function stepOfField(field: string): WizardStep | undefined {
  if (field.startsWith('location')) return 'ubicacion'
  if (['description', 'bedrooms', 'bathrooms', 'areaM2', 'features'].includes(field))
    return 'detalles'
  if (['title', 'propertyType', 'operationType'].includes(field) || field.startsWith('price')) {
    return 'datos'
  }
  return undefined
}

/** Ambientes, superficie y extras, como texto: un input numérico vacío no es 0. */
export interface DetailsValues {
  bedrooms: string
  bathrooms: string
  areaM2: string
  features: Feature[]
}

export const EMPTY_DETAILS: DetailsValues = {
  bedrooms: '',
  bathrooms: '',
  areaM2: '',
  features: [],
}

const asText = (value?: number | null) => (value == null ? '' : String(value))

export function detailsFromProperty(property: PropertyDetail): DetailsValues {
  return {
    bedrooms: asText(property.bedrooms),
    bathrooms: asText(property.bathrooms),
    areaM2: asText(property.areaM2),
    features: property.features,
  }
}

export function toFeaturesRequest(details: DetailsValues): UpdateFeaturesRequest {
  return {
    bedrooms: Number(details.bedrooms),
    bathrooms: Number(details.bathrooms),
    areaM2: Number(details.areaM2),
    features: details.features,
  }
}
