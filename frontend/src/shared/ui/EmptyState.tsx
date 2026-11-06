import { memo } from 'react'
import type { ReactNode } from 'react'
import { HouseIcon } from './icons'

interface EmptyStateProps {
  title: string
  /** Usa 'h1' cuando este mensaje es todo el contenido de la página. */
  titleAs?: 'strong' | 'h1'
  children?: ReactNode
}

export const EmptyState = memo(function EmptyState({
  title,
  titleAs: Title = 'strong',
  children,
}: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <HouseIcon className="empty-state__icon" />
      <Title className="empty-state__title">{title}</Title>
      {children && <div>{children}</div>}
    </div>
  )
})
