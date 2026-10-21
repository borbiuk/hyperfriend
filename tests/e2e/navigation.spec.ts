import { Page } from '@playwright/test';

import { expect, test } from './fixtures/extension';
import {
	PAGES,
	REPOSITORY,
	rowOf,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// SPA navigation (Turbo): the next page's body is swapped in without a page load, as GitHub does.
// After a rescan every new item has exactly one button, and a detail page copies the item in the
// URL, never the previous header's title.

const PULL_REQUESTS = snapshotItems(PAGES.pullList);
const ISSUES = snapshotItems(PAGES.issueList);
const [ISSUE] = snapshotItems(PAGES.issue);
const ISSUE_URL = `https://github.com${REPOSITORY}/issues/${ISSUE.number}`;
const ISSUE_BUTTON = `Copy link to issue #${ISSUE.number}`;

/**
 * Navigates in place like Turbo: fetches the snapshot of `path` (served by the routing fixture),
 * pushes the URL, replaces the title and `document.body`, then dispatches `turbo:render` and
 * `turbo:load`. `page.goto()` would be a full load, a different code path.
 *
 * @param page - Page showing a snapshot.
 * @param path - One of PAGES.
 */
async function navigateInPage(page: Page, path: string): Promise<void> {
	await page.evaluate(async (nextPath) => {
		const html = await (await fetch(nextPath)).text();
		const next = new DOMParser().parseFromString(html, 'text/html');
		history.pushState({}, '', nextPath);
		document.title = next.title;
		document.body.replaceWith(document.adoptNode(next.body));
		document.dispatchEvent(new Event('turbo:render', { bubbles: true }));
		document.dispatchEvent(new Event('turbo:load', { bubbles: true }));
	}, path);
}

test('should give every issue exactly one button after navigating from the pull request list to the issue list', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);

	await navigateInPage(page, PAGES.issueList);

	await expect(page).toHaveURL(snapshotUrl(PAGES.issueList));
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		ISSUES.length
	);
	for (const { number, title } of ISSUES) {
		await expect(
			rowOf(page, title).getByRole('button', {
				name: `Copy link to issue #${number}`,
				exact: true,
			})
		).toHaveCount(1);
	}
});

test('should copy the issue in the URL after navigating from the list to the issue page', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	expect(ISSUE.title, 'precondition: no HTML markup characters').not.toMatch(
		/[&<>"]/
	);
	await page.goto(snapshotUrl(PAGES.issueList));
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		ISSUES.length
	);

	await navigateInPage(page, PAGES.issue);

	const button = titleButton(page, ISSUE_BUTTON);

	await test.step('exactly one button: the title button of the issue', async () => {
		await expect(
			page.locator('[data-hyperfriend="copy-button"]')
		).toHaveCount(1);
		await expect(button).toHaveCount(1);
	});

	await writeClipboardSentinel(page, 'sentinel: navigated issue');

	await button.click();

	// An apostrophe in text is serialized the same whether it was escaped or not
	const html = await normalizeHtml(
		page,
		`<a href="${ISSUE_URL}">Issue ${ISSUE.number}</a>: ${ISSUE.title}`
	);
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html,
			text: `Issue ${ISSUE.number}: ${ISSUE.title} — ${ISSUE_URL}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should restore one button per issue after going back from the issue page', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.issueList));
	await navigateInPage(page, PAGES.issue);
	await expect(titleButton(page, ISSUE_BUTTON)).toHaveCount(1);

	await test.step('go back: the previous body returns and the browser fires popstate', async () => {
		await page.evaluate(async (previousPath) => {
			const html = await (await fetch(previousPath)).text();
			const previous = new DOMParser().parseFromString(html, 'text/html');
			document.title = previous.title;
			document.body.replaceWith(document.adoptNode(previous.body));
			history.back();
		}, PAGES.issueList);
		await expect(page).toHaveURL(snapshotUrl(PAGES.issueList));
	});

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		ISSUES.length
	);
	for (const { number, title } of ISSUES) {
		await expect(
			rowOf(page, title).getByRole('button', {
				name: `Copy link to issue #${number}`,
				exact: true,
			})
		).toHaveCount(1);
	}
});

test('should refuse to copy while the URL already names another issue but the header still shows the previous one', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
}) => {
	const OTHER = ISSUES[0];
	await page.goto(snapshotUrl(PAGES.issue));
	const button = titleButton(page, ISSUE_BUTTON);
	await expect(button).toHaveCount(1);
	await writeClipboardSentinel(page, 'sentinel: header not updated');

	await test.step('setup: the URL changes to another issue before the header re-renders', async () => {
		await page.evaluate((nextPath) => {
			history.pushState({}, '', nextPath);
			document.dispatchEvent(new Event('turbo:load', { bubbles: true }));
		}, `${REPOSITORY}/issues/${OTHER.number}`);
		await expect(page).toHaveURL(
			`https://github.com${REPOSITORY}/issues/${OTHER.number}`
		);
	});

	await button.click();

	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copy failed'
	);
	await expect(page.locator('[data-hyperfriend="live-region"]')).toHaveText(
		'Copy failed'
	);
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: header not updated',
	});
});
