import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import { FEATURES, type Feature, type UpdateFeaturesRequest } from '../../../../core/models/listing'
import { FEATURE_LABELS } from '../../../../shared/format/property'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { TextField } from '../../../../shared/ui/TextField'

interface PropertyFeaturesFormProps {
  bedrooms?: number | null
  bathrooms?: number | null
  areaM2?: number | null
  features: Feature[]
  submitting: boolean
  saved: boolean
  error?: string
  fieldErrors: Record<string, string>
  onSubmit: (request: UpdateFeaturesRequest) => void
}

const asText = (value?: number | null) => (value == null ? '' : String(value))

export const PropertyFeaturesForm = memo(function PropertyFeaturesForm({
  bedrooms: initialBedrooms,
  bathrooms: initialBathrooms,
  areaM2: initialArea,
  features: initialFeatures,
  submitting,
  saved,
  error,
  fieldErrors,
  onSubmit,
}: PropertyFeaturesFormProps) {
  const [bedrooms, setBedrooms] = useState(asText(initialBedrooms))
  const [bathrooms, setBathrooms] = useState(asText(initialBathrooms))
  const [area, setArea] = useState(asText(initialArea))
  const [features, setFeatures] = useState(initialFeatures)

  function toggle(feature: Feature) {
    setFeatures((current) =>
      current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature],
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      areaM2: Number(area),
      features,
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__row">
        <TextField
          label="Dormitorios"
          type="number"
          inputMode="numeric"
          required
          min="0"
          max="100"
          step="1"
          value={bedrooms}
          error={fieldErrors.bedrooms}
          onChange={(event) => setBedrooms(event.target.value)}
        />
        <TextField
          label="Baños"
          type="number"
          inputMode="numeric"
          required
          min="0"
          max="100"
          step="1"
          value={bathrooms}
          error={fieldErrors.bathrooms}
          onChange={(event) => setBathrooms(event.target.value)}
        />
        <TextField
          label="Superficie (m²)"
          type="number"
          inputMode="decimal"
          required
          min="0.01"
          step="0.01"
          value={area}
          error={fieldErrors.areaM2}
          onChange={(event) => setArea(event.target.value)}
        />
      </div>
      <fieldset className="chip-group">
        <legend>Extras</legend>
        {FEATURES.map((feature) => (
          <label key={feature} className="chip">
            <input
              type="checkbox"
              checked={features.includes(feature)}
              onChange={() => toggle(feature)}
            />
            {FEATURE_LABELS[feature]}
          </label>
        ))}
      </fieldset>
      {error && <ErrorMessage message={error} />}
      <div className="form__actions">
        <Button type="submit" variant="secondary" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar características'}
        </Button>
        {saved && (
          <p className="notice notice--success" role="status">
            Características guardadas.
          </p>
        )}
      </div>
    </form>
  )
})
