import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { TextAreaField } from '../../../shared/ui/TextAreaField'
import { TextField } from '../../../shared/ui/TextField'

export interface InquiryValues {
  name: string
  email: string
  phone: string
  message: string
}

interface InquiryFormProps {
  initialName: string
  initialEmail: string
  submitting: boolean
  error?: string
  fieldErrors: Record<string, string>
  onSubmitInquiry: (values: InquiryValues) => void
}

export const InquiryForm = memo(function InquiryForm({
  initialName,
  initialEmail,
  submitting,
  error,
  fieldErrors,
  onSubmitInquiry,
}: InquiryFormProps) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmitInquiry({ name, email, phone, message })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <TextField
        label="Nombre"
        autoComplete="name"
        required
        maxLength={150}
        value={name}
        error={fieldErrors.contactName}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        error={fieldErrors.contactEmail}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label="Teléfono (opcional)"
        type="tel"
        autoComplete="tel"
        maxLength={30}
        value={phone}
        error={fieldErrors.contactPhone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <TextAreaField
        label="Mensaje"
        required
        maxLength={2000}
        value={message}
        error={fieldErrors.message}
        onChange={(event) => setMessage(event.target.value)}
      />
      {error && <ErrorMessage message={error} />}
      <Button type="submit" variant="secondary" className="button--block" disabled={submitting}>
        {submitting ? 'Enviando…' : 'Enviar consulta'}
      </Button>
    </form>
  )
})
