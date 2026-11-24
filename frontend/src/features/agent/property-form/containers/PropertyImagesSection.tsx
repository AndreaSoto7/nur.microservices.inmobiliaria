import type { PropertyDetail } from '../../../../core/models/listing'
import { PropertyImagesForm } from '../components/PropertyImagesForm'
import { useImageSources, useMoveImage, useRemoveImage, useUploadImages } from '../usePropertyForm'

/** Smart: la galería del editor. Sube, quita y consigue las miniaturas (también las de un borrador). */
export function PropertyImagesSection({ property }: { property: PropertyDetail }) {
  const { uploadImages, uploading, error } = useUploadImages(property.id)
  const { removeImage, removingId, error: removeError } = useRemoveImage(property.id)
  const { moveImage, movingId, error: moveError } = useMoveImage(property.id)
  const sources = useImageSources(property)
  // Publicar exige una foto: listing no deja que una propiedad visible se quede sin ninguna.
  const keepsOne = property.status === 'PUBLISHED' || property.status === 'RESERVED'

  return (
    <PropertyImagesForm
      // La cantidad cambia al subir o quitar: así la selección vuelve a quedar vacía.
      key={property.images.length}
      images={property.images}
      sources={sources}
      keepsOne={keepsOne}
      uploading={uploading}
      error={error}
      removingId={removingId}
      removeError={removeError ?? moveError}
      movingId={movingId}
      onMove={(imageId, position) => moveImage({ imageId, position })}
      onUpload={uploadImages}
      onRemove={removeImage}
    />
  )
}
