import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { TextAreaField } from '../../../shared/ui/TextAreaField'

interface ReasonPanelProps {
  message: string
  reasonLabel: string
  reasonRequired: boolean
  confirmLabel: string
  busy: boolean
  onConfirm: (reason: string | undefined) => void
  onBack: () => void
}

/** Dumb: confirma en la misma fila una acción que puede llevar un motivo. */
export const ReasonPanel = memo(function ReasonPanel({
  message,
  reasonLabel,
  reasonRequired,
  confirmLabel,
  busy,
  onConfirm,
  onBack,
}: ReasonPanelProps) {
  const [reason, setReason] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onConfirm(reason.trim() || undefined)
  }

  return (
    <form className="confirm-bar" onSubmit={handleSubmit}>
      <p>{message}</p>
      <TextAreaField
        label={reasonLabel}
        required={reasonRequired}
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="action-bar">
        <Button type="submit" disabled={busy}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          No, volver
        </Button>
      </div>
    </form>
  )
})
