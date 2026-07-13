module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:svelte/recommended',
    'turbo',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['*.cjs'],
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.svelte'],
      },
      rules: {
        // The production Svelte/Vite build is the authoritative compiler gate.
        'svelte/valid-compile': 'off',
        // TypeScript/Svelte owns type-scope resolution, including script generics.
        'no-undef': 'off',
        // Svelte snippets and reactive expressions can look unused to legacy ESLint.
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        // Legacy game components contain targeted suppressions for API-specific types.
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
    {
      files: ['*.stories.svelte'],
      rules: {
        // Story fixtures intentionally accept heterogeneous event payloads.
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
};
