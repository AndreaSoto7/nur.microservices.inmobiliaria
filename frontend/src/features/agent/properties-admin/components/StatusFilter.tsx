import { memo } from 'react'
import { PROPERTY_STATUSES, type PropertyStatus } from '../../../../core/models/listing'
import { PROPERTY_STATUS_LABELS } from '../../../../shared/format/property'

interface StatusFilterProps {
  value: PropertyStatus | undefined
  onStatusChange: (status: PropertyStatus | undefined) => void
}

export const StatusFilter = memo(function StatusFilter({
  value,
  onStatusChange,
}: StatusFilterProps) {
  return (
    <label className="sort-select">
      Estado
      <select
        className="select"
        value={value ?? ''}
        onChange={(event) =>
          onStatusChange((event.target.value || undefined) as PropertyStatus | undefined)
        }
      >
        <option value="">Todos</option>
        {PROPERTY_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PROPERTY_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </label>
  )
})
