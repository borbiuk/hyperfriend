import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';
import playwright from 'eslint-plugin-playwright';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/dist-firefox/**',
			'**/webpack/**',
			'**/test-results/**',
			'**/playwright-report/**',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	// Turns off stylistic rules that conflict with Prettier; must come before the rules below
	prettierConfig,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			globals: {
				...globals.browser,
				chrome: 'readonly',
			},
			ecmaVersion: 'latest',
			sourceType: 'module',
		},
		plugins: {
			react,
			'react-hooks': reactHooks,
			import: importPlugin,
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
		rules: {
			'linebreak-style': ['error', 'unix'],
			quotes: ['error', 'single', { avoidEscape: true }],
			semi: ['error', 'always'],
			curly: ['error', 'all'],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'react/prop-types': 'off',
			'react/react-in-jsx-scope': 'off',
			'react/jsx-uses-vars': 'error',
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
			'import/order': [
				'error',
				{
					groups: [
						'builtin',
						'external',
						'internal',
						'parent',
						'sibling',
						'index',
					],
					'newlines-between': 'always',
					alphabetize: { order: 'asc', caseInsensitive: true },
				},
			],
		},
	},
	// Tests: Node globals, type-aware check for missing awaits, Playwright rules (the review standard maps them to its rule IDs)
	{
		files: ['tests/**/*.ts', 'playwright.config.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['playwright.config.ts'],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-floating-promises': 'error',
			// Playwright fixtures call `use()`, which is not the React hook
			'react-hooks/rules-of-hooks': 'off',
		},
	},
	{
		files: ['tests/**/*.ts'],
		...playwright.configs['flat/recommended'],
		rules: {
			...playwright.configs['flat/recommended'].rules,
			// Rules the review standard rates Critical or Major fail the lint run
			'playwright/no-wait-for-timeout': 'error',
			'playwright/no-page-pause': 'error',
			'playwright/no-focused-test': 'error',
			'playwright/no-conditional-expect': 'error',
			'playwright/no-conditional-in-test': 'error',
			'playwright/no-element-handle': 'error',
			'playwright/no-eval': 'error',
			'playwright/no-force-option': 'error',
			'playwright/no-wait-for-selector': 'error',
			'playwright/no-wait-for-navigation': 'error',
			'playwright/no-networkidle': 'error',
			'playwright/no-skipped-test': ['error', { allowConditional: true }],
			'playwright/no-nth-methods': 'warn',
			'playwright/require-to-pass-timeout': 'warn',
			'playwright/no-commented-out-tests': 'warn',
			'playwright/prefer-to-have-count': 'error',
			'playwright/prefer-web-first-assertions': 'error',
		},
	},
	// Node scripts next to the tests (snapshot capture); their in-page callbacks use browser globals
	{
		files: ['tests/**/*.mjs'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser,
			},
		},
	},
];
