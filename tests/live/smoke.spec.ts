import { Locator } from '@playwright/test';

import { expect, test } from '../e2e/fixtures/extension';
import {
	elementBeforeTitleButton,
	PAGES,
	REPOSITORY,
	snapshotItems,
	titleButton,
} from '../e2e/fixtures/github';

// Smoke checks on real github.com (react/react, signed out). A failure here means GitHub changed
// its markup: refresh the snapshots (npm run test:snapshots) and the selectors in src/content.

/** Issue 10 is long closed, so its title is stable; the snapshot index records it */
const [ISSUE] = snapshotItems(PAGES.issue);
const ISSUE_URL = `https://github.com${REPOSITORY}/issues/${ISSUE.number}`;
const ISSUE_BUTTON = `Copy link to issue #${ISSUE.number}`;

const [PULL_REQUEST] = snapshotItems(PAGES.pull);

/**
 * Waits until the number of matches stops changing (GitHub renders list rows gradually) and returns it.
 *
 * @param locator - Elements to count.
 */
async function settledCount(locator: Locator): Promise<number> {
	let previous = -1;
	await expect
		.poll(
			async () => {
				const current = await locator.count();
				const settled = current > 0 && current === previous;
				previous = current;
				return settled;
			},
			{ message: 'the list stops growing', intervals: [500] }
		)
		.toBe(true);
	return previous;
}

test('should add one copy button per pull request on the list', async ({
	page,
}) => {
	await page.goto(`https://github.com${PAGES.pullList}`);
	const rows = await settledCount(
		page.locator('a[data-testid="listitem-title-link"]')
	);

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		rows
	);
});

test('should add the quick filter bar right after the search box of the pull request list', async ({
	page,
}) => {
	await page.goto(`https://github.com${PAGES.pullList}`);

	await expect(
		page.locator(
			'[role="search"][aria-label="Pull requests"] + [data-hyperfriend="filter-bar"] button'
		)
	).toHaveText([
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
	]);
});

test('should add the copy button right after the issue number', async ({
	page,
}) => {
	await page.goto(`https://github.com${PAGES.issue}`);

	await expect(titleButton(page, ISSUE_BUTTON)).toHaveCount(1);
	await expect(elementBeforeTitleButton(page, ISSUE_BUTTON)).toHaveText(
		`#${ISSUE.number}`
	);
});

test('should copy the exact rich link of issue 10', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	expect(ISSUE.title, 'precondition: no HTML markup characters').not.toMatch(
		/[&<>"]/
	);
	await page.goto(`https://github.com${PAGES.issue}`);
	await writeClipboardSentinel(page, 'sentinel: live issue');

	await titleButton(page, ISSUE_BUTTON).click();

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

test('should add the copy button to the pull request Conversation tab', async ({
	page,
}) => {
	await page.goto(`https://github.com${PAGES.pull}`);

	await expect(
		titleButton(page, `Copy link to pull request #${PULL_REQUEST.number}`)
	).toHaveCount(1);
});
