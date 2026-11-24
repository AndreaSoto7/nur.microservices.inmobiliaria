import { memo, useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { LeadOutcome } from '../../../../core/models/visit'
import { LEAD_OUTCOME_LABELS } from '../../../../shared/format/lead'
import { Button } from '../../../../shared/ui/Button'
import { TextAreaField } from '../../../../shared/ui/TextAreaField'

const OUTCOMES: LeadOutcome[] = ['WON', 'LOST']

interface CloseLeadFormProps {
  busy: boolean
  onClose: (outcome: LeadOutcome, note: string | undefined) => void
  onBack: () => void
}

export const CloseLeadForm = memo(function CloseLeadForm({
  busy,
  onClose,
  onBack,
}: CloseLeadFormProps) {
  const groupName = useId()
  const [outcome, setOutcome] = useState<LeadOutcome>()
  const [note, setNote] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (outcome) onClose(outcome, note.trim() || undefined)
  }

  return (
    <form className="confirm-bar" onSubmit={handleSubmit}>
      <p>Cerrarla no se puede deshacer. Si la marcas como ganada, la propiedad se reserva.</p>
      <fieldset className="field">
        <legend>Resultado</legend>
        {OUTCOMES.map((option) => (
          <label key={option} className="radio">
            <input
              type="radio"
              name={groupName}
              required
              checked={outcome === option}
              onChange={() => setOutcome(option)}
            />
            {LEAD_OUTCOME_LABELS[option]}
          </label>
        ))}
      </fieldset>
      <TextAreaField
        label="Nota (opcional)"
        maxLength={2000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="action-bar">
        <Button type="submit" disabled={busy}>
          Confirmar cierre
        </Button>
        <Button variant="secondary" onClick={onBack}>
          No, volver
        </Button>
      </div>
    </form>
  )
})
