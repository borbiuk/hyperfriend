import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	firstPlainItem,
	PAGES,
	REPOSITORY,
	rowOf,
	snapshotItems,
	snapshotUrl,
} from './fixtures/github';

// Issue list (react/react/issues snapshot): one button per row, the copied payload, no author
// avatars, and Shift+C doing nothing on a list.

const ISSUES = snapshotItems(PAGES.issueList);

/** Titles repeat on this list (several rows are titled "Bug:"), so rows are counted per title */
const TITLES = [...new Set(ISSUES.map((issue) => issue.title))];

/** First row whose title has no HTML special characters, so the payload literal stays readable */
const FIRST = firstPlainItem(PAGES.issueList);
const FIRST_URL = `https://github.com${REPOSITORY}/issues/${FIRST.number}`;
const FIRST_BUTTON = `Copy link to issue #${FIRST.number}`;

test('should give every issue row exactly one copy button named after its number', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.issueList));

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		ISSUES.length
	);
	for (const title of TITLES) {
		const issues = ISSUES.filter((issue) => issue.title === title);
		const rows = rowOf(page, title);
		await expect(
			rows.locator('[data-hyperfriend="copy-button"]')
		).toHaveCount(issues.length);
		for (const { number } of issues) {
			await expect(
				rows.getByRole('button', {
					name: `Copy link to issue #${number}`,
					exact: true,
				})
			).toHaveCount(1);
		}
	}
});

test('should copy the rich link of an issue from its row', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.issueList));
	await writeClipboardSentinel(page, 'sentinel: issue list copy');

	await rowOf(page, FIRST.title)
		.getByRole('button', { name: FIRST_BUTTON, exact: true })
		.click();

	await test.step('the clipboard holds the default template: only "Issue <number>" is the link', async () => {
		const html = await normalizeHtml(
			page,
			`<a href="${FIRST_URL}">Issue ${FIRST.number}</a>: ${FIRST.title}`
		);
		await expect
			.poll(() => readClipboard(page))
			.toEqual({
				html,
				text: `Issue ${FIRST.number}: ${FIRST.title} — ${FIRST_URL}`,
			});
	});

	await test.step('the button confirms the copy, also to screen readers', async () => {
		await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
			'Copied!'
		);
		await expect(
			page.locator('[data-hyperfriend="live-region"]')
		).toHaveText('Copied!');
	});
});

test('should not add author avatars to issue rows', async ({ page }) => {
	await page.goto(snapshotUrl(PAGES.issueList));
	// Positive control: the buttons come from the same scan that adds avatars on pull request lists
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		ISSUES.length
	);
	// The snapshot rows do have author filter controls, so the absence is the product's choice, not missing markup
	await expect(
		page.locator('[data-testid="author-filter-link"]')
	).not.toHaveCount(0);

	await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(0);
});

test('should leave Shift+C to the page on the issue list', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	recordKeys,
}) => {
	await page.goto(snapshotUrl(PAGES.issueList));
	// Positive control: the buttons prove the config loaded and the shortcut listener started
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		ISSUES.length
	);
	await readyForShortcut(page);
	const readKeys = await recordKeys(page);
	await writeClipboardSentinel(page, 'sentinel: issue list shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(readKeys)
		.toContainEqual({ code: 'KeyC', defaultPrevented: false });
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: issue list shortcut',
	});
	// The toast element is created on first use, so none exists when nothing was copied
	await expect(page.locator('[data-hyperfriend="toast"]')).toHaveCount(0);
});
