import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { TextField } from '../../../../shared/ui/TextField'

interface ScheduleVisitFormProps {
  initialValue: string
  minValue: string
  busy: boolean
  onSubmit: (value: string) => void
  onBack: () => void
}

export const ScheduleVisitForm = memo(function ScheduleVisitForm({
  initialValue,
  minValue,
  busy,
  onSubmit,
  onBack,
}: ScheduleVisitFormProps) {
  const [value, setValue] = useState(initialValue)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(value)
  }

  return (
    <form className="confirm-bar confirm-bar--neutral" onSubmit={handleSubmit}>
      <p>La visita dura 60 minutos.</p>
      <TextField
        label="Fecha y hora de la visita"
        type="datetime-local"
        required
        min={minValue}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="action-bar">
        <Button type="submit" disabled={busy}>
          Confirmar horario
        </Button>
        <Button variant="secondary" onClick={onBack}>
          No, volver
        </Button>
      </div>
    </form>
  )
})
