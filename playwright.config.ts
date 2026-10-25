import { defineConfig } from '@playwright/test';

import { ExtensionOptions } from './tests/e2e/fixtures/extension';

/**
 * Playwright projects:
 * - unit: pure logic from src/shared and a guard for the manifests, no browser.
 * - e2e: the built extension (dist/) in Playwright's bundled Chromium, GitHub pages served from snapshots, no network.
 * - live: smoke checks against real github.com. Defined only when HYPERFRIEND_LIVE is set (npm run test:live),
 *   so a plain `playwright test` never reaches the network.
 * - dist: builds dist/ before e2e or live run (a setup project, so unit-only runs skip the build).
 */
export default defineConfig<ExtensionOptions>({
	forbidOnly: !!process.env.CI,
	fullyParallel: true,
	// Flaky tests are fixed, not retried
	retries: 0,
	// In CI a hanging run ends as a test failure before the job timeout cancels the job, so the report is still uploaded
	globalTimeout: process.env.CI ? 10 * 60_000 : undefined,
	// Fixed parallelism in CI, so run times do not depend on the runner's core count
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI
		? [['list'], ['html', { open: 'never' }], ['github']]
		: [['list'], ['html', { open: 'never' }]],
	use: {
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'unit',
			testDir: './tests/unit',
		},
		{
			name: 'dist',
			testDir: './tests/setup',
			testMatch: /dist\.setup\.ts/,
		},
		{
			name: 'e2e',
			testDir: './tests/e2e',
			dependencies: ['dist'],
		},
		...(process.env.HYPERFRIEND_LIVE
			? [
					{
						name: 'live',
						testDir: './tests/live',
						dependencies: ['dist'],
						use: { githubRoutes: 'live' as const },
					},
				]
			: []),
	],
});
