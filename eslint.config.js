import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', '.claude'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  // The Sandbox is a standalone module (src/sandbox): it may use the shared ledger pieces (@contracts,
  // @engine, src/components, src/lib) but nothing from the course — the app, its content or its search.
  {
    files: ['src/sandbox/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@content', message: 'The Sandbox is course-free: take content as props.' },
          ],
          patterns: [
            {
              group: ['**/app', '**/app/**', '**/content/**', '**/search', '**/search/**'],
              message:
                'The Sandbox is course-free: the host passes state, links, templates and examples.',
            },
          ],
        },
      ],
    },
  },
  // Everyone else uses the Sandbox through its public API (src/sandbox/index.ts), never its internals.
  {
    files: ['src/**/*.{ts,tsx}', 'content/**/*.ts'],
    ignores: ['src/sandbox/**', '**/*.test.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/sandbox/*', '!**/sandbox/index'],
              message: "Import the Sandbox from its public API ('…/sandbox'), not its internals.",
            },
          ],
        },
      ],
    },
  },
);
