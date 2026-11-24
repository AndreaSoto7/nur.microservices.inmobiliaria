import { memo, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import type { PropertyImage } from '../../../../core/models/listing'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { CloseIcon, TrashIcon, UploadIcon } from '../../../../shared/ui/icons'
import { fileProblem, fileSizeLabel, MAX_IMAGES } from '../propertyRequirements'

interface PropertyImagesFormProps {
  images: PropertyImage[]
  /** De dónde sale cada miniatura; undefined mientras carga. */
  sources: Record<string, string | undefined>
  /** Publicada o reservada: no se puede quedar sin fotos. */
  keepsOne: boolean
  uploading: boolean
  error?: string
  removingId?: string
  removeError?: string
  onUpload: (files: File[]) => void
  onRemove: (imageId: string) => void
}

interface Selected {
  key: string
  file: File
  problem?: string
  /** data: URL de la vista previa (la CSP del frontend no admite blob:). */
  preview?: string
}

let nextKey = 0

/**
 * Dumb: la galería de una propiedad. Muestra las fotos subidas (la primera es la portada) y deja quitarlas;
 * las nuevas se ven antes de subirlas, cada una con su problema si lo tiene.
 */
export const PropertyImagesForm = memo(function PropertyImagesForm({
  images,
  sources,
  keepsOne,
  uploading,
  error,
  removingId,
  removeError,
  onUpload,
  onRemove,
}: PropertyImagesFormProps) {
  const [selected, setSelected] = useState<Selected[]>([])
  const [confirming, setConfirming] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const ordered = [...images].sort((a, b) => a.position - b.position)
  const free = MAX_IMAGES - images.length
  const overLimit = selected.length > free
  const valid = selected.length > 0 && !overLimit && selected.every((item) => !item.problem)
  const onlyPhotoLocked = keepsOne && images.length === 1

  function add(files: File[]) {
    const added = files.map((file) => ({
      key: `${file.name}-${file.size}-${nextKey++}`,
      file,
      problem: fileProblem(file),
    }))
    setSelected((current) => [...current, ...added])
    for (const item of added) {
      if (item.problem) continue
      const reader = new FileReader()
      reader.onload = () =>
        setSelected((current) =>
          current.map((entry) =>
            entry.key === item.key ? { ...entry, preview: String(reader.result) } : entry,
          ),
        )
      reader.readAsDataURL(item.file)
    }
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    add(Array.from(event.target.files ?? []))
    // Sin esto, volver a elegir el mismo archivo no dispara otro cambio.
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    add(Array.from(event.dataTransfer.files))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (valid) onUpload(selected.map((item) => item.file))
  }

  return (
    <div className="gallery-editor">
      <p className="results-count">
        {images.length} de {MAX_IMAGES} fotos
      </p>

      {ordered.length > 0 && (
        <ul className="gallery-editor__grid" aria-label="Fotos subidas">
          {ordered.map((image, index) => {
            const source = sources[image.id]
            const removing = removingId === image.id
            return (
              <li key={image.id} className="gallery-tile">
                {source ? (
                  <img className="gallery-tile__image" src={source} alt={`Foto ${index + 1}`} />
                ) : (
                  <div className="gallery-tile__image skeleton" aria-hidden="true" />
                )}
                {index === 0 && <span className="gallery-tile__badge">Portada</span>}
                {confirming === image.id ? (
                  <div className="gallery-tile__confirm">
                    <p>¿Quitar esta foto?</p>
                    <div className="action-bar">
                      <Button
                        disabled={removing}
                        onClick={() => {
                          onRemove(image.id)
                          setConfirming(undefined)
                        }}
                      >
                        Quitar
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirming(undefined)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  !onlyPhotoLocked && (
                    <button
                      type="button"
                      className="gallery-tile__remove"
                      aria-label={`Quitar la foto ${index + 1}`}
                      disabled={removing}
                      onClick={() => setConfirming(image.id)}
                    >
                      <TrashIcon className="gallery-tile__remove-icon" />
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
      {onlyPhotoLocked && (
        <p className="row-card__meta">
          Es la única foto de una propiedad publicada: para cambiarla, sube otra y después quita
          esta.
        </p>
      )}
      {removeError && <ErrorMessage message={removeError} />}

      {free > 0 && (
        <form className="form" onSubmit={handleSubmit}>
          <label
            className={dragging ? 'dropzone is-dragging' : 'dropzone'}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <UploadIcon className="dropzone__icon" />
            <span className="dropzone__title">
              Arrastra las fotos aquí o <span className="dropzone__link">elígelas</span>
            </span>
            <span className="dropzone__hint">
              JPG o PNG, hasta 5 MB cada una. Puedes agregar {free} más.
            </span>
            <input
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png"
              multiple
              aria-label="Agregar fotos (JPG o PNG, hasta 5 MB cada una)"
              onChange={handleSelect}
            />
          </label>

          {selected.length > 0 && (
            <ul className="gallery-editor__grid" aria-label="Fotos por subir">
              {selected.map((item) => (
                <li
                  key={item.key}
                  className={item.problem ? 'gallery-tile gallery-tile--invalid' : 'gallery-tile'}
                >
                  {item.preview ? (
                    <img className="gallery-tile__image" src={item.preview} alt="" />
                  ) : (
                    <div
                      className="gallery-tile__image gallery-tile__image--empty"
                      aria-hidden="true"
                    />
                  )}
                  <div className="gallery-tile__caption">
                    <span className="gallery-tile__name">{item.file.name}</span>
                    <span className="gallery-tile__size">{fileSizeLabel(item.file.size)}</span>
                    {item.problem && <span className="field__error">{item.problem}</span>}
                  </div>
                  <button
                    type="button"
                    className="gallery-tile__remove"
                    aria-label={`No subir ${item.file.name}`}
                    onClick={() =>
                      setSelected((current) => current.filter((entry) => entry.key !== item.key))
                    }
                  >
                    <CloseIcon className="gallery-tile__remove-icon" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {overLimit && (
            <p className="field__error" role="alert">
              Puedes agregar hasta {free} {free === 1 ? 'foto' : 'fotos'}: quita{' '}
              {selected.length - free} de la lista.
            </p>
          )}
          {error && <ErrorMessage message={error} />}
          {selected.length > 0 && (
            <div className="form__actions">
              <Button type="submit" disabled={uploading || !valid}>
                {uploading
                  ? 'Subiendo…'
                  : `Subir ${selected.length} ${selected.length === 1 ? 'foto' : 'fotos'}`}
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  )
})
