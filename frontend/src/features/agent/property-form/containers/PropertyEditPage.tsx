import { Link, useParams } from 'react-router'
import { Button } from '../../../../shared/ui/Button'
import { EmptyState } from '../../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../../shared/ui/LoadingState'
import { PropertyStatusBadge } from '../../properties-admin/components/PropertyStatusBadge'
import { PropertyDataForm } from '../components/PropertyDataForm'
import { PropertyFeaturesSection } from './PropertyFeaturesSection'
import { PropertyImagesSection } from './PropertyImagesSection'
import { PropertyStatusSection } from './PropertyStatusSection'
import { toEditRequest, valuesFromDetail, type PropertyFormValues } from '../propertyFormValues'
import { useEditProperty } from '../usePropertyForm'

const BACK_LINK = (
  <Link to="/agente/propiedades" className="back-link">
    ← Mis propiedades
  </Link>
)

export function PropertyEditPage() {
  const { propertyId = '' } = useParams()
  const editor = useEditProperty(propertyId)

  if (editor.loading) {
    return (
      <section className="page page--medium">
        <LoadingState label="Cargando la propiedad…" />
      </section>
    )
  }
  if (editor.notFound) {
    return (
      <section className="page page--medium">
        {BACK_LINK}
        <EmptyState title="Propiedad no encontrada" titleAs="h1">
          Puede que la dirección esté mal.
        </EmptyState>
      </section>
    )
  }
  if (editor.loadError || !editor.property) {
    return (
      <section className="page page--medium stack">
        <ErrorMessage
          title="No se pudo cargar la propiedad"
          message={editor.loadError ?? 'Intenta de nuevo.'}
        />
        <Button variant="secondary" onClick={() => editor.retry()}>
          Reintentar
        </Button>
      </section>
    )
  }

  const { property } = editor
  const closed = property.status === 'SOLD' || property.status === 'RENTED'

  function handleSave(values: PropertyFormValues) {
    editor.saveProperty(toEditRequest(values, property.location))
  }

  return (
    <section className="page page--medium">
      {BACK_LINK}
      <div className="page-header">
        <h1>Editar propiedad</h1>
        <PropertyStatusBadge status={property.status} />
      </div>
      <div className="editor">
        {closed ? (
          <p className="notice notice--warning">
            Esta propiedad ya se cerró y ya no se puede editar.
          </p>
        ) : (
          <>
            <PropertyStatusSection property={property} />
            <div className="card editor__section">
              <h2>Datos</h2>
              <PropertyDataForm
                key={property.id}
                initialValues={valuesFromDetail(property)}
                lockKind
                submitLabel="Guardar cambios"
                submitVariant="secondary"
                submitting={editor.submitting}
                saved={editor.saved}
                error={editor.error}
                fieldErrors={editor.fieldErrors}
                onSubmit={handleSave}
              />
            </div>
            <PropertyFeaturesSection key={`features-${property.id}`} property={property} />
            <PropertyImagesSection property={property} />
          </>
        )}
      </div>
    </section>
  )
}
