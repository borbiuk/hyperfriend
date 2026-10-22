import { Page } from '@playwright/test';
import { LinkType } from '@shared/models';

import { expect, test } from './fixtures/extension';
import {
	DISCUSSIONS_REPOSITORY,
	PAGES,
	SnapshotItem,
	snapshotItems,
	snapshotUrl,
} from './fixtures/github';

// Discussion list (vercel/next.js/discussions snapshot): one button per title, the pinned
// (spotlight) discussion too, the copied payload and the details the row shows.

/** Every title link of the page: the pinned discussion first, then the rows */
const DISCUSSIONS = snapshotItems(PAGES.discussionList);
const [PINNED, ...ROWS] = DISCUSSIONS;

/** First row whose title has no HTML special characters, so the payload literal stays readable */
const FIRST_ROW = ROWS.find(({ title }) => !/[&<>"']/.test(title));
const urlOf = (number: number): string =>
	`https://github.com${DISCUSSIONS_REPOSITORY}/discussions/${number}`;

/** The row (listitem) holding the title link with this exact text, without the pinned card */
const rowOf = (page: Page, title: string) =>
	page.getByRole('listitem').filter({
		has: page.getByRole('link', { name: title, exact: true }),
	});

test('should give every discussion title a copy button named after its number', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.discussionList));

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		DISCUSSIONS.length
	);
	for (const { number } of DISCUSSIONS) {
		// The pinned discussion is also a row of the list, so its number has two buttons
		await expect(
			page.getByRole('button', {
				name: `Copy link to discussion #${number}`,
				exact: true,
			})
		).toHaveCount(
			DISCUSSIONS.filter((item) => item.number === number).length
		);
	}
});

test('should copy the rich link of a discussion from its row', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(!FIRST_ROW, 'no discussion row has a plain title');
	const row = FIRST_ROW as SnapshotItem;
	await page.goto(snapshotUrl(PAGES.discussionList));
	await writeClipboardSentinel(page, 'sentinel: discussion row');

	await rowOf(page, row.title)
		.getByRole('button', {
			name: `Copy link to discussion #${row.number}`,
			exact: true,
		})
		.click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${urlOf(row.number)}">Discussion ${row.number}</a>: ${row.title}`
			),
			text: `Discussion ${row.number}: ${row.title} — ${urlOf(row.number)}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should copy the link of the pinned discussion from its card', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(/[&<>"']/.test(PINNED.title), 'the pinned title is not plain');
	await page.goto(snapshotUrl(PAGES.discussionList));
	await writeClipboardSentinel(page, 'sentinel: pinned discussion');

	await page
		.locator('discussion-spotlight-container')
		.getByRole('button', {
			name: `Copy link to discussion #${PINNED.number}`,
			exact: true,
		})
		.click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${urlOf(PINNED.number)}">Discussion ${PINNED.number}</a>: ${PINNED.title}`
			),
			text: `Discussion ${PINNED.number}: ${PINNED.title} — ${urlOf(PINNED.number)}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should fill the author and category placeholders from the discussion row', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(
		!(FIRST_ROW?.author && FIRST_ROW.category),
		'the first plain row shows no author and category'
	);
	const row = FIRST_ROW as SnapshotItem;
	await storage.seedConfig({
		templates: {
			[LinkType.Discussion]: '{{ref}} | {{author}} | {{category}}',
		},
	});
	await page.goto(snapshotUrl(PAGES.discussionList));
	await writeClipboardSentinel(page, 'sentinel: discussion placeholders');

	await rowOf(page, row.title)
		.getByRole('button', {
			name: `Copy link to discussion #${row.number}`,
			exact: true,
		})
		.click();

	const text = `vercel/next.js#${row.number} | ${row.author} | ${row.category}`;
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${urlOf(row.number)}">${text}</a>`
			),
			text: `${text} — ${urlOf(row.number)}`,
		});
});
