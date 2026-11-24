import { memo } from 'react'
import { FEATURES, type Feature } from '../../../../core/models/listing'
import { FEATURE_LABELS } from '../../../../shared/format/property'
import { TextAreaField } from '../../../../shared/ui/TextAreaField'
import { TextField } from '../../../../shared/ui/TextField'
import type { DetailsValues } from '../propertyWizard'

interface DetailsFieldsProps {
  description: string
  details: DetailsValues
  fieldErrors: Record<string, string>
  onDescriptionChange: (description: string) => void
  onChange: (patch: Partial<DetailsValues>) => void
}

/** Dumb: paso 3 del asistente. Dormitorios, baños y superficie son obligatorios para publicar. */
export const DetailsFields = memo(function DetailsFields({
  description,
  details,
  fieldErrors,
  onDescriptionChange,
  onChange,
}: DetailsFieldsProps) {
  function toggle(feature: Feature) {
    onChange({
      features: details.features.includes(feature)
        ? details.features.filter((item) => item !== feature)
        : [...details.features, feature],
    })
  }

  return (
    <>
      <div className="form__row form__row--three">
        <TextField
          label="Dormitorios"
          type="number"
          inputMode="numeric"
          required
          min="0"
          max="100"
          step="1"
          value={details.bedrooms}
          error={fieldErrors.bedrooms}
          onChange={(event) => onChange({ bedrooms: event.target.value })}
        />
        <TextField
          label="Baños"
          type="number"
          inputMode="numeric"
          required
          min="0"
          max="100"
          step="1"
          value={details.bathrooms}
          error={fieldErrors.bathrooms}
          onChange={(event) => onChange({ bathrooms: event.target.value })}
        />
        <TextField
          label="Superficie (m²)"
          type="number"
          inputMode="decimal"
          required
          min="0.01"
          step="0.01"
          value={details.areaM2}
          error={fieldErrors.areaM2}
          onChange={(event) => onChange({ areaM2: event.target.value })}
        />
      </div>
      <fieldset className="chip-group">
        <legend>Extras</legend>
        {FEATURES.map((feature) => (
          <label key={feature} className="chip">
            <input
              type="checkbox"
              checked={details.features.includes(feature)}
              onChange={() => toggle(feature)}
            />
            {FEATURE_LABELS[feature]}
          </label>
        ))}
      </fieldset>
      <TextAreaField
        label="Descripción (opcional)"
        maxLength={5000}
        placeholder="Lo que no se ve en las fotos: orientación, vecindario, estado, expensas…"
        value={description}
        error={fieldErrors.description}
        onChange={(event) => onDescriptionChange(event.target.value)}
      />
    </>
  )
})
