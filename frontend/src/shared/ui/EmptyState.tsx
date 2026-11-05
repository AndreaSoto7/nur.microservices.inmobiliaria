import { memo } from 'react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  children?: ReactNode
}

export const EmptyState = memo(function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  )
})
