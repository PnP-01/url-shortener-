import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist', 'node_modules', 'prisma/migrations'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // o Express exige 4 parâmetros no error handler, mesmo sem usar todos
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Front-end: JavaScript de navegador, então declaramos os globals que ele usa.
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
]);
