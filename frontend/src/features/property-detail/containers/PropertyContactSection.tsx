import { Link, useLocation } from 'react-router'
import { useAuth } from '../../../core/auth/AuthContext'
import type { PropertyStatus } from '../../../core/models/listing'
import { localInputToUtc, toLocalInputValue } from '../../../shared/format/date'
import { InquiryForm, type InquiryValues } from '../components/InquiryForm'
import { VisitRequestForm, type VisitRequestValues } from '../components/VisitRequestForm'
import { useRequestVisit, useSendInquiry } from '../usePropertyContact'

interface PropertyContactSectionProps {
  propertyId: string
  propertyStatus: PropertyStatus
}

/** Smart: visit solo acepta solicitudes de un `CLIENT` sobre una propiedad `PUBLISHED`. */
export function PropertyContactSection({
  propertyId,
  propertyStatus,
}: PropertyContactSectionProps) {
  const { status, user, hasRole } = useAuth()
  const location = useLocation()
  const visit = useRequestVisit()
  const inquiry = useSendInquiry()

  if (propertyStatus !== 'PUBLISHED') return null
  if (status === 'anonymous') {
    return (
      <Link
        to="/login"
        state={{ from: location.pathname }}
        className="button button--secondary button--block"
      >
        Ingresa para guardarla, consultar o pedir una visita
      </Link>
    )
  }
  if (!hasRole('CLIENT') || !user) return null

  function handleVisit({ proposedAt, note }: VisitRequestValues) {
    const clientNote = note.trim()
    visit.requestVisit({
      propertyId,
      proposedAt: localInputToUtc(proposedAt),
      ...(clientNote ? { clientNote } : {}),
    })
  }

  function handleInquiry({ name, email, phone, message }: InquiryValues) {
    const contactPhone = phone.trim()
    inquiry.sendInquiry({
      propertyId,
      contactName: name.trim(),
      contactEmail: email.trim(),
      ...(contactPhone ? { contactPhone } : {}),
      message: message.trim(),
    })
  }

  return (
    <>
      <details className="contact-panel">
        <summary>Solicitar una visita</summary>
        {visit.sent ? (
          <p className="notice notice--success" role="status">
            Solicitud enviada. El agente va a confirmar el horario.{' '}
            <Link to="/my-visits">Ver mis visitas</Link>
          </p>
        ) : (
          <VisitRequestForm
            minProposedAt={toLocalInputValue(new Date())}
            submitting={visit.submitting}
            error={visit.error}
            fieldErrors={visit.fieldErrors}
            onSubmitRequest={handleVisit}
          />
        )}
      </details>
      <details className="contact-panel">
        <summary>Enviar una consulta</summary>
        {inquiry.sent ? (
          <p className="notice notice--success" role="status">
            Consulta enviada. El agente la recibe con tus datos de contacto.
          </p>
        ) : (
          <InquiryForm
            initialName={user.fullName}
            initialEmail={user.email}
            submitting={inquiry.submitting}
            error={inquiry.error}
            fieldErrors={inquiry.fieldErrors}
            onSubmitInquiry={handleInquiry}
          />
        )}
      </details>
    </>
  )
}
