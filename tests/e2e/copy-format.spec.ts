import { LinkFormat } from '@shared/models';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	firstPlainItem,
	PAGES,
	REPOSITORY,
	rowOf,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Copy format setting: what the row button and Shift+C put on the clipboard in Markdown mode, and
// that the rich link is unchanged for data stored before the setting existed.

const FIRST = firstPlainItem(PAGES.pullList);
const FIRST_URL = `https://github.com${REPOSITORY}/pull/${FIRST.number}`;
const FIRST_BUTTON = `Copy link to pull request #${FIRST.number}`;
const [ISSUE] = snapshotItems(PAGES.issue);
const ISSUE_URL = `https://github.com${REPOSITORY}/issues/${ISSUE.number}`;

test('should copy a Markdown link as plain text only from a list row', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
}) => {
	await storage.seedConfig({ format: LinkFormat.Markdown });
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: markdown row');

	await rowOf(page, FIRST.title)
		.getByRole('button', { name: FIRST_BUTTON, exact: true })
		.click();

	// No HTML flavor: chats and editors would paste a link instead of the Markdown source
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: '',
			text: `[PR ${FIRST.number}](${FIRST_URL}): ${FIRST.title}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should copy a Markdown link with Shift+C on the issue page', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
}) => {
	await storage.seedConfig({ format: LinkFormat.Markdown });
	await page.goto(snapshotUrl(PAGES.issue));
	await expect(
		titleButton(page, `Copy link to issue #${ISSUE.number}`)
	).toHaveCount(1);
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: markdown shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: '',
			text: `[Issue ${ISSUE.number}](${ISSUE_URL}): ${ISSUE.title}`,
		});
});

test('should copy the rich link from a config stored before the format existed', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	// Data written by 2.2.x: the current template format marker, no `format` field
	await storage.setRawConfig({
		templates: {
			'pull-request': '[PR {{pr_number}}]: {{pr_name}}',
			issue: '[Issue {{issue_number}}]: {{issue_name}}',
		},
		shortcuts: { 'copy-link': { keys: ['Shift', 'KeyC'], enabled: true } },
		display: { authorAvatars: true },
		templateFormat: 2,
	});
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: stored before format');

	await rowOf(page, FIRST.title)
		.getByRole('button', { name: FIRST_BUTTON, exact: true })
		.click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${FIRST_URL}">PR ${FIRST.number}</a>: ${FIRST.title}`
			),
			text: `PR ${FIRST.number}: ${FIRST.title} — ${FIRST_URL}`,
		});
});
