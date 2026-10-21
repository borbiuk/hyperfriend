import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';

import { test as base, BrowserContext, chromium, Page } from '@playwright/test';
import { CONFIG_STORAGE_KEY } from '@shared/constants';
import { ConfigModel } from '@shared/models';
import { cloneDefaultConfig, toStoredConfig } from '@shared/services';

import { GitHubRouteOptions, routeGitHub } from './github';

/** The Chrome build the tests load; the `dist` setup project rebuilds it before e2e and live */
export const DIST_PATH = path.join(
	realpathSync(path.join(__dirname, '..', '..', '..')),
	'dist'
);

/**
 * Id Chromium gives an unpacked extension on macOS and Linux: SHA-256 of its absolute path,
 * the first 32 hex digits mapped 0-f → a-p. Hyperfriend has no service worker, so the id
 * can't be read from `context.serviceWorkers()`.
 *
 * @param extensionPath - Absolute, symlink-free path of the unpacked extension.
 */
export function unpackedExtensionId(extensionPath: string): string {
	const hex = createHash('sha256')
		.update(extensionPath)
		.digest('hex')
		.slice(0, 32);
	return [...hex]
		.map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
		.join('');
}

export interface ClipboardContent {
	html: string;
	text: string;
}

export interface ExtensionStorage {
	/** Stores `overrides` merged over the default config, in the shape the extension itself writes */
	seedConfig(overrides: Partial<ConfigModel>): Promise<void>;
	/** Stores `value` as is; only for upgrade tests with data written by older versions */
	setRawConfig(value: unknown): Promise<void>;
	/** The stored config, or `undefined` when nothing is stored */
	getConfig(): Promise<unknown>;
}

export interface ExtensionOptions {
	/**
	 * Snapshot routing for github.com (`e2e`), or `live` for the real site (the `live` project).
	 * Override per file with `test.use({ githubRoutes: … })`.
	 */
	githubRoutes: GitHubRouteOptions | 'live';
}

interface ExtensionFixtures {
	extensionId: string;
	/** Opens the settings page (`options.html`, optionally with a `#tab` hash) in a new tab */
	openOptions: (hash?: string) => Promise<Page>;
	storage: ExtensionStorage;
	/** Reads both clipboard formats in the page */
	readClipboard: (page: Page) => Promise<ClipboardContent>;
	/** Puts a plain-text sentinel into the clipboard, so a later read proves whether anything was copied */
	writeClipboardSentinel: (page: Page, text: string) => Promise<void>;
}

/**
 * Test with a fresh Chromium profile per test that has the built extension loaded, github.com
 * served from snapshots (or live, in the `live` project), and clipboard access granted for
 * github.com. A test fails when the extension logs an error or the page requests a URL that
 * no snapshot covers.
 */
export const test = base.extend<ExtensionFixtures & ExtensionOptions>({
	githubRoutes: [{ avatars: 'ok' }, { option: true }],

	extensionId: async ({}, use) => {
		await use(unpackedExtensionId(DIST_PATH));
	},

	context: async ({ githubRoutes, extensionId, headless }, use) => {
		const context: BrowserContext = await chromium.launchPersistentContext(
			'',
			{
				channel: 'chromium',
				headless,
				args: [
					`--disable-extensions-except=${DIST_PATH}`,
					`--load-extension=${DIST_PATH}`,
				],
			}
		);

		const extensionOrigin = `chrome-extension://${extensionId}/`;
		const extensionErrors: string[] = [];
		context.on('console', (message) => {
			const source =
				message.location().url || message.page()?.url() || '';
			if (
				message.type() === 'error' &&
				source.startsWith(extensionOrigin)
			) {
				extensionErrors.push(`${message.text()} (${source})`);
			}
		});
		context.on('weberror', (webError) => {
			if (webError.error().stack?.includes(extensionOrigin)) {
				extensionErrors.push(webError.error().message);
			}
		});

		const probe = await context.newPage();
		const manifest = await probe
			.goto(`${extensionOrigin}manifest.json`)
			.catch(() => null);
		if (!manifest?.ok()) {
			throw new Error(
				`The extension did not load from ${DIST_PATH} (id ${extensionId}); run npm run build`
			);
		}
		await probe.close();

		await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
			origin: 'https://github.com',
		});
		const unplanned =
			githubRoutes === 'live'
				? []
				: await routeGitHub(context, githubRoutes);

		await use(context);
		await context.close();

		if (extensionErrors.length > 0) {
			throw new Error(
				`The extension logged errors:\n${extensionErrors.join('\n')}`
			);
		}
		if (unplanned.length > 0) {
			throw new Error(
				`Requests without a snapshot or routing rule:\n${unplanned.join('\n')}`
			);
		}
	},

	page: async ({ context }, use) => {
		await use(context.pages()[0] ?? (await context.newPage()));
	},

	openOptions: async ({ context, extensionId }, use) => {
		await use(async (hash = '') => {
			const page = await context.newPage();
			await page.goto(
				`chrome-extension://${extensionId}/options.html${hash}`
			);
			return page;
		});
	},

	storage: async ({ openOptions }, use) => {
		// One extension page gives access to chrome.storage; it is opened on first use
		let extensionPage: Page | undefined;
		const getPage = async (): Promise<Page> => {
			extensionPage ??= await openOptions();
			return extensionPage;
		};
		const setRawConfig = async (value: unknown): Promise<void> => {
			const page = await getPage();
			await page.evaluate(
				([key, config]) => chrome.storage.sync.set({ [key]: config }),
				[CONFIG_STORAGE_KEY, value] as const
			);
		};

		await use({
			async seedConfig(overrides) {
				await setRawConfig(
					toStoredConfig({ ...cloneDefaultConfig(), ...overrides })
				);
			},
			setRawConfig,
			async getConfig() {
				const page = await getPage();
				return page.evaluate(
					async (key) => (await chrome.storage.sync.get(key))[key],
					CONFIG_STORAGE_KEY
				);
			},
		});
		await extensionPage?.close();
	},

	readClipboard: async ({}, use) => {
		await use((page) =>
			page.evaluate(async () => {
				const [item] = await navigator.clipboard.read();
				const read = async (type: string): Promise<string> =>
					item.types.includes(type)
						? (await item.getType(type)).text()
						: '';
				return {
					html: await read('text/html'),
					text: await read('text/plain'),
				};
			})
		);
	},

	writeClipboardSentinel: async ({}, use) => {
		await use((page, text) =>
			page.evaluate((value) => navigator.clipboard.writeText(value), text)
		);
	},
});

export { expect } from '@playwright/test';
