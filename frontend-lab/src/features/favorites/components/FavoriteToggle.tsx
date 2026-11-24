import { memo } from 'react'
import { Button } from '../../../shared/ui/Button'
import { HeartIcon } from '../../../shared/ui/icons'

interface FavoriteToggleProps {
  saved: boolean
  busy: boolean
  onToggle: () => void
}

export const FavoriteToggle = memo(function FavoriteToggle({
  saved,
  busy,
  onToggle,
}: FavoriteToggleProps) {
  return (
    <Button variant="secondary" disabled={busy} onClick={onToggle}>
      <HeartIcon className="favorite-toggle__icon" filled={saved} />
      {saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
    </Button>
  )
})
