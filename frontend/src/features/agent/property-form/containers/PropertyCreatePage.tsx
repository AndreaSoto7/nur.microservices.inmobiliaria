import { Link, useNavigate } from 'react-router'
import { PropertyDataForm } from '../components/PropertyDataForm'
import {
  EMPTY_PROPERTY_VALUES,
  toCreateRequest,
  type PropertyFormValues,
} from '../propertyFormValues'
import { useCreateProperty } from '../usePropertyForm'

export function PropertyCreatePage() {
  const { createProperty, submitting, error, fieldErrors } = useCreateProperty()
  const navigate = useNavigate()

  async function handleSubmit(values: PropertyFormValues) {
    try {
      const { id } = await createProperty(toCreateRequest(values))
      navigate(`/agent/properties/${id}`, { replace: true })
    } catch {
      // El error ya queda en el estado de la mutación y lo muestra el formulario.
    }
  }

  return (
    <section className="page page--medium">
      <Link to="/agent/properties" className="back-link">
        ← Mis propiedades
      </Link>
      <div className="card editor__section">
        <div className="stack">
          <h1>Nueva propiedad</h1>
          <p className="row-card__meta">
            Se guarda como borrador: nadie la ve hasta que la publiques.
          </p>
        </div>
        <PropertyDataForm
          initialValues={EMPTY_PROPERTY_VALUES}
          lockKind={false}
          submitLabel="Crear borrador"
          submitVariant="primary"
          submitting={submitting}
          error={error}
          fieldErrors={fieldErrors}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  )
}
