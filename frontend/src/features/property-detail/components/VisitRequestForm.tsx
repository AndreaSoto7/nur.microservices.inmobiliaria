import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { TextAreaField } from '../../../shared/ui/TextAreaField'
import { TextField } from '../../../shared/ui/TextField'
import { keepPhoneCharacters, PHONE_MAX_LENGTH, phoneProblem } from '../../../shared/format/phone'

export interface VisitRequestValues {
  /** Tal como lo da el `datetime-local`: hora local, sin zona. */
  proposedAt: string
  note: string
  /** Opcional: para que el agente pueda llamar. */
  phone: string
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
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string>()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = phoneProblem(phone)
    setPhoneError(problem)
    if (problem) return
    onSubmitRequest({ proposedAt, note, phone })
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
      <TextField
        label="Teléfono (opcional)"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+591 71234567"
        maxLength={PHONE_MAX_LENGTH}
        value={phone}
        error={phoneError ?? fieldErrors.contactPhone}
        onChange={(event) => {
          setPhone(keepPhoneCharacters(event.target.value))
          setPhoneError(undefined)
        }}
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
