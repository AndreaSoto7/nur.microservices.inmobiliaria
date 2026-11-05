import { memo } from 'react'

interface ErrorMessageProps {
  title?: string
  message: string
}

export const ErrorMessage = memo(function ErrorMessage({ title, message }: ErrorMessageProps) {
  return (
    <div role="alert" className="error-message">
      {title && <strong>{title}</strong>}
      <p>{message}</p>
    </div>
  )
})
