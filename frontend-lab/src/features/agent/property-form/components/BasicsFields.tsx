import { memo } from 'react'
import {
  OPERATION_TYPES,
  PROPERTY_TYPES,
  type OperationType,
  type PropertyType,
} from '../../../../core/models/listing'
import { OPERATION_LABELS, PROPERTY_TYPE_LABELS } from '../../../../shared/format/property'
import { SelectField } from '../../../../shared/ui/SelectField'
import { TextField } from '../../../../shared/ui/TextField'
import type { PropertyFormValues } from '../propertyFormValues'

interface BasicsFieldsProps {
  values: PropertyFormValues
  /** Al editar, el contrato no deja cambiar el tipo ni la operación. */
  lockKind: boolean
  fieldErrors: Record<string, string>
  onChange: (patch: Partial<PropertyFormValues>) => void
}

/** Dumb: paso 1 del asistente. */
export const BasicsFields = memo(function BasicsFields({
  values,
  lockKind,
  fieldErrors,
  onChange,
}: BasicsFieldsProps) {
  return (
    <>
      <div className="form__row">
        <SelectField
          label="Tipo"
          disabled={lockKind}
          value={values.propertyType}
          error={fieldErrors.propertyType}
          onChange={(event) => onChange({ propertyType: event.target.value as PropertyType })}
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
          onChange={(event) => onChange({ operationType: event.target.value as OperationType })}
        >
          {OPERATION_TYPES.map((operation) => (
            <option key={operation} value={operation}>
              {OPERATION_LABELS[operation]}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        label="Título"
        required
        maxLength={150}
        placeholder="Casa con jardín en Equipetrol"
        value={values.title}
        error={fieldErrors.title}
        onChange={(event) => onChange({ title: event.target.value })}
      />
      <TextField
        label={values.operationType === 'RENT' ? 'Precio mensual (Bs)' : 'Precio (Bs)'}
        type="number"
        inputMode="decimal"
        required
        min="0.01"
        step="0.01"
        value={values.amount}
        error={fieldErrors['price.amount']}
        onChange={(event) => onChange({ amount: event.target.value })}
      />
    </>
  )
})
