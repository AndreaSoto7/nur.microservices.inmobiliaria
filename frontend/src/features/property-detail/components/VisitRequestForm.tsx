import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { TextAreaField } from '../../../shared/ui/TextAreaField'
import { TextField } from '../../../shared/ui/TextField'

export interface VisitRequestValues {
  /** Tal como lo da el `datetime-local`: hora local, sin zona. */
  proposedAt: string
  note: string
}

interface VisitRequestFormProps {
  /** Lo calcula el container: este componente no conoce el reloj. */
  minProposedAt: string
  submitting: boolean
  error?: string
  fieldErrors: Record<string, string>
  onSubmitRequest: (values: VisitRequestValues) => void
}

export const VisitRequestForm = memo(function VisitRequestForm({
  minProposedAt,
  submitting,
  error,
  fieldErrors,
  onSubmitRequest,
}: VisitRequestFormProps) {
  const [proposedAt, setProposedAt] = useState('')
  const [note, setNote] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmitRequest({ proposedAt, note })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <TextField
        label="Fecha y hora"
        type="datetime-local"
        required
        min={minProposedAt}
        value={proposedAt}
        error={fieldErrors.proposedAt}
        onChange={(event) => setProposedAt(event.target.value)}
      />
      <TextAreaField
        label="Nota para el agente (opcional)"
        maxLength={500}
        value={note}
        error={fieldErrors.clientNote}
        onChange={(event) => setNote(event.target.value)}
      />
      {error && <ErrorMessage message={error} />}
      <Button type="submit" className="button--block" disabled={submitting}>
        {submitting ? 'Enviando…' : 'Solicitar visita'}
      </Button>
    </form>
  )
})
