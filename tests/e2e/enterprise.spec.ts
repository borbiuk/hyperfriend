import { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures/extension';
import {
	firstPlainItem,
	PAGES,
	REPOSITORY,
	rowOf,
	snapshotItems,
	snapshotUrl,
} from './fixtures/github';

// GitHub Enterprise: the extension runs on a domain the user granted (a fake domain here, whose
// access the test build's manifest already grants, served from the same snapshots as github.com),
// and the "GitHub Enterprise" section of the General tab asks for the access.

const HOST = 'ghe.example.test';
const SCRIPT_ID = `hyperfriend-enterprise:${HOST}`;
const PULL_REQUESTS = snapshotItems(PAGES.pullList);
const FIRST = firstPlainItem(PAGES.pullList);

test.use({ enterpriseHosts: [HOST] });

/** The URL of a snapshot page on the fake Enterprise domain */
function enterpriseUrl(pagePath: string): string {
	return snapshotUrl(pagePath).replace(
		'https://github.com',
		`https://${HOST}`
	);
}

/** The GitHub Enterprise section of the General tab */
function enterpriseSection(options: Page): Locator {
	return options.locator('details').filter({
		has: options.getByText('GitHub Enterprise', { exact: true }),
	});
}

/**
 * Waits until the background script has registered the content script of the granted domain.
 *
 * @param options - An extension page.
 */
async function waitForRegistration(options: Page): Promise<void> {
	await expect
		.poll(() =>
			options.evaluate(async () =>
				(await chrome.scripting.getRegisteredContentScripts()).map(
					(script) => script.id
				)
			)
		)
		.toEqual([SCRIPT_ID]);
}

/**
 * Replaces `chrome.permissions.request` or `remove` on the settings page, so no browser prompt is
 * needed (a prompt can not be answered in a test).
 *
 * @param options - The settings page.
 * @param method - The call to replace.
 * @param result - What the call does: resolves with a value, or rejects.
 * @returns Reads the calls the page made, as `{ request, userActive }`.
 */
async function stubPermissions(
	options: Page,
	method: 'request' | 'remove',
	result: boolean | 'rejects'
): Promise<() => Promise<{ request: unknown; userActive: boolean }[]>> {
	await options.evaluate(
		([name, outcome]) => {
			const calls: { request: unknown; userActive: boolean }[] = [];
			Object.defineProperty(window, '__permissionCalls', {
				value: calls,
			});
			(chrome.permissions as unknown as Record<string, unknown>)[name] =
				async (request: unknown) => {
					calls.push({
						request,
						userActive: navigator.userActivation.isActive,
					});
					if (outcome === 'rejects') {
						throw new Error('The prompt failed');
					}

					return outcome;
				};
		},
		[method, result] as const
	);
	return () =>
		options.evaluate(
			() =>
				(
					window as unknown as {
						__permissionCalls: {
							request: unknown;
							userActive: boolean;
						}[];
					}
				).__permissionCalls
		);
}

test('should register the content script of a granted domain after the extension is installed', async ({
	openOptions,
}) => {
	const options = await openOptions();

	await waitForRegistration(options);
	expect(
		await options.evaluate(async () =>
			(await chrome.scripting.getRegisteredContentScripts()).map(
				({ matches, js, runAt, persistAcrossSessions }) => ({
					matches,
					js,
					runAt,
					persistAcrossSessions,
				})
			)
		)
	).toEqual([
		{
			matches: [`https://${HOST}/*`],
			js: ['content.js'],
			runAt: 'document_idle',
			persistAcrossSessions: true,
		},
	]);
});

test('should add the copy buttons to the pull request list of a granted domain and link to that domain', async ({
	page,
	openOptions,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await waitForRegistration(await openOptions());
	const url = `https://${HOST}${REPOSITORY}/pull/${FIRST.number}`;

	await page.goto(enterpriseUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: enterprise copy');

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);
	await rowOf(page, FIRST.title)
		.getByRole('button', {
			name: `Copy link to pull request #${FIRST.number}`,
			exact: true,
		})
		.click();
	// The link points to the Enterprise site, not to github.com
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${url}">PR ${FIRST.number}</a>: ${FIRST.title}`
			),
			text: `PR ${FIRST.number}: ${FIRST.title} — ${url}`,
		});
});

