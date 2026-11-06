import type { PropertyDetail } from '../../../../core/models/listing'
import { PropertyFeaturesForm } from '../components/PropertyFeaturesForm'
import { useUpdateFeatures } from '../usePropertyForm'

export function PropertyFeaturesSection({ property }: { property: PropertyDetail }) {
  const { saveFeatures, saved, submitting, error, fieldErrors } = useUpdateFeatures(property.id)
  return (
    <div className="card editor__section">
      <h2>Características</h2>
      <PropertyFeaturesForm
        bedrooms={property.bedrooms}
        bathrooms={property.bathrooms}
        areaM2={property.areaM2}
        features={property.features}
        submitting={submitting}
        saved={saved}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={saveFeatures}
      />
    </div>
  )
}
