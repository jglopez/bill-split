import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // typescript-eslint flags unused vars; let tsc handle that instead so we
      // don't duplicate the noUnusedLocals / noUnusedParameters tsc checks.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Test scripts run in Node and use console intentionally.
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: { 'no-console': 'off' },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
)
