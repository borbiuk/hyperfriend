import { expect, test } from './fixtures/extension';
import { PAGES, rowOf, snapshotItems, snapshotUrl } from './fixtures/github';

// Author avatars on the pull request list (react/react/pulls snapshot): the author's avatar per row, loaded lazily,
// none while `display.authorAvatars` is off, and the setting applied live while the page is open.

const PULL_REQUESTS = snapshotItems(PAGES.pullList);

/** First and last rows: the top avatar is the positive control for lazy loading, the last one is far below it */
const FIRST = PULL_REQUESTS[0];
const LAST = PULL_REQUESTS[PULL_REQUESTS.length - 1];

/** A bot row: its login has brackets, which must be percent-encoded in the avatar URL */
const BOT = PULL_REQUESTS.find(({ author }) => author === 'dependabot[bot]');

/**
 * The avatar URL of a login, written out from the product rule (GitHub's avatar CDN, 32 px).
 *
 * @param login - Author login from the snapshot index.
 */
function avatarUrl(login: string | undefined): string {
	return `https://avatars.githubusercontent.com/${encodeURIComponent(String(login))}?size=32`;
}

test("should add the author's avatar right before the author of every pull request row", async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));

	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(
		PULL_REQUESTS.length
	);
	for (const { title, author } of PULL_REQUESTS) {
		const row = rowOf(page, title);
		await expect(
			row.locator(
				'[data-hyperfriend="avatar"] + a[data-testid="author-filter-link"]'
			)
		).toHaveCount(1);
		await expect(
			row.locator('[data-hyperfriend="avatar"]')
		).toHaveAttribute('src', avatarUrl(author));
	}
});

test('should percent-encode the brackets of a bot login in the avatar URL', async ({
	page,
}) => {
	expect(
		BOT,
		'precondition: the snapshot has a dependabot row'
	).toBeDefined();
	await page.goto(snapshotUrl(PAGES.pullList));

	await expect(
		rowOf(page, String(BOT?.title)).locator('[data-hyperfriend="avatar"]')
	).toHaveAttribute(
		'src',
		'https://avatars.githubusercontent.com/dependabot%5Bbot%5D?size=32'
	);
});

test('should load an avatar only once its row comes near the viewport', async ({
	page,
}) => {
	expect(
		PULL_REQUESTS.filter(({ author }) => author === LAST.author),
		"precondition: the last row's author has no other row, so its avatar URL is requested for it alone"
	).toHaveLength(1);
	const requested: string[] = [];
	page.on('request', (request) => {
		requested.push(request.url());
	});
	await page.goto(snapshotUrl(PAGES.pullList));
	const firstAvatar = rowOf(page, FIRST.title).locator(
		'[data-hyperfriend="avatar"]'
	);
	const lastRow = rowOf(page, LAST.title);
	const lastAvatar = lastRow.locator('[data-hyperfriend="avatar"]');
	await expect(lastAvatar).toHaveCount(1);

	await test.step('positive control: the top avatar loads once its row is in view', async () => {
		await rowOf(page, FIRST.title).scrollIntoViewIfNeeded();
		// The routing fixture answers avatar requests with a 1×1 PNG
		await expect(firstAvatar).toHaveJSProperty('naturalWidth', 1);
	});

	await test.step('the last avatar, thousands of pixels below, is not requested yet', async () => {
		// An eager image would have been requested together with the top one, before it loaded
		expect(requested).not.toContain(avatarUrl(LAST.author));
		await expect(lastAvatar).toHaveJSProperty('naturalWidth', 0);
	});

	await lastRow.scrollIntoViewIfNeeded();

	await expect(lastAvatar).toHaveJSProperty('naturalWidth', 1);
	expect(requested).toContain(avatarUrl(LAST.author));
});

test('should not add avatars while they are turned off', async ({
	page,
	storage,
}) => {
	await test.step('setup: turn author avatars off', async () => {
		await storage.seedConfig({ display: { authorAvatars: false } });
	});

	await page.goto(snapshotUrl(PAGES.pullList));
	// Positive control: the buttons come from the same scan that would add the avatars
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);

	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(0);
});

test('should remove the avatars when they are turned off while the list is open', async ({
	page,
	storage,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));
	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(
		PULL_REQUESTS.length
	);

	await storage.seedConfig({ display: { authorAvatars: false } });

	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(0);
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);
});

test('should add the avatars when they are turned on while the list is open', async ({
	page,
	storage,
}) => {
	await test.step('setup: turn author avatars off', async () => {
		await storage.seedConfig({ display: { authorAvatars: false } });
	});

	await page.goto(snapshotUrl(PAGES.pullList));
	// The buttons prove the first scan ran without avatars
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);
	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(0);

	await storage.seedConfig({ display: { authorAvatars: true } });

	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(
		PULL_REQUESTS.length
	);
});
