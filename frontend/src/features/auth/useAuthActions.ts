import { useMutation } from '@tanstack/react-query'
import { ApiError, errorMessage } from '../../core/api/problem'
import { useAuth } from '../../core/auth/AuthContext'
import { authApi } from '../../core/auth/authApi'
import type { LoginRequest, RegisterUserRequest } from '../../core/models/identity'

/**
 * Facade de la feature auth: los containers no conocen authApi ni React Query, solo estas acciones
 * con su estado (submitting, error).
 */
export function useLogin() {
  const { login } = useAuth()
  const mutation = useMutation({ mutationFn: (credentials: LoginRequest) => login(credentials) })
  return {
    login: mutation.mutateAsync,
    submitting: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
  }
}

/** Registra la cuenta y, si sale bien, inicia sesión con los mismos datos. */
export function useRegister() {
  const { login } = useAuth()
  const mutation = useMutation({
    mutationFn: async (request: RegisterUserRequest) => {
      await authApi.register(request)
      await login({ email: request.email, password: request.password })
    },
  })
  return {
    register: mutation.mutateAsync,
    submitting: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : undefined,
    fieldErrors: mutation.error instanceof ApiError ? mutation.error.fieldErrors : {},
  }
}
