import { expect, test } from './fixtures/extension';
import { PAGES, snapshotItems, snapshotUrl } from './fixtures/github';

// Seed for the Playwright test agents (planner, generator, healer): the built extension on a GitHub snapshot.
// Coverage of the list itself is in pull-request-list.spec.ts.
test('should open the pull request list snapshot with the extension loaded', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		snapshotItems(PAGES.pullList).length
	);
});
