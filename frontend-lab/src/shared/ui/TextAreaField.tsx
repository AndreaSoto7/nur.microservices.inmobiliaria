import { memo, useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  error?: string
}

export const TextAreaField = memo(function TextAreaField({
  label,
  error,
  ...textareaProps
}: TextAreaFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...textareaProps}
      />
      {error && (
        <span id={errorId} className="field__error">
          {error}
        </span>
      )}
    </div>
  )
})
