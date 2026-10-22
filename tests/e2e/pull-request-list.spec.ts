import { LinkType } from '@shared/models';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	firstPlainItem,
	HYDRATED_RESCAN_TIMEOUT_MS,
	markHydrated,
	PAGES,
	REPOSITORY,
	rowOf,
	serveUnhydrated,
	snapshotItems,
	snapshotUrl,
} from './fixtures/github';

// Pull request list (react/react/pulls snapshot): one button per row, the copied payload, the stored
// template, and Shift+C doing nothing on a list.

const PULL_REQUESTS = snapshotItems(PAGES.pullList);

/** A row that shows an author, a state and labels, none with HTML special characters; the list changes with every snapshot refresh */
const DETAILED = PULL_REQUESTS.find(
	({ author, state, labels }) =>
		author && state && labels?.length && !/[&<>"']/.test(labels.join(', '))
);

/** First row whose title has no HTML special characters, so the payload literal stays readable */
const FIRST = firstPlainItem(PAGES.pullList);
const FIRST_URL = `https://github.com${REPOSITORY}/pull/${FIRST.number}`;
const FIRST_BUTTON = `Copy link to pull request #${FIRST.number}`;

test('should give every pull request row exactly one copy button named after its number', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);
	for (const { number, title } of PULL_REQUESTS) {
		await expect(
			rowOf(page, title).getByRole('button', {
				name: `Copy link to pull request #${number}`,
				exact: true,
			})
		).toHaveCount(1);
	}
});

test('should add row buttons and avatars only after GitHub has hydrated the list', async ({
	page,
}) => {
	await serveUnhydrated(page, PAGES.pullList);
	const buttons = page.locator('[data-hyperfriend="copy-button"]');
	const avatars = page.locator('img[data-hyperfriend="avatar"]');

	await page.goto(snapshotUrl(PAGES.pullList));
	await readyForShortcut(page);
	// Checked after the first scan, so the absence is real; with no rows to inject, the scan must
	// not fall back to other pull request links either
	await expect(buttons).toHaveCount(0);
	await expect(avatars).toHaveCount(0);

	await markHydrated(page);

	await expect(buttons).toHaveCount(PULL_REQUESTS.length, {
		timeout: HYDRATED_RESCAN_TIMEOUT_MS,
	});
	await expect(
		rowOf(page, FIRST.title).getByRole('button', {
			name: FIRST_BUTTON,
			exact: true,
		})
	).toHaveCount(1);
	await expect(avatars).not.toHaveCount(0);
});

test('should copy the rich link of a pull request from its row', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: list copy');

	await rowOf(page, FIRST.title)
		.getByRole('button', { name: FIRST_BUTTON, exact: true })
		.click();

	await test.step('the clipboard holds the default template: only "PR <number>" is the link', async () => {
		const html = await normalizeHtml(
			page,
			`<a href="${FIRST_URL}">PR ${FIRST.number}</a>: ${FIRST.title}`
		);
		await expect
			.poll(() => readClipboard(page))
			.toEqual({
				html,
				text: `PR ${FIRST.number}: ${FIRST.title} — ${FIRST_URL}`,
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

test('should fill the author, state and label placeholders from the pull request row', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	expect(
		DETAILED,
		'precondition: a pull request row shows an author, a state and labels'
	).toBeDefined();
	const url = `https://github.com${REPOSITORY}/pull/${DETAILED?.number}`;

	await storage.seedConfig({
		templates: {
			[LinkType.PullRequest]:
				'{{ref}} | {{state}} | {{author}} | {{labels}} | {{assignees}}.',
			[LinkType.Issue]: '[Issue {{issue_number}}]: {{issue_name}}',
		},
	});
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: row placeholders');

	await page
		.getByRole('button', {
			name: `Copy link to pull request #${DETAILED?.number}`,
			exact: true,
		})
		.click();

	// A row does not show assignees, so that placeholder renders empty
	const text = `react/react#${DETAILED?.number} | ${DETAILED?.state} | ${DETAILED?.author} | ${DETAILED?.labels?.join(', ')} | .`;
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(page, `<a href="${url}">${text}</a>`),
			text: `${text} — ${url}`,
		});
});

test('should copy the link with the pull request template saved in settings', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await test.step('setup: save a custom pull request template', async () => {
		await storage.seedConfig({
			templates: {
				[LinkType.PullRequest]:
					'{{repo}}: {{pr_name}} (#[{{pr_number}}])',
				[LinkType.Issue]: '[Issue {{issue_number}}]: {{issue_name}}',
			},
		});
	});

	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: custom template');

	await rowOf(page, FIRST.title)
		.getByRole('button', { name: FIRST_BUTTON, exact: true })
		.click();

	const html = await normalizeHtml(
		page,
		`react: ${FIRST.title} (#<a href="${FIRST_URL}">${FIRST.number}</a>)`
	);
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html,
			text: `react: ${FIRST.title} (#${FIRST.number}) — ${FIRST_URL}`,
		});
});

test('should leave Shift+C to the page on the pull request list', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	recordKeys,
}) => {
	await page.goto(snapshotUrl(PAGES.pullList));
	// Positive control: the buttons prove the config loaded and the shortcut listener started
	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		PULL_REQUESTS.length
	);
	await readyForShortcut(page);
	const readKeys = await recordKeys(page);
	await writeClipboardSentinel(page, 'sentinel: list shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(readKeys)
		.toContainEqual({ code: 'KeyC', defaultPrevented: false });
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: list shortcut',
	});
	// The toast element is created on first use, so none exists when nothing was copied
	await expect(page.locator('[data-hyperfriend="toast"]')).toHaveCount(0);
});
