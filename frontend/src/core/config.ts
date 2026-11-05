/** Única URL de backend: el gateway (frontend/CLAUDE.md). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
)
