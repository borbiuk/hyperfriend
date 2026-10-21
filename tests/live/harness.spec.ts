import { expect, test } from '../e2e/fixtures/extension';
import { PAGES } from '../e2e/fixtures/github';

test('should add one copy button per pull request on the live react/react list', async ({
	page,
}) => {
	await page.goto(`https://github.com${PAGES.pullList}`);
	const titleLinks = page.locator('a[data-testid="listitem-title-link"]');

	await expect(titleLinks).not.toHaveCount(0);
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		await titleLinks.count()
	);
});
