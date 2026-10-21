import { expect, test } from './fixtures/extension';
import { PAGES, snapshotItems, snapshotUrl } from './fixtures/github';

// Seed for the Playwright test agents (planner, generator, healer): the built extension on a GitHub snapshot.
// It also proves the snapshot routing and the content script work together.
test('should open the pull request list snapshot with one copy button per pull request', async ({
	page,
}) => {
	const pullRequests = snapshotItems(PAGES.pullList);

	await page.goto(snapshotUrl(PAGES.pullList));

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		pullRequests.length
	);
	for (const { number } of pullRequests) {
		await expect(
			page.getByRole('button', {
				name: `Copy link to pull request #${number}`,
				exact: true,
			})
		).toHaveCount(1);
	}
});
