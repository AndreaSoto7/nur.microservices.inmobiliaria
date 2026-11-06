import { memo } from 'react'
import type { PropertyStatus } from '../../../../core/models/listing'
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONES } from '../../../../shared/format/property'
import { StatusBadge } from '../../../../shared/ui/StatusBadge'

export const PropertyStatusBadge = memo(function PropertyStatusBadge({
  status,
}: {
  status: PropertyStatus
}) {
  return <StatusBadge label={PROPERTY_STATUS_LABELS[status]} tone={PROPERTY_STATUS_TONES[status]} />
})
