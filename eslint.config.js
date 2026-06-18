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
      // Advisory rule about calling setState inside effects. The useColumnOrder
      // hook intentionally uses this pattern to sync an ordered list of IDs
      // when participants are added/removed; turning it off project-wide.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Test scripts run in Node and use console intentionally.
    files: ['src/**/*.test.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
)
