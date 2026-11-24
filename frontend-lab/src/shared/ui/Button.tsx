import { memo } from 'react'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export const Button = memo(function Button({
  variant = 'primary',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = ['button', `button--${variant}`, className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
})
