import { memo, useState } from 'react'
import { gatewayUrl } from '../../../core/config'
import type { PropertyImage } from '../../../core/models/listing'
import { HouseIcon } from '../../../shared/ui/icons'

interface ImageGalleryProps {
  images: PropertyImage[]
  /** Para el texto alternativo de cada foto. */
  title: string
}

/** Dumb: foto principal y miniaturas. La elegida es estado de UI, no de datos. */
export const ImageGallery = memo(function ImageGallery({ images, title }: ImageGalleryProps) {
  const ordered = [...images].sort((a, b) => a.position - b.position)
  const [selectedId, setSelectedId] = useState(ordered[0]?.id)
  const selected = ordered.find((image) => image.id === selectedId) ?? ordered[0]

  if (!selected) {
    return (
      <div className="gallery__empty" aria-hidden="true">
        <div className="media-placeholder">
          <HouseIcon className="media-placeholder__icon" />
          Sin fotos
        </div>
      </div>
    )
  }

  return (
    <div className="gallery">
      <img
        className="gallery__main"
        src={gatewayUrl(selected.url)}
        alt={`${title}, foto ${ordered.indexOf(selected) + 1} de ${ordered.length}`}
      />
      {ordered.length > 1 && (
        <ul className="gallery__thumbs" aria-label="Fotos">
          {ordered.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                className="gallery__thumb"
                aria-label={`Ver foto ${index + 1}`}
                aria-pressed={image.id === selected.id}
                onClick={() => setSelectedId(image.id)}
              >
                <img src={gatewayUrl(image.url)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
