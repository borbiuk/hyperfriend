import { Locator, Page } from '@playwright/test';
import { FilterChipId } from '@shared/models';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	HYDRATED_RESCAN_TIMEOUT_MS,
	markHydrated,
	PAGES,
	serveUnhydrated,
	snapshotUrl,
} from './fixtures/github';

// Quick filter bar on the pull request list (react/react/pulls snapshot): the chips under the
// search box, the search text they put into the address, the remembered state of the sticky chips
// and the chips chosen in the settings. The snapshot's search box shows `is:pr state:open`.

const LIST_URL = snapshotUrl(PAGES.pullList);

/** The chips shown with the default settings, in order */
const DEFAULT_CHIPS = [
	'Needs your review',
	'Needs review from your GitHub team',
	'Created by you',
	'Ready to merge',
	'Drafts: all',
	'CI passing',
	'CI failing',
	'CI running',
	'Mine, waiting for review',
	'Mine, changes requested',
];

/** The default chips as stored, with the sticky drafts setting on */
const STICKY_FILTERS = {
	chips: [
		FilterChipId.NeedsYourReview,
		FilterChipId.NeedsTeamReview,
		FilterChipId.CreatedByYou,
		FilterChipId.ReadyToMerge,
		FilterChipId.Drafts,
		FilterChipId.CiPassing,
		FilterChipId.CiFailing,
		FilterChipId.CiRunning,
		FilterChipId.MyWaiting,
		FilterChipId.MyChanges,
	],
	sticky: { drafts: true },
};

/**
 * Emulates GitHub's router: the snapshots hold no scripts, so nothing follows a change of the
 * address. Like the real list, the search box then shows the new `q` after a `popstate`.
 *
 * @param page - GitHub page; call before `goto`.
 */
async function emulateRouter(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.addEventListener('popstate', () => {
			const input = document.querySelector<HTMLInputElement>(
				'[role="search"] input'
			);
			if (input) {
				input.value =
					new URLSearchParams(location.search).get('q') ?? '';
			}
		});
	});
}

test.beforeEach(async ({ page }) => {
	await emulateRouter(page);
});

/**
 * The address of the list with a search text.
 *
 * @param query - Text of the `q` parameter, as GitHub writes it (`+` for spaces).
 */
function listUrl(query: string): string {
	return `${LIST_URL}?q=${query}`;
}

/**
 * The filter bar.
 *
 * @param page - GitHub page.
 */
function filterBar(page: Page): Locator {
	return page.locator('[data-hyperfriend="filter-bar"]');
}

/**
 * One chip of the bar.
 *
 * @param page - GitHub page.
 * @param name - Text of the chip.
 */
function chip(page: Page, name: string): Locator {
	return filterBar(page).getByRole('button', { name, exact: true });
}

test('should show the default chips right after the search box of the list', async ({
	page,
}) => {
	await page.goto(LIST_URL);

	await expect(filterBar(page)).toHaveCount(1);
	await expect(
		page.locator(
			'[role="search"][aria-label="Pull requests"] + [data-hyperfriend="filter-bar"]'
		)
	).toHaveCount(1);
	await expect(
		page.getByRole('group', { name: 'Quick filters', exact: true })
	).toBeVisible();
	await expect(filterBar(page).getByRole('button')).toHaveText(DEFAULT_CHIPS);
	await expect(filterBar(page).locator('[data-active]')).toHaveCount(0);
});

