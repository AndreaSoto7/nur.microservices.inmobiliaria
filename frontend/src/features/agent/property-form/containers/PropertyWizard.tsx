import { useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import type { PropertyDetail } from '../../../../core/models/listing'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { BasicsFields } from '../components/BasicsFields'
import { DetailsFields } from '../components/DetailsFields'
import { LocationFields } from '../components/LocationFields'
import { ReviewSummary } from '../components/ReviewSummary'
import { WizardPreview } from '../components/WizardPreview'
import { WizardSteps } from '../components/WizardSteps'
import { hasFields, LAST_LOCAL_STEP, STEP_TITLES } from '../propertyWizard'
import { useImageSources } from '../usePropertyForm'
import { usePropertyWizard } from '../usePropertyWizard'
import { PropertyImagesSection } from './PropertyImagesSection'
import { PropertyStatusSection } from './PropertyStatusSection'

/**
 * Smart: el asistente de propiedad, para crear (sin `property`) o editar. Cada paso muestra pocos datos;
 * la barra de pasos deja volver a cualquiera ya visitado.
 */
export function PropertyWizard({ property }: { property?: PropertyDetail }) {
  const wizard = usePropertyWizard(property)
  const sources = useImageSources(property)
  const cover = property
    ? [...property.images].sort((a, b) => a.position - b.position)[0]
    : undefined
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  const { step, next, previous, goTo } = wizard
  const copy = STEP_TITLES[step]
  // Una propiedad ya publicada no es un borrador: el último paso cambia su explicación.
  const hint =
    step === 'publicar' && property && property.status !== 'DRAFT'
      ? 'Así se ve la propiedad. Desde acá también cambias su estado.'
      : copy.hint

  // Al cambiar de paso, el foco va al título: el lector de pantalla lo anuncia y la página sube hasta él.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (next) goTo(next, formRef.current)
  }

  const creating = !wizard.editing && wizard.index === LAST_LOCAL_STEP
  const nextLabel = wizard.saving
    ? 'Guardando…'
    : creating
      ? 'Crear borrador y seguir'
      : 'Siguiente'

  const nav = (
    <div className={`wizard__nav${hasFields(step) ? ' wizard__nav--sticky' : ''}`}>
      {previous ? (
        <Button
          variant="secondary"
          disabled={wizard.saving}
          onClick={() => goTo(previous, formRef.current)}
        >
          Atrás
        </Button>
      ) : (
        <span />
      )}
      {next ? (
        <Button
          type={hasFields(step) ? 'submit' : 'button'}
          disabled={wizard.saving}
          onClick={hasFields(step) ? undefined : () => goTo(next, null)}
        >
          {nextLabel}
        </Button>
      ) : (
        <Link to="/agent/properties" className="button button--secondary">
          Volver a mis propiedades
        </Link>
      )}
    </div>
  )

  return (
    <div className="wizard">
      <div className="wizard__main">
        <WizardSteps
          current={step}
          reachable={wizard.reachable}
          onSelect={(target) => goTo(target, formRef.current)}
        />
        <div className="card wizard__card">
          <div className="wizard__head">
            <h2 ref={headingRef} tabIndex={-1} className="wizard__title">
              {copy.title}
            </h2>
            <p className="wizard__hint">{hint}</p>
          </div>
          {hasFields(step) ? (
            <form ref={formRef} className="form" onSubmit={handleSubmit}>
              {step === 'datos' && (
                <BasicsFields
                  values={wizard.values}
                  lockKind={wizard.editing}
                  fieldErrors={wizard.fieldErrors}
                  onChange={wizard.changeValues}
                />
              )}
              {step === 'ubicacion' && (
                <LocationFields
                  values={wizard.values}
                  fieldErrors={wizard.fieldErrors}
                  onChange={wizard.changeValues}
                />
              )}
              {step === 'detalles' && (
                <DetailsFields
                  description={wizard.values.description}
                  details={wizard.details}
                  fieldErrors={wizard.fieldErrors}
                  onDescriptionChange={wizard.changeDescription}
                  onChange={wizard.changeDetails}
                />
              )}
              {wizard.error && <ErrorMessage message={wizard.error} />}
              {wizard.editing && wizard.dirty && (
                <p className="wizard__unsaved">Los cambios se guardan al pasar de paso.</p>
              )}
              {nav}
            </form>
          ) : (
            property && (
              <div className="form">
                {step === 'fotos' && <PropertyImagesSection property={property} />}
                {step === 'publicar' && (
                  <>
                    <ReviewSummary property={property} />
                    <PropertyStatusSection property={property} />
                  </>
                )}
                {nav}
              </div>
            )
          )}
        </div>
      </div>
      <WizardPreview
        values={wizard.values}
        details={wizard.details}
        coverSrc={cover ? sources[cover.id] : undefined}
      />
    </div>
  )
}
