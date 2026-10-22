import { LinkType } from '@shared/models';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	DISCUSSIONS_REPOSITORY,
	elementBeforeTitleButton,
	PAGES,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Discussion page (vercel/next.js discussion 10640, the pinned one): the title button, Shift+C
// and the details of the header.

const NUMBER = 10640;
const TITLE = 'Companies / Sites using Next.js';
const URL = `https://github.com${DISCUSSIONS_REPOSITORY}/discussions/${NUMBER}`;
const BUTTON_NAME = `Copy link to discussion #${NUMBER}`;
/** What the snapshot's header shows; the placeholder test is checked against these literals */
const AUTHOR = 'timneutkens';
const CATEGORY = 'Show and tell';

test.beforeAll(() => {
	// The literals above are this file's oracle; they must describe the snapshot the tests load
	expect(snapshotItems(PAGES.discussion)).toEqual([
		{ number: NUMBER, title: TITLE, author: AUTHOR, category: CATEGORY },
	]);
});

test('should add the copy button right after the discussion number', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.discussion));

	await expect(titleButton(page, BUTTON_NAME)).toHaveCount(1);
	await expect(elementBeforeTitleButton(page, BUTTON_NAME)).toHaveText(
		`#${NUMBER}`
	);
});

test('should copy the rich link with the title button', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.discussion));
	await writeClipboardSentinel(page, 'sentinel: discussion button');

	await titleButton(page, BUTTON_NAME).click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${URL}">Discussion ${NUMBER}</a>: ${TITLE}`
			),
			text: `Discussion ${NUMBER}: ${TITLE} — ${URL}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should copy the link with Shift+C and announce the shortcut on the title button', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.discussion));
	const button = titleButton(page, BUTTON_NAME);
	await expect(button).toHaveAttribute('aria-keyshortcuts', 'Shift+C');
	// Snapshots have no GitHub CSS, so the header starts below the fold; the tooltip needs the button in view
	await button.scrollIntoViewIfNeeded();
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: discussion shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${URL}">Discussion ${NUMBER}</a>: ${TITLE}`
			),
			text: `Discussion ${NUMBER}: ${TITLE} — ${URL}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should fill the author and category placeholders from the header', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await storage.seedConfig({
		templates: {
			[LinkType.Discussion]:
				'{{ref}} | {{author}} | {{category}} | {{labels}}',
		},
	});
	await page.goto(snapshotUrl(PAGES.discussion));
	await readyForShortcut(page);
	await writeClipboardSentinel(
		page,
		'sentinel: discussion page placeholders'
	);

	await page.keyboard.press('Shift+C');

	// A discussion has no labels placeholder, so it stays as typed
	const text = `vercel/next.js#${NUMBER} | ${AUTHOR} | ${CATEGORY} | {{labels}}`;
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(page, `<a href="${URL}">${text}</a>`),
			text: `${text} — ${URL}`,
		});
});
