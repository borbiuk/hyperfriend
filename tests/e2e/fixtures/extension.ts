import { createHash } from 'node:crypto';
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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
 * the first 32 hex digits mapped 0-f → a-p. The id is computed, so it does not depend on
 * when the extension's service worker starts.
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
	/** `text/html` as Chromium serializes it on read (wrapper removed, quotes in text not escaped) */
	html: string;
	text: string;
}

/** A keydown that reached `window` in the bubble phase */
export interface KeyRecord {
	code: string;
	defaultPrevented: boolean;
}

/** Settings to store: any part of the config; `templates` may name only some link types */
export type ConfigOverrides = Omit<Partial<ConfigModel>, 'templates'> & {
	templates?: Partial<ConfigModel['templates']>;
};

export interface ExtensionStorage {
	/** Stores `overrides` merged over the default config, in the shape the extension itself writes */
	seedConfig(overrides: ConfigOverrides): Promise<void>;
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
	/**
	 * Domains of fake GitHub Enterprise sites the extension may run on. The tests load a copy of
	 * the build whose manifest already grants access to them (the browser's permission prompt can
	 * not be answered in a test; a request for an access that is granted resolves without it), and
	 * the domains are served from the same snapshots as github.com.
	 */
	enterpriseHosts: string[];
}

interface ExtensionFixtures {
	/** Folder of the extension the context loads: the build, or a copy of it with granted hosts */
	extensionPath: string;
	extensionId: string;
	/** Opens the settings page (`options.html`, optionally with a `#tab` hash) in a new tab */
	openOptions: (hash?: string) => Promise<Page>;
	storage: ExtensionStorage;
	/** Reads both clipboard formats in the page */
	readClipboard: (page: Page) => Promise<ClipboardContent>;
	/** Puts a plain-text sentinel into the clipboard, so a later read proves whether anything was copied */
	writeClipboardSentinel: (page: Page, text: string) => Promise<void>;
	/**
	 * Re-serializes an HTML fragment the way Chromium returns clipboard HTML, so an expected payload
	 * written exactly as the extension builds it compares DOM-equal with `readClipboard` (quote
	 * escaping in text is lost on both sides; the byte-exact payload is a unit test of buildLinkPayload).
	 */
	normalizeHtml: (page: Page, html: string) => Promise<string>;
	/**
	 * Starts recording keydown events that reach `window` in the bubble phase; returns a reader.
	 * When the extension handles a shortcut it stops the event in the capture phase, so a recorded
	 * `KeyC` with `defaultPrevented: false` proves the extension saw the key and left it alone.
	 */
	recordKeys: (page: Page) => Promise<() => Promise<KeyRecord[]>>;
}

/**
 * Test with a fresh Chromium profile per test that has the built extension loaded, github.com
 * served from snapshots (or live, in the `live` project), and clipboard access granted for
 * github.com (and for the fake Enterprise domains of `enterpriseHosts`). A test fails when the extension logs an error or the page requests a URL that
 * no snapshot covers.
 */
export const test = base.extend<ExtensionFixtures & ExtensionOptions>({
	githubRoutes: [{ avatars: 'ok' }, { option: true }],
	enterpriseHosts: [[], { option: true }],

	extensionPath: async ({ enterpriseHosts }, use) => {
		if (enterpriseHosts.length === 0) {
			await use(DIST_PATH);
			return;
		}

		const copy = realpathSync(
			mkdtempSync(path.join(tmpdir(), 'hyperfriend-'))
		);
		cpSync(DIST_PATH, copy, { recursive: true });
		const manifestPath = path.join(copy, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		manifest.host_permissions = enterpriseHosts.map(
			(host) => `https://${host}/*`
		);
		writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'));
		await use(copy);
		rmSync(copy, { recursive: true, force: true });
	},

	extensionId: async ({ extensionPath }, use) => {
		await use(unpackedExtensionId(extensionPath));
	},

	context: async (
		{ githubRoutes, enterpriseHosts, extensionPath, extensionId, headless },
		use
	) => {
		const context: BrowserContext = await chromium.launchPersistentContext(
			'',
			{
				channel: 'chromium',
				headless,
				args: [
					`--disable-extensions-except=${extensionPath}`,
					`--load-extension=${extensionPath}`,
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
				`The extension did not load from ${extensionPath} (id ${extensionId}); run npm run build`
			);
		}
		await probe.close();

		for (const host of ['github.com', ...enterpriseHosts]) {
			await context.grantPermissions(
				['clipboard-read', 'clipboard-write'],
				{ origin: `https://${host}` }
			);
		}
		const unplanned =
			githubRoutes === 'live'
				? []
				: await routeGitHub(context, githubRoutes, enterpriseHosts);

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
				const defaults = cloneDefaultConfig();
				await setRawConfig(
					toStoredConfig({
						...defaults,
						...overrides,
						templates: {
							...defaults.templates,
							...overrides.templates,
						},
					})
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
				// A copy that lands between read() and getType() invalidates the item ("Clipboard data has changed"): read again
				for (let attempt = 1; ; attempt++) {
					try {
						const [item] = await navigator.clipboard.read();
						const read = async (type: string): Promise<string> =>
							item.types.includes(type)
								? (await item.getType(type)).text()
								: '';
						return {
							html: await read('text/html'),
							text: await read('text/plain'),
						};
					} catch (error) {
						if (
							attempt === 3 ||
							!(error instanceof DOMException) ||
							error.name !== 'InvalidStateError'
						) {
							throw error;
						}
					}
				}
			})
		);
	},

	writeClipboardSentinel: async ({}, use) => {
		await use((page, text) =>
			page.evaluate((value) => navigator.clipboard.writeText(value), text)
		);
	},

	normalizeHtml: async ({}, use) => {
		await use((page, html) =>
			page.evaluate((fragment) => {
				const template = document.createElement('template');
				template.innerHTML = fragment;
				return template.innerHTML;
			}, html)
		);
	},

	recordKeys: async ({}, use) => {
		await use(async (page) => {
			await page.evaluate(() => {
				const records: { code: string; defaultPrevented: boolean }[] =
					[];
				Object.defineProperty(window, '__hyperfriendKeys', {
					value: records,
					configurable: true,
				});
				window.addEventListener('keydown', (event) => {
					records.push({
						code: event.code,
						defaultPrevented: event.defaultPrevented,
					});
				});
			});
			return () =>
				page.evaluate(
					() =>
						(
							window as unknown as {
								__hyperfriendKeys: KeyRecord[];
							}
						).__hyperfriendKeys
				);
		});
	},
});

/**
 * Waits until the content script is running on the page and gives the page (not a field) the focus.
 * The shortcut listener starts right before the first scan, and every scan of a supported page
 * attaches the tooltip's live region, so the live region is the readiness signal even on pages
 * where no button is injected.
 *
 * @param page - GitHub page under test.
 */
export async function readyForShortcut(page: Page): Promise<void> {
	await page
		.locator('[data-hyperfriend="live-region"]')
		.waitFor({ state: 'attached' });
	await page.evaluate(() =>
		(document.activeElement as HTMLElement | null)?.blur()
	);
}

export { expect } from '@playwright/test';
