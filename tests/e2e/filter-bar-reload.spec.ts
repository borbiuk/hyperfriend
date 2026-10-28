import { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures/extension';
import { PAGES, snapshotUrl } from './fixtures/github';

// Quick filter bar when GitHub's router does not follow a change of the address (the snapshots hold
// no scripts, like a classic server-rendered list): the extension then loads the page the usual
// way, so the list still shows the filter. Specs with a router are in filter-bar.spec.ts.

const LIST_URL = snapshotUrl(PAGES.pullList);

/**
 * The filter bar.
 *
 * @param page - GitHub page.
 */
function filterBar(page: Page): Locator {
	return page.locator('[data-hyperfriend="filter-bar"]');
}

test('should load the page when the search box does not follow the new address', async ({
	page,
}) => {
	await page.goto(LIST_URL);
	await expect(filterBar(page)).toHaveCount(1);
	await page.evaluate(() => {
		Reflect.set(window, 'hyperfriendSamePage', true);
	});

	await filterBar(page)
		.getByRole('button', { name: 'CI passing', exact: true })
		.click();

	await expect(page).toHaveURL(
		`${LIST_URL}?q=is%3Apr+state%3Aopen+status%3Asuccess`
	);
	// The page is loaded again: the marker of the old document is gone
	await expect
		.poll(() =>
			page
				.evaluate(() => Reflect.get(window, 'hyperfriendSamePage'))
				.catch(() => true)
		)
		.toBeUndefined();
	await expect(
		filterBar(page).getByRole('button', { name: 'CI passing', exact: true })
	).toHaveAttribute('data-active', '');
});
