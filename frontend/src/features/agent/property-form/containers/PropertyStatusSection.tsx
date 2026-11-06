import type { PropertyDetail } from '../../../../core/models/listing'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { PropertyActions } from '../../properties-admin/components/PropertyActions'
import { usePropertyTransition } from '../../properties-admin/usePropertyTransition'
import { PublishChecklist } from '../components/PublishChecklist'
import { publishBlockers } from '../propertyRequirements'

export function PropertyStatusSection({ property }: { property: PropertyDetail }) {
  const { runTransition, pendingPropertyId, error } = usePropertyTransition()
  const canPublish = property.status === 'DRAFT' || property.status === 'PAUSED'
  const blockers = canPublish ? publishBlockers(property) : []

  return (
    <div className="card editor__section">
      <h2>Estado</h2>
      <PublishChecklist blockers={blockers} />
      <PropertyActions
        title={property.title}
        status={property.status}
        operationType={property.operationType}
        busy={pendingPropertyId === property.id}
        primary="publish"
        blocked={blockers.length > 0 ? ['publish'] : []}
        onRun={(transition) => runTransition({ propertyId: property.id, transition })}
      />
      {error && <ErrorMessage message={error} />}
    </div>
  )
}
