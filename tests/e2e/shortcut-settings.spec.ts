import { Page } from '@playwright/test';
import { ShortcutType } from '@shared/models';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	PAGES,
	REPOSITORY,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Copy link shortcut settings on the issue page (react/react issue 10): a disabled shortcut, a custom
// key combination, and a binding changed while the page is open.

const [ISSUE] = snapshotItems(PAGES.issue);
const ISSUE_URL = `https://github.com${REPOSITORY}/issues/${ISSUE.number}`;

/** A combination that is neither the default nor browser-reserved, and has no GitHub warning */
const CUSTOM_KEYS = ['Alt', 'Shift', 'KeyK'];
const CUSTOM_PRESS = 'Alt+Shift+K';

const BUTTON_NAME = `Copy link to issue #${ISSUE.number}`;

test.beforeAll(() => {
	expect(ISSUE.title, 'precondition: no HTML markup characters').not.toMatch(
		/[&<>"]/
	);
});

/**
 * The default-template payload of the issue, re-serialized as the clipboard returns it.
 *
 * @param normalizeHtml - Fixture that re-serializes HTML.
 * @param page - Issue page.
 */
async function expectedPayload(
	normalizeHtml: (page: Page, html: string) => Promise<string>,
	page: Page
): Promise<{ html: string; text: string }> {
	return {
		// An apostrophe in text is serialized the same whether it was escaped or not
		html: await normalizeHtml(
			page,
			`<a href="${ISSUE_URL}">Issue ${ISSUE.number}</a>: ${ISSUE.title}`
		),
		text: `Issue ${ISSUE.number}: ${ISSUE.title} — ${ISSUE_URL}`,
	};
}

test('should leave Shift+C to the page and not announce it while the shortcut is disabled', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	recordKeys,
}) => {
	await test.step('setup: disable the copy link shortcut', async () => {
		await storage.seedConfig({
			shortcuts: {
				[ShortcutType.CopyLink]: {
					keys: ['Shift', 'KeyC'],
					enabled: false,
				},
			},
		});
	});

	await page.goto(snapshotUrl(PAGES.issue));
	// Positive control: the title button proves the config loaded and the shortcut listener started
	const button = titleButton(page, BUTTON_NAME);
	await expect(button).toHaveCount(1);
	await expect(button).not.toHaveAttribute('aria-keyshortcuts');
	await readyForShortcut(page);
	const readKeys = await recordKeys(page);
	await writeClipboardSentinel(page, 'sentinel: disabled shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(readKeys)
		.toContainEqual({ code: 'KeyC', defaultPrevented: false });
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: disabled shortcut',
	});
	// The toast element is created on first use, so none exists when nothing was copied
	await expect(page.locator('[data-hyperfriend="toast"]')).toHaveCount(0);
});

test('should copy the link with a custom key combination', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await test.step('setup: bind the copy link shortcut to Alt+Shift+K', async () => {
		await storage.seedConfig({
			shortcuts: {
				[ShortcutType.CopyLink]: { keys: CUSTOM_KEYS, enabled: true },
			},
		});
	});

	await page.goto(snapshotUrl(PAGES.issue));
	await expect(titleButton(page, BUTTON_NAME)).toHaveAttribute(
		'aria-keyshortcuts',
		CUSTOM_PRESS
	);
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: custom shortcut');

	await page.keyboard.press(CUSTOM_PRESS);

	await expect
		.poll(() => readClipboard(page))
		.toEqual(await expectedPayload(normalizeHtml, page));
	// Without GitHub CSS the title button is below the fold, so the feedback is the toast
	await expect(page.locator('[data-hyperfriend="toast"]')).toHaveText(
		'Link copied'
	);
});

test('should leave Shift+C to the page once another combination is bound', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
	recordKeys,
}) => {
	await test.step('setup: bind the copy link shortcut to Alt+Shift+K', async () => {
		await storage.seedConfig({
			shortcuts: {
				[ShortcutType.CopyLink]: { keys: CUSTOM_KEYS, enabled: true },
			},
		});
	});

	await page.goto(snapshotUrl(PAGES.issue));
	await readyForShortcut(page);

	await test.step('positive control: the custom combination copies', async () => {
		await writeClipboardSentinel(page, 'sentinel: control');
		await page.keyboard.press(CUSTOM_PRESS);
		await expect
			.poll(() => readClipboard(page))
			.toEqual(await expectedPayload(normalizeHtml, page));
	});

	const readKeys = await recordKeys(page);
	await writeClipboardSentinel(page, 'sentinel: old shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(readKeys)
		.toContainEqual({ code: 'KeyC', defaultPrevented: false });
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: old shortcut',
	});
});

test('should apply a new key combination while the issue page is open', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.issue));
	const button = titleButton(page, BUTTON_NAME);
	await expect(button).toHaveAttribute('aria-keyshortcuts', 'Shift+C');

	await storage.seedConfig({
		shortcuts: {
			[ShortcutType.CopyLink]: { keys: CUSTOM_KEYS, enabled: true },
		},
	});

	// The change arrives through storage.onChanged and the next scan
	await expect(button).toHaveAttribute('aria-keyshortcuts', CUSTOM_PRESS);
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: live binding');

	await page.keyboard.press(CUSTOM_PRESS);

	await expect
		.poll(() => readClipboard(page))
		.toEqual(await expectedPayload(normalizeHtml, page));
});
