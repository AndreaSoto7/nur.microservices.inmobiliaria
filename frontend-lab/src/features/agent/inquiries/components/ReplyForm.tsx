import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { TextAreaField } from '../../../../shared/ui/TextAreaField'

interface ReplyFormProps {
  sending: boolean
  error?: string
  fieldError?: string
  onReply: (message: string) => void
}

/** Dumb: la respuesta del agente. Una por consulta: al enviarla, el interesado recibe un aviso. */
export const ReplyForm = memo(function ReplyForm({
  sending,
  error,
  fieldError,
  onReply,
}: ReplyFormProps) {
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = message.trim()
    if (text) onReply(text)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <TextAreaField
        label="Tu respuesta"
        required
        maxLength={2000}
        value={message}
        error={fieldError}
        onChange={(event) => setMessage(event.target.value)}
      />
      <p className="row-card__meta">El interesado recibe un aviso y la ve en Mis consultas.</p>
      {error && !fieldError && <ErrorMessage message={error} />}
      <div className="form__actions">
        <Button type="submit" disabled={sending || !message.trim()}>
          {sending ? 'Enviando…' : 'Enviar respuesta'}
        </Button>
      </div>
    </form>
  )
})
