import type { PropertyDetail } from '../../../../core/models/listing'
import { PropertyImagesForm } from '../components/PropertyImagesForm'
import { useUploadImages } from '../usePropertyForm'

export function PropertyImagesSection({ property }: { property: PropertyDetail }) {
  const { uploadImages, uploading, error } = useUploadImages(property.id)
  // listing responde 404 a las fotos de un borrador o una propiedad pausada: son públicas.
  const previewable = property.status !== 'DRAFT' && property.status !== 'PAUSED'

  return (
    <div className="card editor__section">
      <h2>Fotos</h2>
      <PropertyImagesForm
        // La cantidad cambia al terminar una subida: así el formulario vuelve a quedar vacío.
        key={property.images.length}
        images={property.images}
        previewable={previewable}
        uploading={uploading}
        error={error}
        onUpload={uploadImages}
      />
    </div>
  )
}