test('should open the list with user-review-requested:@me when Needs your review is clicked and go back when it is clicked again', async ({
	page,
}) => {
	await page.goto(LIST_URL);

	await chip(page, 'Needs your review').click();

	await test.step('the address and the chip show the filter', async () => {
		await expect(page).toHaveURL(
			listUrl('is%3Apr+state%3Aopen+user-review-requested%3A%40me')
		);
		await expect(chip(page, 'Needs your review')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	await chip(page, 'Needs your review').click();

	await test.step('the second click removes the filter', async () => {
		await expect(page).toHaveURL(listUrl('is%3Apr+state%3Aopen'));
		await expect(chip(page, 'Needs your review')).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});
});

test('should update the list without loading the page again', async ({
	page,
}) => {
	await page.goto(LIST_URL);
	await expect(filterBar(page)).toHaveCount(1);
	await page.evaluate(() => {
		Reflect.set(window, 'hyperfriendSamePage', true);
	});
	const bar = await filterBar(page).elementHandle();

	await chip(page, 'CI passing').click();

	await expect(page).toHaveURL(
		listUrl('is%3Apr+state%3Aopen+status%3Asuccess')
	);
	await expect(chip(page, 'CI passing')).toHaveAttribute('data-active', '');
	// The document, and the bar in it, are the same: no page load and no flicker of the bar
	expect(
		await page.evaluate(() => Reflect.get(window, 'hyperfriendSamePage'))
	).toBe(true);
	expect(await bar?.evaluate((node) => node.isConnected)).toBe(true);
});

test('should go from all drafts to no drafts, only drafts and back with the Drafts chip', async ({
	page,
}) => {
	await page.goto(LIST_URL);

	await chip(page, 'Drafts: all').click();
	await expect(page).toHaveURL(listUrl('is%3Apr+state%3Aopen+-is%3Adraft'));
	await expect(chip(page, 'Drafts: hidden')).toHaveAttribute(
		'data-active',
		''
	);

	await chip(page, 'Drafts: hidden').click();
	await expect(page).toHaveURL(listUrl('is%3Apr+state%3Aopen+is%3Adraft'));
	await expect(chip(page, 'Drafts: only')).toHaveAttribute('data-active', '');

	await chip(page, 'Drafts: only').click();
	await expect(page).toHaveURL(listUrl('is%3Apr+state%3Aopen'));
	await expect(chip(page, 'Drafts: all')).not.toHaveAttribute('data-active');
	// A chip with three states tells its state in its text, so it is not an on/off button
	await expect(chip(page, 'Drafts: all')).not.toHaveAttribute('aria-pressed');
});

test('should mark the chips that match the search text of the address', async ({
	page,
}) => {
	await page.goto(
		listUrl('is%3Apr+state%3Aopen+status%3Afailure+-is%3Adraft')
	);

	await expect(chip(page, 'CI failing')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(chip(page, 'Drafts: hidden')).toHaveAttribute(
		'data-active',
		''
	);
	await expect(chip(page, 'CI passing')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(filterBar(page).locator('[data-active]')).toHaveCount(2);
});

test('should replace author:@me when Needs your review is clicked', async ({
	page,
}) => {
	await page.goto(listUrl('is%3Aopen+is%3Apr+author%3A%40me'));

	await chip(page, 'Needs your review').click();

	await expect(page).toHaveURL(
		listUrl('is%3Aopen+is%3Apr+user-review-requested%3A%40me')
	);
});

test('should replace one CI state with another', async ({ page }) => {
	await page.goto(listUrl('is%3Apr+status%3Asuccess'));

	await chip(page, 'CI failing').click();

	await expect(page).toHaveURL(listUrl('is%3Apr+status%3Afailure'));
});

test('should set the three tokens of Ready to merge', async ({ page }) => {
	await page.goto(LIST_URL);

	await chip(page, 'Ready to merge').click();

	await expect(page).toHaveURL(
		listUrl(
			'is%3Apr+state%3Aopen+author%3A%40me+review%3Aapproved+status%3Asuccess'
		)
	);
	await expect(chip(page, 'Ready to merge')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('should drop the page number when a chip changes the list', async ({
	page,
}) => {
	await page.goto(`${listUrl('is%3Apr')}&page=3`);

	await chip(page, 'CI passing').click();

	await expect(page).toHaveURL(listUrl('is%3Apr+status%3Asuccess'));
});

test('should ask for a team review without a personal request with Needs review from your GitHub team', async ({
	page,
}) => {
	await page.goto(LIST_URL);

	await chip(page, 'Needs review from your GitHub team').click();

	await expect(page).toHaveURL(
		listUrl(
			'is%3Apr+state%3Aopen+review-requested%3A%40me+-user-review-requested%3A%40me'
		)
	);
	await expect(
		chip(page, 'Needs review from your GitHub team')
	).toHaveAttribute('aria-pressed', 'true');
});

test('should switch from a personal to a team review request', async ({
	page,
}) => {
	await page.goto(listUrl('is%3Apr+user-review-requested%3A%40me'));

	await chip(page, 'Needs review from your GitHub team').click();

	await expect(page).toHaveURL(
		listUrl(
			'is%3Apr+review-requested%3A%40me+-user-review-requested%3A%40me'
		)
	);
	await expect(chip(page, 'Needs your review')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
});

test('should replace a review request with author:@me for Created by you', async ({
	page,
}) => {
	await page.goto(listUrl('is%3Apr+user-review-requested%3A%40me'));

	await chip(page, 'Created by you').click();

	await expect(page).toHaveURL(listUrl('is%3Apr+author%3A%40me'));
	await expect(chip(page, 'Created by you')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('should show an icon before the text of every chip, coloured only for the checks', async ({
	page,
}) => {
	await page.goto(LIST_URL);
	await expect(filterBar(page).getByRole('button')).toHaveCount(
		DEFAULT_CHIPS.length
	);

	for (const name of DEFAULT_CHIPS) {
		await expect(
			chip(page, name).locator('svg[aria-hidden="true"]')
		).toHaveCount(1);
	}
	// A status colour on the check icons only
	const colour = (name: string): Promise<string> =>
		chip(page, name)
			.locator('svg')
			.evaluate((icon) => getComputedStyle(icon).color);
	const text = await chip(page, 'Created by you').evaluate(
		(button) => getComputedStyle(button).color
	);
	expect(await colour('Created by you')).toBe(text);
	expect(await colour('CI passing')).not.toBe(text);
	expect(await colour('CI failing')).not.toBe(await colour('CI passing'));
});

test('should show only the chips chosen in the settings', async ({
	page,
	storage,
}) => {
	await storage.seedConfig({
		filters: {
			chips: [FilterChipId.NoReviewer, FilterChipId.CiPassing],
			sticky: { drafts: false },
		},
	});
	await page.goto(LIST_URL);

	await expect(filterBar(page).getByRole('button')).toHaveText([
		'No reviewer',
		'CI passing',
	]);
});

test('should show no bar when no chip is chosen', async ({ page, storage }) => {
	await storage.seedConfig({
		filters: {
			chips: [],
			sticky: { drafts: false },
		},
	});
	await page.goto(LIST_URL);
	await readyForShortcut(page);

	await expect(filterBar(page)).toHaveCount(0);
});

test('should follow a change of the settings while the list is open', async ({
	page,
	storage,
}) => {
	await page.goto(LIST_URL);
	await expect(filterBar(page).getByRole('button')).toHaveCount(
		DEFAULT_CHIPS.length
	);

	await storage.seedConfig({
		filters: {
			chips: [FilterChipId.CiPassing],
			sticky: { drafts: false },
		},
	});

	await expect(filterBar(page).getByRole('button')).toHaveText([
		'CI passing',
	]);
});

test('should show the default chips for settings stored before filters existed', async ({
	page,
	storage,
}) => {
	await storage.setRawConfig({
		templates: { 'pull-request': '[PR {{pr_number}}]: {{pr_name}}' },
		templateFormat: 2,
	});
	await page.goto(LIST_URL);

	await expect(filterBar(page).getByRole('button')).toHaveText(DEFAULT_CHIPS);
});

for (const [title, path] of [
	['an issue list', PAGES.issueList],
	['a pull request page', PAGES.pull],
	['a search page', PAGES.searchPulls],
] as const) {
	test(`should show no bar on ${title}`, async ({ page }) => {
		await page.goto(snapshotUrl(path));
		await readyForShortcut(page);

		await expect(filterBar(page)).toHaveCount(0);
	});
}

test('should wait for the search box to be hydrated before adding the bar', async ({
	page,
}) => {
	await serveUnhydrated(page, PAGES.pullList);

	await page.goto(LIST_URL);
	await readyForShortcut(page);
	await expect(filterBar(page)).toHaveCount(0);

	await markHydrated(page);

	await expect(filterBar(page)).toHaveCount(1, {
		timeout: HYDRATED_RESCAN_TIMEOUT_MS,
	});
});

test.describe('on a GitHub Enterprise Cloud site', () => {
	test.use({ manifestHosts: ['mycompany.ghe.com'] });

	test('should show the bar and open filtered lists on the same host', async ({
		page,
	}) => {
		const url = LIST_URL.replace('github.com', 'mycompany.ghe.com');
		await page.goto(url);

		await chip(page, 'CI passing').click();

		await expect(page).toHaveURL(
			`${url}?q=is%3Apr+state%3Aopen+status%3Asuccess`
		);
	});
});

test.describe('on a GitHub Enterprise Server site', () => {
	test.use({ enterpriseHosts: ['ghe.example.test'] });

	test('should show the bar and open filtered lists on the granted host', async ({
		page,
	}) => {
		const url = LIST_URL.replace('github.com', 'ghe.example.test');
		await page.goto(url);

		await chip(page, 'CI failing').click();

		await expect(page).toHaveURL(
			`${url}?q=is%3Apr+state%3Aopen+status%3Afailure`
		);
	});
});

test.describe('sticky chips', () => {
	test('should add the remembered draft filter to a list opened without a search text', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({ filters: STICKY_FILTERS });

		await page.goto(LIST_URL);

		await expect(page).toHaveURL(
			listUrl('is%3Apr+state%3Aopen+-is%3Adraft')
		);
		await expect(chip(page, 'Drafts: hidden')).toHaveAttribute(
			'data-active',
			''
		);
	});

	test('should leave the list alone when the sticky settings are off', async ({
		page,
	}) => {
		await page.goto(LIST_URL);
		await expect(filterBar(page)).toHaveCount(1);

		await expect(page).toHaveURL(LIST_URL);
	});

	test('should leave an address that already has a draft filter', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({ filters: STICKY_FILTERS });
		const query = 'is%3Apr+is%3Adraft';

		await page.goto(listUrl(query));
		await expect(filterBar(page)).toHaveCount(1);

		await expect(page).toHaveURL(listUrl(query));
	});

	test('should not apply a sticky setting whose chip is not shown', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { ...STICKY_FILTERS, chips: [FilterChipId.CiPassing] },
		});

		await page.goto(LIST_URL);
		await expect(filterBar(page)).toHaveCount(1);

		await expect(page).toHaveURL(LIST_URL);
	});

	test('should remember the state the Drafts chip was left in', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: STICKY_FILTERS,
		});
		await page.goto(LIST_URL);
		await expect(page).toHaveURL(
			listUrl('is%3Apr+state%3Aopen+-is%3Adraft')
		);

		await chip(page, 'Drafts: hidden').click();
		await expect(page).toHaveURL(
			listUrl('is%3Apr+state%3Aopen+is%3Adraft')
		);

		await test.step('a list opened later shows only drafts', async () => {
			await page.goto(LIST_URL);
			await expect(page).toHaveURL(
				listUrl('is%3Apr+state%3Aopen+is%3Adraft')
			);
		});

		await chip(page, 'Drafts: only').click();
		await expect(page).toHaveURL(listUrl('is%3Apr+state%3Aopen'));

		await test.step('showing all drafts is remembered too', async () => {
			await page.goto(LIST_URL);
			await expect(filterBar(page)).toHaveCount(1);
			await expect(page).toHaveURL(LIST_URL);
		});
	});
});

test('should treat an empty search text like a missing one', async ({
	page,
}) => {
	await page.goto(`${LIST_URL}?q=`);

	await chip(page, 'CI passing').click();

	await expect(page).toHaveURL(
		listUrl('is%3Apr+state%3Aopen+status%3Asuccess')
	);
});

test('should show the title of a chip as its description', async ({ page }) => {
	await page.goto(LIST_URL);

	await expect(chip(page, 'Needs your review')).toHaveAttribute(
		'title',
		'Review requested from you personally'
	);
});

test.describe('sticky chips, more cases', () => {
	test('should not reload an open list when the settings change', async ({
		page,
		storage,
	}) => {
		await page.goto(LIST_URL);
		await expect(filterBar(page).getByRole('button')).toHaveCount(
			DEFAULT_CHIPS.length
		);

		// The new chip list is the sync point: the bar has handled the change
		await storage.seedConfig({
			filters: {
				...STICKY_FILTERS,
				chips: [FilterChipId.Drafts, FilterChipId.CiPassing],
			},
		});

		await expect(filterBar(page).getByRole('button')).toHaveText([
			'Drafts: all',
			'CI passing',
		]);
		await expect(page).toHaveURL(LIST_URL);
	});

	test('should not redirect again when GitHub rewrites the address without the filters', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({ filters: STICKY_FILTERS });
		// GitHub taking the filters out of the address again (a `replaceState` after the router ran and the extension scanned the new address)
		// would make the extension redirect without end, if it did not remember its last redirect
		await page.addInitScript(() => {
			window.addEventListener('popstate', () => {
				Reflect.set(
					window,
					'hyperfriendPops',
					(Reflect.get(window, 'hyperfriendPops') ?? 0) + 1
				);
				setTimeout(() => {
					history.replaceState(null, '', location.pathname);
					// The list shows GitHub's default search text again
					const input = document.querySelector<HTMLInputElement>(
						'[role="search"] input'
					);
					if (input) {
						input.value = 'is:pr state:open';
					}
				}, 400);
			});
		});

		await page.goto(LIST_URL);

		await expect
			.poll(() =>
				page.evaluate(() =>
					sessionStorage.getItem('hyperfriend-filter-redirect')
				)
			)
			.not.toBeNull();
		// The bar shows the plain list again only when the scan after the rewrite did not redirect
		await expect(chip(page, 'Drafts: all')).toBeVisible();
		await expect(page).toHaveURL(LIST_URL);
		// One redirect (one `popstate`) and no second one after the rewrite
		await expect
			.poll(() =>
				page.evaluate(() => Reflect.get(window, 'hyperfriendPops'))
			)
			.toBe(1);
	});
});

test.describe('chips in the order and with the filters of the user', () => {
	/** A custom chip the tests start from */
	const BUGS = {
		id: 'custom-abcd1234',
		label: 'Bugs',
		icon: 'bug',
		colour: 'red' as const,
		query: 'label:bug -label:wip',
	};

	test('should show the chips in the order of the settings', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: {
				chips: [
					FilterChipId.CiFailing,
					FilterChipId.Drafts,
					FilterChipId.NeedsYourReview,
				],
			},
		});
		await page.goto(LIST_URL);

		await expect(filterBar(page).getByRole('button')).toHaveText([
			'CI failing',
			'Drafts: all',
			'Needs your review',
		]);
	});

	test('should show a custom chip with its name, icon and colour', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: {
				custom: [BUGS],
				chips: [FilterChipId.Drafts, BUGS.id],
			},
		});
		await page.goto(LIST_URL);

		const bugs = chip(page, 'Bugs');
		await expect(bugs).toHaveAttribute('data-colour', 'red');
		await expect(bugs).toHaveAttribute(
			'title',
			'Adds label:bug -label:wip'
		);
		await expect(bugs.locator('svg.hyperfriend-icon-bug')).toHaveCount(1);
		await expect(filterBar(page).getByRole('button')).toHaveText([
			'Drafts: all',
			'Bugs',
		]);
	});

	test('should add the filter of a custom chip and take it away again', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { custom: [BUGS], chips: [BUGS.id] },
		});
		await page.goto(LIST_URL);

		await chip(page, 'Bugs').click();

		await expect(page).toHaveURL(
			listUrl('is%3Apr+state%3Aopen+label%3Abug+-label%3Awip')
		);
		await expect(chip(page, 'Bugs')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(chip(page, 'Bugs')).toHaveAttribute('data-active', '');

		await chip(page, 'Bugs').click();

		await expect(page).toHaveURL(listUrl('is%3Apr+state%3Aopen'));
		await expect(chip(page, 'Bugs')).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	test('should replace state:open when a custom chip asks for merged Pull Requests', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: {
				custom: [
					{
						...BUGS,
						id: 'custom-merged00',
						label: 'Merged',
						icon: 'git-merge',
						colour: 'purple',
						query: 'is:merged',
					},
				],
				chips: ['custom-merged00'],
			},
		});
		await page.goto(LIST_URL);

		await chip(page, 'Merged').click();

		await expect(page).toHaveURL(listUrl('is%3Apr+is%3Amerged'));
	});

	test('should replace the base branch of the search text with the one of a custom chip', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: {
				custom: [
					{
						...BUGS,
						label: 'Main',
						icon: 'git-branch',
						query: 'base:main',
					},
				],
				chips: [BUGS.id],
			},
		});
		await page.goto(listUrl('is%3Apr+state%3Aopen+base%3Adevelop'));

		await chip(page, 'Main').click();

		await expect(page).toHaveURL(
			listUrl('is%3Apr+state%3Aopen+base%3Amain')
		);
	});

	test('should follow a change of the order made while the list is open', async ({
		page,
		storage,
	}) => {
		await page.goto(LIST_URL);
		await expect(filterBar(page).getByRole('button')).toHaveCount(
			DEFAULT_CHIPS.length
		);

		await storage.seedConfig({
			filters: {
				chips: [FilterChipId.CiPassing, FilterChipId.NeedsYourReview],
			},
		});

		await expect(filterBar(page).getByRole('button')).toHaveText([
			'CI passing',
			'Needs your review',
		]);
	});

	test('should keep a custom chip that is not in the list out of the bar', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { custom: [BUGS], chips: [FilterChipId.Drafts] },
		});
		await page.goto(LIST_URL);

		await expect(filterBar(page).getByRole('button')).toHaveText([
			'Drafts: all',
		]);
	});

	test('should drop the id of a custom chip that does not exist', async ({
		page,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { chips: [FilterChipId.Drafts, 'custom-missing0'] },
		});
		await page.goto(LIST_URL);

		await expect(filterBar(page).getByRole('button')).toHaveText([
			'Drafts: all',
		]);
	});
});
