import { Locator, Page } from '@playwright/test';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	PAGES,
	REPOSITORY,
	snapshotItems,
	snapshotUrl,
} from './fixtures/github';

// Search results (pull request and issue search snapshots): one button per result, the copied
// payload, and Shift+C doing nothing on a search page.

/**
 * Search result title holding the title link with this exact text. `.search-title` is the stable
 * legacy hook GitHub keeps on search results (search rows have no list item role).
 *
 * @param page - Search results page.
 * @param title - Title of the result.
 */
function resultTitleOf(page: Page, title: string): Locator {
	return page
		.locator('.search-title')
		.filter({ has: page.getByRole('link', { name: title, exact: true }) });
}

const SEARCHES = [
	{
		kind: 'pull request',
		page: PAGES.searchPulls,
		path: 'pull',
		linkText: 'PR',
	},
	{
		kind: 'issue',
		page: PAGES.searchIssues,
		path: 'issues',
		linkText: 'Issue',
	},
] as const;

for (const search of SEARCHES) {
	const RESULTS = snapshotItems(search.page);
	/** First result; its title has no HTML special characters, so the payload literal stays readable */
	const FIRST = RESULTS[0];
	const FIRST_URL = `https://github.com${REPOSITORY}/${search.path}/${FIRST.number}`;

	test.describe(`${search.kind} search`, () => {
		test('should give every result exactly one copy button named after its number', async ({
			page,
		}) => {
			await page.goto(snapshotUrl(search.page));

			// The number links under each result (`#123`) are not titles and get no button
			await expect(
				page.locator('[data-hyperfriend="copy-button"]')
			).toHaveCount(RESULTS.length);
			for (const { number, title } of RESULTS) {
				await expect(
					resultTitleOf(page, title).getByRole('button', {
						name: `Copy link to ${search.kind} #${number}`,
						exact: true,
					})
				).toHaveCount(1);
			}
		});

		test('should copy the rich link of a result', async ({
			page,
			readClipboard,
			writeClipboardSentinel,
			normalizeHtml,
		}) => {
			expect(
				FIRST.title,
				'precondition: no HTML special characters'
			).not.toMatch(/[&<>"']/);
			await page.goto(snapshotUrl(search.page));
			await writeClipboardSentinel(
				page,
				`sentinel: ${search.kind} search`
			);

			await resultTitleOf(page, FIRST.title)
				.getByRole('button', {
					name: `Copy link to ${search.kind} #${FIRST.number}`,
					exact: true,
				})
				.click();

			await test.step('the clipboard holds the default template', async () => {
				const html = await normalizeHtml(
					page,
					`<a href="${FIRST_URL}">${search.linkText} ${FIRST.number}</a>: ${FIRST.title}`
				);
				await expect
					.poll(() => readClipboard(page))
					.toEqual({
						html,
						text: `${search.linkText} ${FIRST.number}: ${FIRST.title} — ${FIRST_URL}`,
					});
			});

			await test.step('the button confirms the copy, also to screen readers', async () => {
				await expect(
					page.locator('[data-hyperfriend="tooltip"]')
				).toHaveText('Copied!');
				await expect(
					page.locator('[data-hyperfriend="live-region"]')
				).toHaveText('Copied!');
			});
		});

		test('should leave Shift+C to the page', async ({
			page,
			readClipboard,
			writeClipboardSentinel,
			recordKeys,
		}) => {
			await page.goto(snapshotUrl(search.page));
			// Positive control: the buttons prove the config loaded and the shortcut listener started
			await expect(
				page.locator('[data-hyperfriend="copy-button"]')
			).toHaveCount(RESULTS.length);
			await readyForShortcut(page);
			const readKeys = await recordKeys(page);
			await writeClipboardSentinel(
				page,
				`sentinel: ${search.kind} search shortcut`
			);

			await page.keyboard.press('Shift+C');

			await expect
				.poll(readKeys)
				.toContainEqual({ code: 'KeyC', defaultPrevented: false });
			expect(await readClipboard(page)).toEqual({
				html: '',
				text: `sentinel: ${search.kind} search shortcut`,
			});
			// The toast element is created on first use, so none exists when nothing was copied
			await expect(
				page.locator('[data-hyperfriend="toast"]')
			).toHaveCount(0);
		});
	});
}
