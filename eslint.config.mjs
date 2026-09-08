import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Lint config. The `lint` script has referenced one since 0.1.0; this is the
 * first time it exists.
 *
 * Type-aware rules are on, because the bugs worth catching in this package are
 * type-shaped: the widget registry that resolved to `never`, the exports map
 * pointing at files that were never emitted, a `"use client"` directive lost in
 * bundling. Rules that only argue about style are off.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'examples/**/.next/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // An explicit project rather than `projectService`, because tests and
        // build scripts live outside the package tsconfig's `include` (which is
        // scoped to `src` for declaration emit) and type-aware rules need every
        // linted file to belong to some project.
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Unused args are meaningful in this codebase: destructuring a key off an
      // object in order to drop it is how serializeConfig strips functions.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],

      // `any` appears where it belongs: the wire-format mappers, which exist
      // precisely because the shape of a backend response is unknown here.
      '@typescript-eslint/no-explicit-any': 'off',

      // Floating promises matter in effects and event handlers, where an
      // unhandled rejection is a silent failure.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],

      // Loosened deliberately: normalizing unknown backend payloads means
      // touching values the compiler cannot know the shape of.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',

      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': 'off',
    },
  },
  {
    // The CLI is a Node program: console output is its interface.
    files: ['src/cli/**/*.ts'],
    rules: { '@typescript-eslint/no-var-requires': 'off' },
  },
  {
    // Build scripts are plain Node ESM, not part of the TypeScript project.
    files: ['scripts/**/*.{mjs,cjs,js}', '*.{mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      // No `project` here: these files are outside the TypeScript program on
      // purpose, and type-aware rules are off for them anyway.
      parserOptions: { project: null, projectService: false },
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        module: 'writable',
        require: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // Test doubles are async because the interface they stand in for is, not
      // because they await anything.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
)
