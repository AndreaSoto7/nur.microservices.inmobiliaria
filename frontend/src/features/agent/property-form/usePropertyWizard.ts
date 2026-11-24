import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError, errorMessage } from '../../../core/api/problem'
import { propertiesApi } from '../../../core/api/propertiesApi'
import type { PropertyDetail } from '../../../core/models/listing'
import { invalidateProperty } from '../properties-admin/usePropertyTransition'
import {
  EMPTY_PROPERTY_VALUES,
  toCreateRequest,
  toEditRequest,
  valuesFromDetail,
  type PropertyFormValues,
} from './propertyFormValues'
import {
  detailsFromProperty,
  EMPTY_DETAILS,
  hasFields,
  LAST_LOCAL_STEP,
  parseStep,
  stepOfField,
  toFeaturesRequest,
  WIZARD_STEPS,
  type DetailsValues,
  type WizardStep,
} from './propertyWizard'

const CREATE_TIMEOUT_MESSAGE =
  'El servidor tardó demasiado y puede que el borrador se haya creado igual. Revisa Mis propiedades antes de volver a intentarlo.'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Facade del asistente de propiedad. Todo lo escrito vive acá, no en cada paso: volver atrás no pierde
 * nada. Al crear, los tres primeros pasos quedan en memoria y el borrador se crea al terminar los
 * detalles (las fotos necesitan que exista). Al editar, salir de un paso con cambios los guarda.
 */
export function usePropertyWizard(property?: PropertyDetail) {
  const editing = property !== undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const [values, setValues] = useState<PropertyFormValues>(() =>
    property ? valuesFromDetail(property) : EMPTY_PROPERTY_VALUES,
  )
  const [details, setDetails] = useState<DetailsValues>(() =>
    property ? detailsFromProperty(property) : EMPTY_DETAILS,
  )
  // Lo último que se guardó: contra esto se sabe si hay cambios.
  const [saved, setSaved] = useState(() => ({ values, details }))
  const [furthest, setFurthest] = useState(editing ? WIZARD_STEPS.length - 1 : 0)
  // Si se creó el borrador pero falló lo siguiente, reintentar no crea otro.
  const [createdId, setCreatedId] = useState<string>()

  const step = parseStep(search.get('paso'), furthest)
  const index = WIZARD_STEPS.indexOf(step)
  const dirty = !same(values, saved.values) || !same(details, saved.details)

  const save = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!property) {
        const id = createdId ?? (await propertiesApi.create(toCreateRequest(values))).id
        setCreatedId(id)
        await propertiesApi.updateFeatures(id, toFeaturesRequest(details))
        return id
      }
      if (!same(values, saved.values)) {
        await propertiesApi.update(property.id, toEditRequest(values, property.location))
      }
      if (!same(details, saved.details)) {
        await propertiesApi.updateFeatures(property.id, toFeaturesRequest(details))
      }
      return property.id
    },
    onSuccess: (id) => {
      setSaved({ values, details })
      return invalidateProperty(queryClient, id)
    },
  })

  const show = useCallback(
    (target: WizardStep) => {
      setFurthest((current) => Math.max(current, WIZARD_STEPS.indexOf(target)))
      setSearch({ paso: target })
    },
    [setSearch],
  )

  /** Si la API marcó un campo de otro paso, lleva a ese paso para que se vea el error. */
  const showFieldErrors = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return
      const [first] = Object.keys(error.fieldErrors)
      const target = first ? stepOfField(first) : undefined
      if (target) show(target)
    },
    [show],
  )

  /**
   * Ir a otro paso. Al avanzar (o al salir de un paso con cambios, si se edita) el navegador valida los
   * campos del paso actual; al editar, además se guardan.
   */
  const goTo = useCallback(
    async (target: WizardStep, form: HTMLFormElement | null) => {
      const targetIndex = WIZARD_STEPS.indexOf(target)
      if (targetIndex === index || save.isPending) return
      const forward = targetIndex > index
      const mustSave = editing && dirty && hasFields(step)
      if (form && (forward || mustSave) && !form.reportValidity()) return

      if (!editing && targetIndex > LAST_LOCAL_STEP) {
        try {
          const id = await save.mutateAsync()
          navigate(`/agent/properties/${id}?paso=${target}`, { replace: true })
        } catch (error) {
          showFieldErrors(error)
        }
        return
      }
      if (mustSave) {
        try {
          await save.mutateAsync()
        } catch (error) {
          showFieldErrors(error)
          return
        }
      }
      show(target)
    },
    [dirty, editing, index, navigate, save, show, showFieldErrors, step],
  )

  const changeValues = useCallback(
    (patch: Partial<PropertyFormValues>) => setValues((current) => ({ ...current, ...patch })),
    [],
  )
  const changeDetails = useCallback(
    (patch: Partial<DetailsValues>) => setDetails((current) => ({ ...current, ...patch })),
    [],
  )
  const changeDescription = useCallback(
    (description: string) => setValues((current) => ({ ...current, description })),
    [],
  )

  const timedOut =
    !editing && !createdId && save.error instanceof ApiError && save.error.status === 504

  return {
    editing,
    step,
    index,
    previous: index > 0 ? WIZARD_STEPS[index - 1] : undefined,
    next: index < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[index + 1] : undefined,
    /** Hasta dónde se puede saltar con la barra de pasos. */
    reachable: editing ? WIZARD_STEPS.length - 1 : Math.min(furthest, LAST_LOCAL_STEP),
    goTo,
    values,
    details,
    changeValues,
    changeDetails,
    changeDescription,
    dirty,
    saving: save.isPending,
    error: timedOut ? CREATE_TIMEOUT_MESSAGE : save.error ? errorMessage(save.error) : undefined,
    fieldErrors: save.error instanceof ApiError ? save.error.fieldErrors : {},
  }
}
