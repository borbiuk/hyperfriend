import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	PAGES,
	REPOSITORY,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Settings stored by older versions (no `templateFormat` marker), read by the current build on the
// issue page (react/react issue 10). Template conversion cases are unit tests; these prove the
// content script reads converted data.

const [ISSUE] = snapshotItems(PAGES.issue);
const ISSUE_URL = `https://github.com${REPOSITORY}/issues/${ISSUE.number}`;
const BUTTON_NAME = `Copy link to issue #${ISSUE.number}`;

/** Default templates of 1.x and 2.0.0, as they were stored (written out: they are the old data, not today's constant) */
const OLD_DEFAULT_TEMPLATES = {
	'pull-request': 'PR {{pr_number}}: {{pr_name}}',
	issue: 'Issue {{issue_number}}: {{issue_name}}',
};

test.beforeAll(() => {
	expect(ISSUE.title, 'precondition: no HTML markup characters').not.toMatch(
		/[&<>"]/
	);
});

test('should copy with the new bracket default when 1.0.0 stored the old default templates', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await test.step('setup: settings as 1.0.0 stored them (templates only, the old defaults)', async () => {
		await storage.setRawConfig({
			templates: OLD_DEFAULT_TEMPLATES,
		});
	});

	await page.goto(snapshotUrl(PAGES.issue));
	await writeClipboardSentinel(page, 'sentinel: 1.0.0 data');

	await titleButton(page, BUTTON_NAME).click();

	// Kept as is, the old default would make the whole text the link
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
});

test('should copy a 2.0.0 custom template with brackets exactly as 2.0.0 did', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await test.step('setup: settings as 2.0.0 stored them, with brackets in a custom template', async () => {
		await storage.setRawConfig({
			templates: {
				...OLD_DEFAULT_TEMPLATES,
				issue: '[{{repo}}] {{issue_name}} (#{{issue_number}})',
			},
			shortcuts: {
				'copy-link': { keys: ['Shift', 'KeyC'], enabled: true },
			},
			display: { authorAvatars: true },
		});
	});

	await page.goto(snapshotUrl(PAGES.issue));
	await writeClipboardSentinel(page, 'sentinel: 2.0.0 data');

	await titleButton(page, BUTTON_NAME).click();

	// In 2.0.0 brackets were plain text and the whole text was the link
	const text = `[react] ${ISSUE.title} (#${ISSUE.number})`;
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${ISSUE_URL}">${text}</a>`
			),
			text: `${text} — ${ISSUE_URL}`,
		});
});

test('should fall back to Shift+C when the stored shortcut is reserved by the browser', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await test.step('setup: settings with the browser-reserved Ctrl+T as the copy link shortcut', async () => {
		await storage.setRawConfig({
			templates: OLD_DEFAULT_TEMPLATES,
			shortcuts: {
				'copy-link': { keys: ['Control', 'KeyT'], enabled: true },
			},
			display: { authorAvatars: true },
		});
	});

	await page.goto(snapshotUrl(PAGES.issue));
	await expect(titleButton(page, BUTTON_NAME)).toHaveAttribute(
		'aria-keyshortcuts',
		'Shift+C'
	);
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: reserved shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${ISSUE_URL}">Issue ${ISSUE.number}</a>: ${ISSUE.title}`
			),
			text: `Issue ${ISSUE.number}: ${ISSUE.title} — ${ISSUE_URL}`,
		});
});
