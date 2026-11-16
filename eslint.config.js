import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const banned = (names) =>
  names.map((name) => ({ name, message: `${name} is banned in src/sim (sim purity).` }));

// Import boundaries from docs/tech/01-architecture.md ("Import rules").
const boundary = (forbiddenDirs, message) => ({
  patterns: [{ group: forbiddenDirs.flatMap((d) => [`**/${d}`, `**/${d}/**`]), message }],
});

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'baked', '.wrangler', 'test-results', 'playwright-report', 'e2e-screenshots'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      'no-restricted-properties': [
        'error',
        ...['innerHTML', 'outerHTML', 'insertAdjacentHTML'].map((property) => ({
          property,
          message: `${property} is banned (CSP and injection safety). Use textContent.`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name=/^(setTimeout|setInterval)$/][arguments.0.type='Literal']",
          message: 'String arguments to timers are banned.',
        },
        {
          selector:
            "CallExpression[callee.name=/^(setTimeout|setInterval)$/][arguments.0.type='TemplateLiteral']",
          message: 'String arguments to timers are banned.',
        },
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'innerHTML and outerHTML are banned.',
        },
      ],
    },
  },
  {
    files: ['src/sim/**/*.ts', 'tests/sim/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...banned([
          'Date',
          'performance',
          'window',
          'document',
          'fetch',
          'indexedDB',
          'localStorage',
        ]),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is banned in src/sim. Use the seeded RNG.',
        },
        { object: 'Date', property: 'now', message: 'Date is banned in src/sim.' },
        { object: 'performance', property: 'now', message: 'performance is banned in src/sim.' },
        { property: 'innerHTML', message: 'innerHTML is banned.' },
        { property: 'outerHTML', message: 'outerHTML is banned.' },
        { property: 'insertAdjacentHTML', message: 'insertAdjacentHTML is banned.' },
      ],
      'no-restricted-imports': [
        'error',
        boundary(
          ['render', 'ui', 'platform', 'save', 'dev', 'worker'],
          'sim imports only from sim, content and shared.',
        ),
      ],
    },
  },
  {
    files: ['src/render/**/*.ts', 'src/ui/**/*.ts', 'src/platform/**/*.ts', 'src/save/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary(['worker'], 'Client code must not import from worker/.'),
      ],
    },
  },
  {
    files: ['worker/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary(
          ['sim', 'render', 'ui', 'platform', 'save', 'dev', 'content'],
          'worker imports only from worker and src/shared.',
        ),
      ],
    },
  },
);
