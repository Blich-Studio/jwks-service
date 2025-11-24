import { base } from '@blich-studio/eslint-config'

export default base({
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json', './tsconfig.vitest.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
  },
})
