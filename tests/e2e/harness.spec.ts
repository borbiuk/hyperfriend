import { expect, test } from './fixtures/extension';
import { PAGES, rowOf, snapshotItems, snapshotUrl } from './fixtures/github';

/**
 * Escapes text for use inside a RegExp.
 *
 * @param text - Literal text.
 */
function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Checks of the test harness itself: extension loading, storage and clipboard helpers, snapshot routing.

test('should load the extension and open its settings page', async ({
	openOptions,
}) => {
	const options = await openOptions();

	await expect(
		options.getByRole('heading', { name: 'Hyperfriend' })
	).toBeVisible();
	await expect(
		options.getByRole('tab', { name: 'Templates' })
	).toHaveAttribute('aria-selected', 'true');
});

test('should store seeded settings in the shape the extension writes', async ({
	storage,
}) => {
	await storage.seedConfig({ display: { authorAvatars: false } });

	expect(await storage.getConfig()).toMatchObject({
		templateFormat: 2,
		display: { authorAvatars: false },
		templates: { 'pull-request': '[PR {{pr_number}}]: {{pr_name}}' },
		shortcuts: { 'copy-link': { keys: ['Shift', 'KeyC'], enabled: true } },
	});
});

test('should read back a clipboard sentinel on a GitHub page', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));

	await writeClipboardSentinel(page, 'sentinel');

	expect(await readClipboard(page)).toEqual({ html: '', text: 'sentinel' });
});

for (const pagePath of [
	PAGES.pull,
	PAGES.pullFiles,
	PAGES.pullCommits,
	PAGES.issue,
]) {
	test(`should serve the ${pagePath} snapshot of its item`, async ({
		page,
	}) => {
		const [{ number, title }] = snapshotItems(pagePath);

		await page.goto(snapshotUrl(pagePath));

		// The document title names the item; headings are repeated in sticky headers
		await expect(page).toHaveTitle(
			new RegExp(`^${escapeRegExp(title)} .*#${number} `)
		);
	});
}

for (const pagePath of [PAGES.pullList, PAGES.issueList]) {
	test(`should serve the ${pagePath} snapshot with every recorded item`, async ({
		page,
	}) => {
		// Titles are not unique (several issues can be called "Bug:"), so count each title
		const countByTitle = new Map<string, number>();
		for (const { title } of snapshotItems(pagePath)) {
			countByTitle.set(title, (countByTitle.get(title) ?? 0) + 1);
		}

		await page.goto(snapshotUrl(pagePath));

		for (const [title, count] of countByTitle) {
			await expect(
				page.getByRole('link', { name: title, exact: true })
			).toHaveCount(count);
		}
	});
}

test.describe('with avatar requests failing', () => {
	test.use({ githubRoutes: { avatars: 'error' } });

	test('should remove the author avatar of a row whose avatar failed to load', async ({
		page,
	}) => {
		const [firstPullRequest] = snapshotItems(PAGES.pullList);

		await page.goto(snapshotUrl(PAGES.pullList));
		const firstRow = rowOf(page, firstPullRequest.title);
		// The avatar is injected in the same scan as the button
		await expect(
			firstRow.locator('[data-hyperfriend="avatar"]')
		).toHaveCount(1);
		// Avatars are lazy-loaded: the request (and its error) only happens in view
		await firstRow.scrollIntoViewIfNeeded();

		await expect(
			firstRow.locator('[data-hyperfriend="avatar"]')
		).toHaveCount(0);
	});
});

test('should load the author avatar of a row in view', async ({ page }) => {
	const [firstPullRequest] = snapshotItems(PAGES.pullList);

	await page.goto(snapshotUrl(PAGES.pullList));
	const firstRow = rowOf(page, firstPullRequest.title);
	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(
		snapshotItems(PAGES.pullList).length
	);
	// Avatars are lazy-loaded: the request only happens in view
	await firstRow.scrollIntoViewIfNeeded();

	// The routed avatar is a 1×1 PNG
	await expect
		.poll(() =>
			firstRow
				.locator('[data-hyperfriend="avatar"]')
				.evaluate((img: HTMLImageElement) => img.naturalWidth)
		)
		.toBe(1);
});
