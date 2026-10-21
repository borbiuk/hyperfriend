import { Page } from '@playwright/test';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	elementBeforeTitleButton,
	PAGES,
	REPOSITORY,
	snapshotHtml,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Pull request page (react/react PR 9713): Shift+C on the Conversation tab, the title button on the
// sub-tabs, and the shortcut doing nothing on Files changed and Commits.

const NUMBER = 9713;
const TITLE =
	"[#9712] fix <input type=\"number\" /> value '.98' should not be equal to '0.98'.";
const PULL_URL = `https://github.com${REPOSITORY}/pull/${NUMBER}`;
/** Default template payload, written exactly as the extension escapes it */
const HTML = `<a href="${PULL_URL}">PR ${NUMBER}</a>: [#9712] fix &lt;input type=&quot;number&quot; /&gt; value &#39;.98&#39; should not be equal to &#39;0.98&#39;.`;
const TEXT = `PR ${NUMBER}: ${TITLE} — ${PULL_URL}`;
const BUTTON_NAME = `Copy link to pull request #${NUMBER}`;

test.beforeAll(() => {
	// The literals above are this file's oracle; they must describe the snapshot the tests load
	expect(snapshotItems(PAGES.pull)).toEqual([
		{ number: NUMBER, title: TITLE },
	]);
});

/**
 * Changes the URL in place, the way GitHub's in-page navigation does, and tells the content script.
 *
 * @param page - Page showing a pull request snapshot.
 * @param path - New path.
 */
async function navigateInPage(page: Page, path: string): Promise<void> {
	await page.evaluate((nextPath) => {
		history.pushState({}, '', nextPath);
		document.dispatchEvent(new Event('turbo:load'));
	}, path);
}

test.describe('Conversation tab', () => {
	test('should copy the link with Shift+C and confirm it on the title button', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
	}) => {
		await page.goto(snapshotUrl(PAGES.pull));
		const button = titleButton(page, BUTTON_NAME);
		await expect(button).toHaveAttribute('aria-keyshortcuts', 'Shift+C');
		// Snapshots have no GitHub CSS, so the header starts below the fold; the tooltip needs the button in view
		await button.scrollIntoViewIfNeeded();
		await readyForShortcut(page);
		await writeClipboardSentinel(page, 'sentinel: conversation button');

		await page.keyboard.press('Shift+C');

		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
		await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
			'Copied!'
		);
		await expect(
			page.locator('[data-hyperfriend="live-region"]')
		).toHaveText('Copied!');
	});

	test('should copy the link with Shift+C and show the toast when the title has no button', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
	}) => {
		await test.step('setup: serve the page with a header layout the content script does not know', async () => {
			// Without a title button the shortcut builds the link from the URL and the document title
			const html = snapshotHtml(PAGES.pull).replace(
				'data-component="Heading"',
				'data-component="UnknownHeading"'
			);
			await page.route(snapshotUrl(PAGES.pull), (route) =>
				route.fulfill({
					contentType: 'text/html; charset=utf-8',
					body: html,
				})
			);
		});

		await page.goto(snapshotUrl(PAGES.pull));
		await readyForShortcut(page);
		// Checked after the first scan, so the absence is real
		await expect(titleButton(page, BUTTON_NAME)).toHaveCount(0);
		await writeClipboardSentinel(page, 'sentinel: conversation toast');

		await page.keyboard.press('Shift+C');

		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
		await expect(page.locator('[data-hyperfriend="toast"]')).toHaveText(
			'Link copied'
		);
		await expect(
			page.locator('[data-hyperfriend="live-region"]')
		).toHaveText('Link copied');
	});

	test('should copy with Shift+C on a non-Latin keyboard layout', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
	}) => {
		await page.goto(snapshotUrl(PAGES.pull));
		await readyForShortcut(page);
		await writeClipboardSentinel(page, 'sentinel: Ukrainian layout');
		const cdp = await page.context().newCDPSession(page);

		// Ukrainian layout: the KeyC key types the Cyrillic "С"; the shortcut matches the physical key
		for (const type of ['keyDown', 'keyUp'] as const) {
			await cdp.send('Input.dispatchKeyEvent', {
				type,
				key: 'С',
				code: 'KeyC',
				modifiers: 8,
				windowsVirtualKeyCode: 67,
			});
		}

		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
	});

	test('should leave Shift+C to a text field that has focus', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
	}) => {
		await page.goto(snapshotUrl(PAGES.pull));

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

	test('should add the copy button right after the pull request number, outside the heading', async ({
		page,
	}) => {
		await page.goto(snapshotUrl(PAGES.pull));

		await expect(titleButton(page, BUTTON_NAME)).toHaveCount(1);
		await expect(elementBeforeTitleButton(page, BUTTON_NAME)).toHaveText(
			`#${NUMBER}`
		);
		// Inside the h1 the button label would become part of the heading's accessible name
		await expect(
			page.locator('h1 [data-hyperfriend="copy-button"]')
		).toHaveCount(0);
	});

	test('should refuse to copy while the URL already names another pull request but the header still shows this one', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
	}) => {
		await page.goto(snapshotUrl(PAGES.pull));
		await expect(titleButton(page, BUTTON_NAME)).toHaveCount(1);
		await writeClipboardSentinel(page, 'sentinel: header not updated');

		await test.step('setup: the URL changes to another pull request before the header re-renders', async () => {
			await navigateInPage(page, `${REPOSITORY}/pull/${NUMBER + 1}`);
			await expect(page).toHaveURL(
				`https://github.com${REPOSITORY}/pull/${NUMBER + 1}`
			);
		});

		// The button keeps its place; its name may already have changed with the rescan
		await page.locator('[data-hyperfriend="copy-button"]').click();

		await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
			'Copy failed'
		);
		await expect(
			page.locator('[data-hyperfriend="live-region"]')
		).toHaveText('Copy failed');
		expect(await readClipboard(page)).toEqual({
			html: '',
			text: 'sentinel: header not updated',
		});
	});

	test('should show the "Link copied" toast when the title button is out of view', async ({
		page,
	}) => {
		await page.goto(snapshotUrl(PAGES.pull));
		const button = titleButton(page, BUTTON_NAME);
		await expect(button).toHaveCount(1);
		await readyForShortcut(page);
		await page.mouse.wheel(0, 3000);
		await expect(button).not.toBeInViewport();

		await page.keyboard.press('Shift+C');

		await expect(page.locator('[data-hyperfriend="toast"]')).toHaveText(
			'Link copied'
		);
		await expect(
			page.locator('[data-hyperfriend="live-region"]')
		).toHaveText('Link copied');
	});
});

