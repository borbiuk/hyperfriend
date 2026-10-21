import { Page } from '@playwright/test';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	elementBeforeTitleButton,
	HYDRATED_RESCAN_TIMEOUT_MS,
	markHydrated,
	PAGES,
	REPOSITORY,
	serveUnhydrated,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Issue page (react/react issue 10): the title button, Shift+C with the button in and out of view,
// and the cases where the shortcut is skipped (text field, open modal dialog, key repeat).

const NUMBER = 10;
const TITLE = "Can't require() react-tools module";
const ISSUE_URL = `https://github.com${REPOSITORY}/issues/${NUMBER}`;
/** Default template payload, written exactly as the extension escapes it */
const HTML = `<a href="${ISSUE_URL}">Issue ${NUMBER}</a>: Can&#39;t require() react-tools module`;
const TEXT = `Issue ${NUMBER}: ${TITLE} — ${ISSUE_URL}`;
const BUTTON_NAME = `Copy link to issue #${NUMBER}`;

/** Modifier bit of Shift in CDP `Input.dispatchKeyEvent` */
const CDP_SHIFT = 8;

test.beforeAll(() => {
	// The literals above are this file's oracle; they must describe the snapshot the tests load
	expect(snapshotItems(PAGES.issue)).toEqual([
		{ number: NUMBER, title: TITLE },
	]);
});

/**
 * Presses Shift+C through CDP, where the auto-repeat flag of a held key can be set.
 *
 * @param page - Issue page.
 * @param autoRepeat - Send the key down as a repeat of a held key.
 */
async function pressShiftCWithCdp(
	page: Page,
	autoRepeat: boolean
): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	for (const type of ['keyDown', 'keyUp'] as const) {
		await cdp.send('Input.dispatchKeyEvent', {
			type,
			key: 'C',
			code: 'KeyC',
			modifiers: CDP_SHIFT,
			windowsVirtualKeyCode: 67,
			autoRepeat,
		});
	}
	await cdp.detach();
}

test('should add the copy button right after the issue number', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.issue));

	await expect(titleButton(page, BUTTON_NAME)).toHaveCount(1);
	await expect(elementBeforeTitleButton(page, BUTTON_NAME)).toHaveText(
		`#${NUMBER}`
	);
});

test('should add the copy button only after GitHub has hydrated the page', async ({
	page,
}) => {
	// A button added to server-rendered markup before hydration makes React render the whole app
	// again, which removes the button
	await serveUnhydrated(page, PAGES.issue);
	await page.goto(snapshotUrl(PAGES.issue));
	await readyForShortcut(page);
	// Checked after the first scan, so the absence is real
	await expect(titleButton(page, BUTTON_NAME)).toHaveCount(0);

	await markHydrated(page);

	await expect(titleButton(page, BUTTON_NAME)).toHaveCount(1, {
		timeout: HYDRATED_RESCAN_TIMEOUT_MS,
	});
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
	await page.goto(snapshotUrl(PAGES.issue));
	await writeClipboardSentinel(page, 'sentinel: issue button');

	await titleButton(page, BUTTON_NAME).click();

	await test.step('the clipboard holds the default template: only "Issue <number>" is the link', async () => {
		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
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

test('should copy the link with Shift+C and confirm it on the title button', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.issue));
	const button = titleButton(page, BUTTON_NAME);
	await expect(button).toHaveAttribute('aria-keyshortcuts', 'Shift+C');
	// Without GitHub CSS the header sits below the fold; the tooltip path needs the whole button in view
	await button.scrollIntoViewIfNeeded();
	await expect(button).toBeInViewport({ ratio: 1 });
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: issue shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(() => readClipboard(page))
		.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
	await expect(page.locator('[data-hyperfriend="live-region"]')).toHaveText(
		'Copied!'
	);
});

test('should show the "Link copied" toast when the title button is out of view', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.issue));
	const button = titleButton(page, BUTTON_NAME);
	await expect(button).toHaveCount(1);
	await readyForShortcut(page);
	// Snapshots have no GitHub CSS: scrolling past the header leaves the button above the viewport
	await button.scrollIntoViewIfNeeded();
	await page.mouse.wheel(0, 3000);
	await expect(button).not.toBeInViewport();
	await writeClipboardSentinel(page, 'sentinel: issue toast');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(() => readClipboard(page))
		.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
	await expect(page.locator('[data-hyperfriend="toast"]')).toHaveText(
		'Link copied'
	);
	await expect(page.locator('[data-hyperfriend="live-region"]')).toHaveText(
		'Link copied'
	);
});

