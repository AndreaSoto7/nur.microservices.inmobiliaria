import { apiRequest } from '../api/httpClient'
import type {
  CurrentUser,
  LoginRequest,
  RegisterUserRequest,
  RegisterUserResponse,
  TokenPair,
} from '../models/identity'

// Operaciones de contracts/openapi/identity-service.yaml, siempre vía gateway.
export const authApi = {
  register: (request: RegisterUserRequest) =>
    apiRequest<RegisterUserResponse>('/api/v1/auth/register', { method: 'POST', body: request }),

  login: (request: LoginRequest) =>
    apiRequest<TokenPair>('/api/v1/auth/login', { method: 'POST', body: request }),

  refresh: (refreshToken: string) =>
    apiRequest<TokenPair>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } }),

  logout: (refreshToken: string) =>
    apiRequest<void>('/api/v1/auth/logout', { method: 'POST', body: { refreshToken } }),

  getCurrentUser: () => apiRequest<CurrentUser>('/api/v1/users/me', { auth: true }),
}
