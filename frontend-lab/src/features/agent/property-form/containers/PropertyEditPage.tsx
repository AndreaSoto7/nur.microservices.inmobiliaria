import { ArrowLeftIcon } from '../../../../shared/ui/icons'
import { Link, useParams } from 'react-router'
import { Button } from '../../../../shared/ui/Button'
import { EmptyState } from '../../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../../shared/ui/LoadingState'
import { PropertyStatusBadge } from '../../properties-admin/components/PropertyStatusBadge'
import { useEditProperty } from '../usePropertyForm'
import { PropertyWizard } from './PropertyWizard'

const BACK_LINK = (
  <Link to="/agent/properties" className="back-link">
    <ArrowLeftIcon className="back-link__icon" />
    Mis propiedades
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

  return (
    <section className="page page--medium">
      {BACK_LINK}
      <div className="page-header">
        <h1>Editar propiedad</h1>
        <PropertyStatusBadge status={property.status} />
      </div>
      {closed ? (
        <p className="notice notice--warning">
          Esta propiedad ya se cerró y ya no se puede editar.
        </p>
      ) : (
        <PropertyWizard key={property.id} property={property} />
      )}
    </section>
  )
}