test('should leave Shift+C to a text field that has focus', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.issue));

	// Signed-out snapshots have no comment box; a plain text field stands in for it
	const field =
		await test.step('setup: add a text field to the page', async () => {
			await page.evaluate(() => {
				const input = document.createElement('textarea');
				input.setAttribute('aria-label', 'Comment');
				document.querySelector('main')?.prepend(input);
			});
			return page.getByRole('textbox', { name: 'Comment' });
		});

	await test.step('positive control: Shift+C copies while the page has focus', async () => {
		await readyForShortcut(page);
		await writeClipboardSentinel(page, 'sentinel: control');
		await page.keyboard.press('Shift+C');
		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
	});

	await writeClipboardSentinel(page, 'sentinel: text field');

	await field.focus();
	await page.keyboard.press('Shift+C');

	await expect(field).toHaveValue('C');
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: text field',
	});
});

/** The two kinds of open modal dialog the shortcut gives way to */
const MODAL_DIALOGS = [
	{
		kind: 'an open <dialog>',
		open: (): void => {
			const dialog = document.createElement('dialog');
			dialog.setAttribute('aria-label', 'Test dialog');
			dialog.textContent = 'Dialog content';
			document.body.append(dialog);
			dialog.showModal();
		},
	},
	{
		kind: 'an element with role="dialog" and aria-modal="true"',
		open: (): void => {
			const dialog = document.createElement('div');
			dialog.setAttribute('role', 'dialog');
			dialog.setAttribute('aria-modal', 'true');
			dialog.setAttribute('aria-label', 'Test dialog');
			dialog.textContent = 'Dialog content';
			document.body.append(dialog);
		},
	},
];

for (const { kind, open } of MODAL_DIALOGS) {
	test(`should leave Shift+C to the page while ${kind} is shown`, async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
		recordKeys,
	}) => {
		await page.goto(snapshotUrl(PAGES.issue));

		await test.step('positive control: Shift+C copies while no dialog is open', async () => {
			await readyForShortcut(page);
			await writeClipboardSentinel(page, 'sentinel: control');
			await page.keyboard.press('Shift+C');
			await expect
				.poll(() => readClipboard(page))
				.toEqual({
					html: await normalizeHtml(page, HTML),
					text: TEXT,
				});
		});

		await test.step('setup: open a modal dialog', async () => {
			await page.evaluate(open);
			await expect(
				page.getByRole('dialog', { name: 'Test dialog' })
			).toBeVisible();
		});

		const readKeys = await recordKeys(page);
		await writeClipboardSentinel(page, 'sentinel: modal dialog');

		await page.keyboard.press('Shift+C');

		await expect
			.poll(readKeys)
			.toContainEqual({ code: 'KeyC', defaultPrevented: false });
		expect(await readClipboard(page)).toEqual({
			html: '',
			text: 'sentinel: modal dialog',
		});
	});
}

test('should ignore the auto-repeat of a held Shift+C', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
	recordKeys,
}) => {
	await page.goto(snapshotUrl(PAGES.issue));
	await readyForShortcut(page);

	await test.step('positive control: the same CDP key press copies when it is not a repeat', async () => {
		await writeClipboardSentinel(page, 'sentinel: control');
		await pressShiftCWithCdp(page, false);
		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
	});

	const readKeys = await recordKeys(page);
	await writeClipboardSentinel(page, 'sentinel: key repeat');

	await pressShiftCWithCdp(page, true);

	await expect
		.poll(readKeys)
		.toContainEqual({ code: 'KeyC', defaultPrevented: false });
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: key repeat',
	});
});
