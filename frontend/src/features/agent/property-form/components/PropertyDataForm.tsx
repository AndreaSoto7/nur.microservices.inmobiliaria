import { memo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  OPERATION_TYPES,
  PROPERTY_TYPES,
  type OperationType,
  type PropertyType,
} from '../../../../core/models/listing'
import { OPERATION_LABELS, PROPERTY_TYPE_LABELS } from '../../../../shared/format/property'
import { Button } from '../../../../shared/ui/Button'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { SelectField } from '../../../../shared/ui/SelectField'
import { TextAreaField } from '../../../../shared/ui/TextAreaField'
import { TextField } from '../../../../shared/ui/TextField'
import type { PropertyFormValues } from '../propertyFormValues'

interface PropertyDataFormProps {
  initialValues: PropertyFormValues
  /** Al editar, el contrato no deja cambiar el tipo ni la operación. */
  lockKind: boolean
  submitLabel: string
  submitVariant: 'primary' | 'secondary'
  submitting: boolean
  saved?: boolean
  error?: string
  /** Errores por campo de la API, con sus nombres del contrato (`price.amount`, `location.zone`). */
  fieldErrors: Record<string, string>
  onSubmit: (values: PropertyFormValues) => void
}

export const PropertyDataForm = memo(function PropertyDataForm({
  initialValues,
  lockKind,
  submitLabel,
  submitVariant,
  submitting,
  saved,
  error,
  fieldErrors,
  onSubmit,
}: PropertyDataFormProps) {
  const [values, setValues] = useState(initialValues)

  function update<K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(values)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <TextField
        label="Título"
        required
        maxLength={150}
        value={values.title}
        error={fieldErrors.title}
        onChange={(event) => update('title', event.target.value)}
      />
      <div className="form__row">
        <SelectField
          label="Tipo"
          disabled={lockKind}
          value={values.propertyType}
          error={fieldErrors.propertyType}
          onChange={(event) => update('propertyType', event.target.value as PropertyType)}
        >
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROPERTY_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Operación"
          disabled={lockKind}
          value={values.operationType}
          error={fieldErrors.operationType}
          onChange={(event) => update('operationType', event.target.value as OperationType)}
        >
          {OPERATION_TYPES.map((operation) => (
            <option key={operation} value={operation}>
              {OPERATION_LABELS[operation]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={values.operationType === 'RENT' ? 'Precio mensual (Bs)' : 'Precio (Bs)'}
          type="number"
          inputMode="decimal"
          required
          min="0.01"
          step="0.01"
          value={values.amount}
          error={fieldErrors['price.amount']}
          onChange={(event) => update('amount', event.target.value)}
        />
      </div>
      <div className="form__row">
        <TextField
          label="Zona"
          required
          maxLength={100}
          value={values.zone}
          error={fieldErrors['location.zone']}
          onChange={(event) => update('zone', event.target.value)}
        />
        <TextField
          label="Dirección (opcional)"
          maxLength={255}
          value={values.address}
          error={fieldErrors['location.address']}
          onChange={(event) => update('address', event.target.value)}
        />
      </div>
      <TextAreaField
        label="Descripción (opcional)"
        maxLength={5000}
        value={values.description}
        error={fieldErrors.description}
        onChange={(event) => update('description', event.target.value)}
      />
      {error && <ErrorMessage message={error} />}
      <div className="form__actions">
        <Button type="submit" variant={submitVariant} disabled={submitting}>
          {submitting ? 'Guardando…' : submitLabel}
        </Button>
        {saved && (
          <p className="notice notice--success" role="status">
            Cambios guardados.
          </p>
        )}
      </div>
    </form>
  )
})