test('should not start twice in a tab that already runs the content script', async ({
	page,
	openOptions,
}) => {
	const options = await openOptions();
	await waitForRegistration(options);
	await page.goto(enterpriseUrl(PAGES.pullList));
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);

	// What the background script does for a tab that was open when the script was registered
	await options.evaluate(async (host) => {
		const [tab] = await chrome.tabs.query({ url: `https://${host}/*` });
		for (let run = 0; run < 2; run++) {
			await chrome.scripting.executeScript({
				target: { tabId: tab.id as number },
				files: ['content.js'],
			});
		}
	}, HOST);

	// Two copies would replace each other's buttons without end: the page must stay quiet
	const mutations = await page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				let count = 0;
				const observer = new MutationObserver((records) => {
					count += records.length;
				});
				observer.observe(document.documentElement, {
					childList: true,
					subtree: true,
				});
				setTimeout(() => {
					observer.disconnect();
					resolve(count);
				}, 1200);
			})
	);
	expect(mutations).toBe(0);
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);
});

test('should add author avatars on github.com but not on a granted domain', async ({
	page,
	openOptions,
}) => {
	await waitForRegistration(await openOptions());

	await page.goto(enterpriseUrl(PAGES.pullList));
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);
	await expect(page.locator('img[data-hyperfriend="avatar"]')).toHaveCount(0);

	await test.step('control: github.com shows the avatars of the same snapshot', async () => {
		await page.goto(snapshotUrl(PAGES.pullList));
		await expect(
			page.locator('img[data-hyperfriend="avatar"]')
		).toHaveCount(PULL_REQUESTS.length);
	});
});

test.describe('General tab', () => {
	test('should list exactly the granted Enterprise domain, not github.com', async ({
		openOptions,
	}) => {
		const options = await openOptions('#general');
		const list = enterpriseSection(options).getByRole('list', {
			name: 'Added domains',
		});

		await expect(list.getByRole('listitem')).toHaveCount(1);
		await expect(list.getByRole('listitem')).toHaveText(
			new RegExp(`^${HOST}`)
		);
		await expect(
			enterpriseSection(options).getByRole('button', {
				name: `Remove ${HOST}`,
				exact: true,
			})
		).toBeVisible();
	});

	for (const { input, error } of [
		{
			input: 'http://ghe.other.test',
			error: 'Only https sites are supported.',
		},
		{ input: HOST, error: 'This domain is already added.' },
	]) {
		test(`should refuse "${input}" without asking the browser`, async ({
			openOptions,
		}) => {
			const options = await openOptions('#general');
			const calls = await stubPermissions(options, 'request', true);
			const section = enterpriseSection(options);

			await section
				.getByRole('textbox', { name: 'GitHub Enterprise domain' })
				.fill(input);
			await section
				.getByRole('button', { name: 'Add', exact: true })
				.click();

			await expect(section.getByRole('alert')).toHaveText(error);
			await expect(
				section.getByRole('textbox', {
					name: 'GitHub Enterprise domain',
				})
			).toHaveAttribute('aria-invalid', 'true');
			expect(await calls()).toEqual([]);
		});
	}

	test("should ask the browser for the access to the new domain's origin from the click", async ({
		openOptions,
	}) => {
		const options = await openOptions('#general');
		const calls = await stubPermissions(options, 'request', true);
		const section = enterpriseSection(options);
		const field = section.getByRole('textbox', {
			name: 'GitHub Enterprise domain',
		});

		await field.fill('https://GHE.Other.test/org/repo');
		await section.getByRole('button', { name: 'Add', exact: true }).click();

		await expect(section.getByRole('status')).toHaveText(
			'Added ghe.other.test.'
		);
		await expect(field).toHaveValue('');
		// The browser's prompt needs the user gesture of the click
		expect(await calls()).toEqual([
			{
				request: { origins: ['https://ghe.other.test/*'] },
				userActive: true,
			},
		]);
	});

	test('should say so when the browser does not give the access', async ({
		openOptions,
	}) => {
		const options = await openOptions('#general');
		await stubPermissions(options, 'request', false);
		const section = enterpriseSection(options);

		await section
			.getByRole('textbox', { name: 'GitHub Enterprise domain' })
			.fill('ghe.other.test');
		await section.getByRole('button', { name: 'Add', exact: true }).click();

		await expect(section.getByRole('alert')).toHaveText(
			'The browser did not give the access.'
		);
	});

	test('should say so when asking the browser fails', async ({
		openOptions,
	}) => {
		const options = await openOptions('#general');
		await stubPermissions(options, 'request', 'rejects');
		const section = enterpriseSection(options);

		await section
			.getByRole('textbox', { name: 'GitHub Enterprise domain' })
			.fill('ghe.other.test');
		await section.getByRole('button', { name: 'Add', exact: true }).click();

		await expect(section.getByRole('alert')).toHaveText(
			'Could not ask the browser for the access.'
		);
	});

	test('should take the access of a domain back with Remove', async ({
		openOptions,
	}) => {
		const options = await openOptions('#general');
		const calls = await stubPermissions(options, 'remove', true);

		await enterpriseSection(options)
			.getByRole('button', { name: `Remove ${HOST}`, exact: true })
			.click();

		await expect
			.poll(async () => (await calls()).map(({ request }) => request))
			.toEqual([{ origins: [`https://${HOST}/*`] }]);
	});

	for (const result of [false, 'rejects'] as const) {
		test(`should say so when the access could not be removed (${result === false ? 'refused' : 'failed'})`, async ({
			openOptions,
		}) => {
			const options = await openOptions('#general');
			await stubPermissions(options, 'remove', result);
			const section = enterpriseSection(options);

			await section
				.getByRole('button', { name: `Remove ${HOST}`, exact: true })
				.click();

			await expect(section.getByRole('alert')).toHaveText(
				'Could not remove the access.'
			);
		});
	}
});

