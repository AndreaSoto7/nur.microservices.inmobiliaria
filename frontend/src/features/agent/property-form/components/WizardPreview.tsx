import { memo } from 'react'
import {
  FEATURE_LABELS,
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../../../shared/format/property'
import { HouseIcon, PinIcon } from '../../../../shared/ui/icons'
import type { PropertyFormValues } from '../propertyFormValues'
import type { DetailsValues } from '../propertyWizard'

interface WizardPreviewProps {
  values: PropertyFormValues
  details: DetailsValues
  /** La portada, si ya hay fotos. */
  coverSrc?: string
}

const plural = (count: string, one: string, many: string) =>
  `${count} ${Number(count) === 1 ? one : many}`

/** Dumb: cómo se va a ver la propiedad en el catálogo, con lo que se lleva escrito. */
export const WizardPreview = memo(function WizardPreview({
  values,
  details,
  coverSrc,
}: WizardPreviewProps) {
  const amount = Number(values.amount)
  const price =
    values.amount && amount > 0
      ? formatPrice({ amount, currency: 'BOB' }, values.operationType)
      : 'Precio a definir'
  const rooms = [
    details.bedrooms && plural(details.bedrooms, 'dormitorio', 'dormitorios'),
    details.bathrooms && plural(details.bathrooms, 'baño', 'baños'),
    details.areaM2 && `${details.areaM2} m²`,
  ].filter(Boolean)

  return (
    <aside className="wizard-preview" aria-label="Vista previa">
      <p className="wizard-preview__caption">Así se ve en el catálogo</p>
      <article className="wizard-preview__card">
        {coverSrc ? (
          <img className="wizard-preview__image" src={coverSrc} alt="" />
        ) : (
          <div className="wizard-preview__image media-placeholder" aria-hidden="true">
            <HouseIcon className="media-placeholder__icon" />
            Sin fotos todavía
          </div>
        )}
        <div className="wizard-preview__body">
          <p className="wizard-preview__zone">
            <PinIcon className="wizard-preview__pin" />
            {values.zone.trim() || 'Zona'}
          </p>
          <p className="wizard-preview__price">{price}</p>
          <p className="wizard-preview__title">{values.title.trim() || 'Título de la propiedad'}</p>
          <p className="wizard-preview__meta">
            {PROPERTY_TYPE_LABELS[values.propertyType]} en{' '}
            {OPERATION_LABELS[values.operationType].toLowerCase()}
          </p>
          {rooms.length > 0 && <p className="wizard-preview__meta">{rooms.join(' · ')}</p>}
          {details.features.length > 0 && (
            <p className="wizard-preview__meta">
              {details.features.map((feature) => FEATURE_LABELS[feature]).join(', ')}
            </p>
          )}
        </div>
      </article>
    </aside>
  )
})
