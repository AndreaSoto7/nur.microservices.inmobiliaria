import { memo, useCallback } from 'react'
import { TextField } from '../../../../shared/ui/TextField'
import type { PropertyFormValues } from '../propertyFormValues'
import { LocationPicker } from './LocationPicker'

interface LocationFieldsProps {
  values: PropertyFormValues
  fieldErrors: Record<string, string>
  onChange: (patch: Partial<PropertyFormValues>) => void
}

/** Dumb: paso 2 del asistente. */
export const LocationFields = memo(function LocationFields({
  values,
  fieldErrors,
  onChange,
}: LocationFieldsProps) {
  const changeCoordinates = useCallback(
    (coordinates: PropertyFormValues['coordinates']) => onChange({ coordinates }),
    [onChange],
  )
  return (
    <>
      <div className="form__row">
        <TextField
          label="Zona"
          required
          maxLength={100}
          placeholder="Urubó, Equipetrol, Norte…"
          value={values.zone}
          error={fieldErrors['location.zone']}
          onChange={(event) => onChange({ zone: event.target.value })}
        />
        <TextField
          label="Dirección (opcional)"
          maxLength={255}
          value={values.address}
          error={fieldErrors['location.address']}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </div>
      <LocationPicker value={values.coordinates} onChange={changeCoordinates} />
    </>
  )
})
