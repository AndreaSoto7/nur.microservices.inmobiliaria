import { memo, useState } from 'react'

/** Las descripciones largas se pueden ampliar sin desplazar el formulario de contacto. */
const LONG_DESCRIPTION = 420

/** Dumb: la descripción de la propiedad, junto a sus datos y ubicación. */
export const PropertyDescription = memo(function PropertyDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > LONG_DESCRIPTION
  return (
    <section className={`detail__description${expanded ? ' is-expanded' : ''}`}>
      <h2>Descripción</h2>
      <p
        className={
          long && !expanded ? 'detail__description-text is-clamped' : 'detail__description-text'
        }
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          className="link-button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </section>
  )
})
