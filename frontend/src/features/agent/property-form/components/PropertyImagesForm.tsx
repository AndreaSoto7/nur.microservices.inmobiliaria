import { memo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { gatewayUrl } from '../../../../core/config'
import type { PropertyImage } from '../../../../core/models/listing'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { TextField } from '../../../../shared/ui/TextField'
import { imagesError, MAX_IMAGES } from '../propertyRequirements'

interface PropertyImagesFormProps {
  images: PropertyImage[]
  previewable: boolean
  uploading: boolean
  error?: string
  onUpload: (files: File[]) => void
}

export const PropertyImagesForm = memo(function PropertyImagesForm({
  images,
  previewable,
  uploading,
  error,
  onUpload,
}: PropertyImagesFormProps) {
  const [files, setFiles] = useState<File[]>([])
  const [selectionError, setSelectionError] = useState<string>()
  const ordered = [...images].sort((a, b) => a.position - b.position)

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    const invalid = imagesError(selected, images.length)
    setSelectionError(invalid)
    setFiles(invalid ? [] : selected)
    // Sin esto, volver a elegir el mismo archivo después de un error no dispara otro cambio.
    if (invalid) event.target.value = ''
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onUpload(files)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <p className="results-count">
        {images.length} de {MAX_IMAGES} fotos
      </p>
      {previewable && ordered.length > 0 && (
        <ul className="gallery__thumbs">
          {ordered.map((image) => (
            <li key={image.id} className="gallery__thumb gallery__thumb--static">
              <img src={gatewayUrl(image.url)} alt={`Foto ${image.position + 1}`} />
            </li>
          ))}
        </ul>
      )}
      {!previewable && images.length > 0 && (
        <p className="row-card__meta">Las fotos se ven cuando la propiedad está publicada.</p>
      )}
      {images.length < MAX_IMAGES && (
        <>
          <TextField
            label="Agregar fotos (JPG o PNG, hasta 5 MB cada una)"
            type="file"
            accept="image/jpeg,image/png"
            multiple
            error={selectionError}
            onChange={handleSelect}
          />
          {error && <ErrorMessage message={error} />}
          {files.length > 0 && (
            <div className="form__actions">
              <Button type="submit" variant="secondary" disabled={uploading}>
                {uploading
                  ? 'Subiendo…'
                  : `Subir ${files.length} ${files.length === 1 ? 'foto' : 'fotos'}`}
              </Button>
            </div>
          )}
        </>
      )}
    </form>
  )
})
