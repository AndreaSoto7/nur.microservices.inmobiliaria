import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { TextField } from '../../../../shared/ui/TextField'

interface TimeProposalFormProps {
  initialValue: string
  minValue: string
  busy: boolean
  /** Qué pasa al enviar, en palabras de quien lo usa. */
  hint: string
  submitLabel: string
  /** Un aviso sobre el horario elegido (por ejemplo, que choca con otra visita); impide enviarlo. */
  warningFor?: (value: string) => string | undefined
  onSubmit: (value: string) => void
  onBack: () => void
}

/** Dumb: elegir otro horario para una visita (dura 60 minutos). Lo usan el agente y el interesado. */
export const TimeProposalForm = memo(function TimeProposalForm({
  initialValue,
  minValue,
  busy,
  hint,
  submitLabel,
  warningFor,
  onSubmit,
  onBack,
}: TimeProposalFormProps) {
  const [value, setValue] = useState(initialValue)
  const warning = value ? warningFor?.(value) : undefined

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!warning) onSubmit(value)
  }

  return (
    <form className="confirm-bar confirm-bar--neutral" onSubmit={handleSubmit}>
      <p>{hint}</p>
      <TextField
        label="Fecha y hora de la visita"
        type="datetime-local"
        required
        min={minValue}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {warning && (
        <p className="notice notice--warning" role="status">
          {warning}
        </p>
      )}
      <div className="action-bar">
        <Button type="submit" disabled={busy || Boolean(warning)}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          No, volver
        </Button>
      </div>
    </form>
  )
})
