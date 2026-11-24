import { memo, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Dialog } from '../../../../shared/ui/Dialog'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { TextAreaField } from '../../../../shared/ui/TextAreaField'

/** Cómo quedó el interesado después de la visita. FOLLOW_UP deja la oportunidad abierta. */
export type VisitOutcome = 'FOLLOW_UP' | 'WON' | 'LOST'

const OUTCOMES: { value: VisitOutcome; label: string; hint: string }[] = [
  { value: 'FOLLOW_UP', label: 'Sigue interesado', hint: 'La oportunidad queda abierta.' },
  {
    value: 'WON',
    label: 'Cierra el trato',
    hint: 'La oportunidad se gana y la propiedad queda reservada.',
  },
  { value: 'LOST', label: 'No le interesó', hint: 'La oportunidad se cierra como perdida.' },
]

export type LeadLookup = 'loading' | 'found' | 'missing'

interface VisitOutcomeDialogProps {
  propertyName: string
  lead: LeadLookup
  busy: boolean
  error?: string
  onSubmit: (outcome: VisitOutcome, note: string | undefined) => void
  onClose: () => void
}

/**
 * Dumb: al marcar una visita como realizada, el agente deja una nota y dice cómo quedó el interesado.
 * Sin oportunidad abierta con ese interesado, solo se marca la visita.
 */
export const VisitOutcomeDialog = memo(function VisitOutcomeDialog({
  propertyName,
  lead,
  busy,
  error,
  onSubmit,
  onClose,
}: VisitOutcomeDialogProps) {
  const groupName = useId()
  const [outcome, setOutcome] = useState<VisitOutcome>('FOLLOW_UP')
  const [note, setNote] = useState('')
  const withLead = lead === 'found'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(withLead ? outcome : 'FOLLOW_UP', withLead ? note.trim() || undefined : undefined)
  }

  return (
    <Dialog title="Visita realizada" onClose={busy ? () => undefined : onClose}>
      <form className="dialog__body" onSubmit={handleSubmit}>
        <p className="dialog__lead">{propertyName}</p>
        {lead === 'loading' && <p className="muted">Buscando la oportunidad del interesado…</p>}
        {lead === 'missing' && (
          <p className="notice notice--neutral">
            No hay una oportunidad abierta con este interesado: solo se marca la visita como
            realizada.
          </p>
        )}
        {withLead && (
          <>
            <fieldset className="field outcome-options">
              <legend>¿Cómo quedó el interesado?</legend>
              {OUTCOMES.map((option) => (
                <label key={option.value} className="radio radio--rich">
                  <input
                    type="radio"
                    name={groupName}
                    checked={outcome === option.value}
                    onChange={() => setOutcome(option.value)}
                  />
                  <span className="radio__text">
                    <span className="radio__label">{option.label}</span>
                    <span className="radio__hint">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <TextAreaField
              label="Nota (opcional)"
              placeholder="Qué le pareció, qué preguntó, cómo sigue."
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </>
        )}
        {error && <ErrorMessage message={error} />}
        <div className="action-bar dialog__actions">
          <Button type="submit" disabled={busy || lead === 'loading'}>
            {busy ? 'Guardando…' : outcome === 'WON' && withLead ? 'Guardar y reservar' : 'Guardar'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Volver
          </Button>
        </div>
      </form>
    </Dialog>
  )
})