test.describe('without a granted domain', () => {
	test.use({ enterpriseHosts: [] });

	test('should keep the GitHub Enterprise section closed until it is opened', async ({
		openOptions,
	}) => {
		const options = await openOptions('#general');
		await expect(enterpriseSection(options)).toBeVisible();

		await expect(
			options.getByRole('textbox', { name: 'GitHub Enterprise domain' })
		).toBeHidden();

		await enterpriseSection(options)
			.getByText('GitHub Enterprise', { exact: true })
			.click();
		await expect(
			options.getByRole('textbox', { name: 'GitHub Enterprise domain' })
		).toBeVisible();
		await expect(
			enterpriseSection(options).getByRole('list', {
				name: 'Added domains',
			})
		).toHaveCount(0);
	});
});

test.describe('GitHub Enterprise Cloud (*.ghe.com) without any setup', () => {
	const CLOUD_HOST = 'mycompany.ghe.com';

	test.use({ enterpriseHosts: [], manifestHosts: [CLOUD_HOST] });

	test('should add the copy buttons and link to the site, from the manifest alone', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
	}) => {
		const url = `https://${CLOUD_HOST}${REPOSITORY}/pull/${FIRST.number}`;

		await page.goto(
			snapshotUrl(PAGES.pullList).replace(
				'https://github.com',
				`https://${CLOUD_HOST}`
			)
		);
		await writeClipboardSentinel(page, 'sentinel: ghe.com copy');

		await expect(
			page.locator('[data-hyperfriend="copy-button"]')
		).toHaveCount(PULL_REQUESTS.length);
		await rowOf(page, FIRST.title)
			.getByRole('button', {
				name: `Copy link to pull request #${FIRST.number}`,
				exact: true,
			})
			.click();
		await expect
			.poll(() => readClipboard(page))
			.toEqual({
				html: await normalizeHtml(
					page,
					`<a href="${url}">PR ${FIRST.number}</a>: ${FIRST.title}`
				),
				text: `PR ${FIRST.number}: ${FIRST.title} — ${url}`,
			});
	});

	test('should refuse to add a ghe.com domain, because it needs no setup', async ({
		openOptions,
	}) => {
		const options = await openOptions('#general');
		const calls = await stubPermissions(options, 'request', true);
		const section = enterpriseSection(options);

		await section.getByText('GitHub Enterprise', { exact: true }).click();
		await section
			.getByRole('textbox', { name: 'GitHub Enterprise domain' })
			.fill(CLOUD_HOST);
		await section.getByRole('button', { name: 'Add', exact: true }).click();

		await expect(section.getByRole('alert')).toHaveText(
			'ghe.com sites are supported without any setup.'
		);
		expect(await calls()).toEqual([]);
	});
});
