import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // frontend/CLAUDE.md: TypeScript estricto, prohibido any.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Los tests y el proveedor de auth exportan helpers junto a componentes: no afecta al HMR real.
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/core/auth/AuthContext.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  prettier,
])