test.describe('Files changed tab', () => {
	test('should copy the pull request link, not the tab link, with the button after the number', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
	}) => {
		await page.goto(snapshotUrl(PAGES.pullFiles));
		const button = titleButton(page, BUTTON_NAME);
		await expect(elementBeforeTitleButton(page, BUTTON_NAME)).toHaveText(
			`#${NUMBER}`
		);
		await writeClipboardSentinel(page, 'sentinel: files button');

		await button.click();

		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
		await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
			'Copied!'
		);
		await expect(
			page.locator('[data-hyperfriend="live-region"]')
		).toHaveText('Copied!');
	});

	test('should leave Shift+C to the page and not announce the shortcut', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		recordKeys,
	}) => {
		await page.goto(snapshotUrl(PAGES.pullFiles));
		// Positive control: the title button proves the config loaded and the shortcut listener started
		const button = titleButton(page, BUTTON_NAME);
		await expect(button).toHaveCount(1);
		await expect(button).not.toHaveAttribute('aria-keyshortcuts');
		await readyForShortcut(page);
		const readKeys = await recordKeys(page);
		await writeClipboardSentinel(page, 'sentinel: files shortcut');

		await page.keyboard.press('Shift+C');

		await expect
			.poll(readKeys)
			.toContainEqual({ code: 'KeyC', defaultPrevented: false });
		expect(await readClipboard(page)).toEqual({
			html: '',
			text: 'sentinel: files shortcut',
		});
		// The toast element is created on first use, so none exists when nothing was copied
		await expect(page.locator('[data-hyperfriend="toast"]')).toHaveCount(0);
	});
});

test.describe('Commits tab', () => {
	test('should add the copy button right after the pull request number', async ({
		page,
	}) => {
		await page.goto(snapshotUrl(PAGES.pullCommits));

		await expect(titleButton(page, BUTTON_NAME)).toHaveCount(1);
		await expect(elementBeforeTitleButton(page, BUTTON_NAME)).toHaveText(
			`#${NUMBER}`
		);
	});

	test('should leave Shift+C to the page', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		recordKeys,
	}) => {
		await page.goto(snapshotUrl(PAGES.pullCommits));
		// Positive control: the live region is attached by the first scan, which starts right after the shortcut listener
		await readyForShortcut(page);
		const readKeys = await recordKeys(page);
		await writeClipboardSentinel(page, 'sentinel: commits shortcut');

		await page.keyboard.press('Shift+C');

		await expect
			.poll(readKeys)
			.toContainEqual({ code: 'KeyC', defaultPrevented: false });
		expect(await readClipboard(page)).toEqual({
			html: '',
			text: 'sentinel: commits shortcut',
		});
		// The toast element is created on first use, so none exists when nothing was copied
		await expect(page.locator('[data-hyperfriend="toast"]')).toHaveCount(0);
	});

	test('should allow Shift+C once the URL changes to the Conversation tab in place', async ({
		page,
		readClipboard,
		writeClipboardSentinel,
		normalizeHtml,
	}) => {
		await page.goto(snapshotUrl(PAGES.pullCommits));
		await readyForShortcut(page);
		await writeClipboardSentinel(page, 'sentinel: in-page navigation');

		await navigateInPage(page, PAGES.pull);
		await page.keyboard.press('Shift+C');

		await expect
			.poll(() => readClipboard(page))
			.toEqual({ html: await normalizeHtml(page, HTML), text: TEXT });
	});
});
