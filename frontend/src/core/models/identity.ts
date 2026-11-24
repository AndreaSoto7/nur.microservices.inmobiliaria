// Reflejo de contracts/openapi/identity-service.yaml. No agregues campos que no estén ahí.

export const ROLES = ['CLIENT', 'AGENT', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

/** Al registrarse solo se puede pedir CLIENT o AGENT. */
export type RegistrableRole = Exclude<Role, 'ADMIN'>

export interface RegisterUserRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: RegistrableRole
}

export interface RegisterUserResponse {
  id: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
}

export interface CurrentUser {
  id: string
  email: string
  firstName: string
  /** Vacío solo en cuentas creadas antes de separar nombre y apellido. */
  lastName: string
  /** Nombre y apellido juntos. */
  fullName: string
  roles: Role[]
  registeredAt: string
}

/** Lo que un administrador ve de una cuenta. */
export interface AdminUser extends CurrentUser {
  active: boolean
}
