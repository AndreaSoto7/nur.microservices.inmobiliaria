import { memo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { gatewayUrl } from '../../../core/config'
import type { PropertyImage } from '../../../core/models/listing'
import { ChevronRightIcon, HouseIcon } from '../../../shared/ui/icons'

/** Cuánto hay que deslizar el dedo para pasar de foto. */
const SWIPE_PX = 40

interface ImageGalleryProps {
  images: PropertyImage[]
  /** Para el texto alternativo de cada foto. */
  title: string
}

/**
 * Dumb: foto principal con flechas (y deslizar en el celular) y miniaturas. No pasa sola: la persona
 * decide cuándo ver la siguiente. La elegida es estado de UI, no de datos.
 */
export const ImageGallery = memo(function ImageGallery({ images, title }: ImageGalleryProps) {
  const ordered = [...images].sort((a, b) => a.position - b.position)
  const [selectedId, setSelectedId] = useState(ordered[0]?.id)
  const selected = ordered.find((image) => image.id === selectedId) ?? ordered[0]
  const swipeStart = useRef<number | null>(null)

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

  const index = ordered.indexOf(selected)
  const several = ordered.length > 1
  const go = (step: number) =>
    setSelectedId(ordered[(index + step + ordered.length) % ordered.length].id)

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStart.current === null || event.pointerType === 'mouse') return
    const distance = event.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(distance) >= SWIPE_PX) go(distance < 0 ? 1 : -1)
  }

  return (
    <div className="gallery">
      <div
        className="gallery__stage"
        onPointerDown={(event) => {
          swipeStart.current = event.clientX
        }}
        onPointerUp={several ? handlePointerUp : undefined}
      >
        <img
          className="gallery__main"
          src={gatewayUrl(selected.url)}
          alt={`${title}, foto ${index + 1} de ${ordered.length}`}
          draggable={false}
        />
        {several && (
          <>
            <button
              type="button"
              className="gallery__nav gallery__nav--prev"
              aria-label="Foto anterior"
              onClick={() => go(-1)}
            >
              <ChevronRightIcon className="gallery__nav-icon" />
            </button>
            <button
              type="button"
              className="gallery__nav gallery__nav--next"
              aria-label="Foto siguiente"
              onClick={() => go(1)}
            >
              <ChevronRightIcon className="gallery__nav-icon" />
            </button>
            <span className="gallery__counter" aria-hidden="true">
              {index + 1} / {ordered.length}
            </span>
          </>
        )}
      </div>
      {several && (
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
