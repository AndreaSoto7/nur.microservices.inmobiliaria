import type { PropertyDetail } from '../../../core/models/listing'

export const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

/** Lo que el dominio de listing exige para publicar. Sirve para explicarlo antes de intentarlo. */
export function publishBlockers(property: PropertyDetail): string[] {
  const blockers: string[] = []
  if (property.bedrooms == null || property.bathrooms == null || property.areaM2 == null) {
    blockers.push('Completa dormitorios, baños y superficie.')
  }
  if (property.images.length === 0) blockers.push('Agrega al menos una foto.')
  return blockers
}

/**
 * Evita una subida que el servicio va a rechazar. El servicio revisa además la firma real del
 * archivo: esto no reemplaza esa validación.
 */
export function imagesError(files: File[], currentCount: number): string | undefined {
  const free = MAX_IMAGES - currentCount
  if (files.length > free) return `Puedes agregar hasta ${free} ${free === 1 ? 'foto' : 'fotos'}.`
  if (files.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type))) {
    return 'Solo se aceptan fotos JPG o PNG.'
  }
  if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
    return 'Cada foto puede pesar hasta 5 MB.'
  }
  return undefined
}
