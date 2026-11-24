/** RFC 9457 con las extensiones del proyecto (rule api-rest). */
export interface ProblemFieldError {
  field: string
  message: string
}

export interface Problem {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  code: string
  correlationId?: string
  errors?: ProblemFieldError[]
}

export function isProblem(value: unknown): value is Problem {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.title === 'string' && typeof candidate.status === 'number'
}

/** Error de una llamada a la API. status 0 = no hubo respuesta (red caída, gateway apagado). */
export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null

  constructor(status: number, problem: Problem | null, fallbackMessage?: string) {
    super(problem?.detail ?? problem?.title ?? fallbackMessage ?? `Error HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }

  get code(): string | undefined {
    return this.problem?.code
  }

  /** Errores de validación por campo, para mostrarlos junto a cada input. */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const error of this.problem?.errors ?? []) {
      result[error.field] ??= error.message
    }
    return result
  }
}

/** Mensaje para mostrar al usuario: el detail o title del problem+json, o uno genérico. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Ocurrió un error inesperado. Intenta de nuevo.'
}
