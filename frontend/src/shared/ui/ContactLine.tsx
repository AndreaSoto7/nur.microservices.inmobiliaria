import { memo } from 'react'
import type { ClientContact } from '../../core/models/visit'

interface ContactLineProps {
  contact: ClientContact | undefined
}

/**
 * Dumb: a quién contactar, con enlaces para escribir y llamar. Lo que no se conoce no aparece; si no se
 * conoce nada, lo dice, así el agente sabe que no es un error de la pantalla.
 */
export const ContactLine = memo(function ContactLine({ contact }: ContactLineProps) {
  if (!contact || (!contact.name && !contact.email && !contact.phone)) {
    return <p className="contact-line contact-line--empty">Interesado sin datos de contacto</p>
  }
  return (
    <p className="contact-line">
      <span className="contact-line__name">{contact.name ?? 'Interesado'}</span>
      {contact.email && (
        <a className="contact-line__link" href={`mailto:${contact.email}`}>
          {contact.email}
        </a>
      )}
      {contact.phone && (
        <a className="contact-line__link" href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>
          {contact.phone}
        </a>
      )}
    </p>
  )
})
