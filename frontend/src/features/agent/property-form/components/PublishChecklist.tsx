import { memo } from 'react'

export const PublishChecklist = memo(function PublishChecklist({
  blockers,
}: {
  blockers: string[]
}) {
  if (blockers.length === 0) return null
  return (
    <div className="stack">
      <p className="results-count">Para publicar falta:</p>
      <ul className="checklist">
        {blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
    </div>
  )
})
