import { Locator, Page } from '@playwright/test';
import { LinkFormat } from '@shared/models';

import { expect, test } from './fixtures/extension';
import {
	DISCUSSIONS_REPOSITORY,
	PAGES,
	REPOSITORY,
	rowOf,
	SnapshotItem,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Shift+click on the copy buttons of a list collects items; the bar copies them as one list in the
// configured format, in the order of the page.

/** Pull requests of the list whose title has no HTML special characters (payload literals stay plain) */
const PLAIN = snapshotItems(PAGES.pullList).filter(
	({ title }) => !/[&<>"']/.test(title)
);
const [FIRST, SECOND, THIRD] = PLAIN;
const NOT_ENOUGH =
	'the list has fewer than three pull requests with plain titles';
const [ISSUE] = snapshotItems(PAGES.issue);
const urlOf = (number: number): string =>
	`https://github.com${REPOSITORY}/pull/${number}`;

/** The row button of a pull request */
function rowButton(page: Page, item: SnapshotItem): Locator {
	return rowOf(page, item.title).getByRole('button', {
		name: `Copy link to pull request #${item.number}`,
		exact: true,
	});
}

/** The selection bar */
function bar(page: Page): Locator {
	return page.getByRole('region', { name: 'Selected links' });
}

/**
 * Selects the first three pull requests (Shift+click) and checks that every button shows it.
 *
 * @param page - Page showing the pull request list snapshot.
 * @param items - The items to select, in the order of the clicks.
 */
async function select(page: Page, items: SnapshotItem[]): Promise<void> {
	for (const item of items) {
		await rowButton(page, item).click({ modifiers: ['Shift'] });
		await expect(rowButton(page, item)).toHaveAttribute(
			'data-selected',
			''
		);
	}
}

test('should select an item with Shift+click without copying, and unselect it again', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: selection');
	await expect(bar(page)).toBeHidden();

	await rowButton(page, FIRST).click({ modifiers: ['Shift'] });

	await expect(bar(page)).toBeVisible();
	await expect(bar(page)).toContainText('1 selected');
	await expect(rowButton(page, FIRST)).toHaveAttribute('data-selected', '');
	await expect(page.locator('[data-hyperfriend="live-region"]')).toHaveText(
		'Added to the selection, 1 selected. The Selected links region at the end of the page copies them'
	);

	await rowButton(page, SECOND).click({ modifiers: ['Shift'] });
	await expect(bar(page)).toContainText('2 selected');

	await rowButton(page, FIRST).click({ modifiers: ['Shift'] });
	await expect(bar(page)).toContainText('1 selected');
	await expect(rowButton(page, FIRST)).not.toHaveAttribute('data-selected');
	await expect(page.locator('[data-hyperfriend="live-region"]')).toHaveText(
		'Removed from the selection, 1 selected'
	);

	await rowButton(page, SECOND).click({ modifiers: ['Shift'] });
	await expect(bar(page)).toBeHidden();
	// Nothing was copied by any of the clicks
	expect(await readClipboard(page)).toEqual({
		html: '',
		text: 'sentinel: selection',
	});
});

test('should describe the selection to assistive technologies on the row button', async ({
	page,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await expect(rowButton(page, FIRST)).toHaveAttribute(
		'aria-description',
		'Shift+click to select several'
	);

	await rowButton(page, FIRST).click({ modifiers: ['Shift'] });

	await expect(rowButton(page, FIRST)).toHaveAttribute(
		'aria-description',
		'Selected. Shift+click to remove'
	);
	await expect(rowButton(page, SECOND)).toHaveAttribute(
		'aria-description',
		'Shift+click to select several'
	);
});

test('should copy the selected items as a list in the order of the page and then clear the selection', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: list copy');
	// Selected out of order: the list follows the page, not the clicks
	await select(page, [THIRD, FIRST]);

	await bar(page)
		.getByRole('button', { name: 'Copy links', exact: true })
		.click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<ul><li><a href="${urlOf(FIRST.number)}">PR ${FIRST.number}</a>: ${FIRST.title}</li><li><a href="${urlOf(THIRD.number)}">PR ${THIRD.number}</a>: ${THIRD.title}</li></ul>`
			),
			text: `- PR ${FIRST.number}: ${FIRST.title} — ${urlOf(FIRST.number)}\n- PR ${THIRD.number}: ${THIRD.title} — ${urlOf(THIRD.number)}`,
		});
	await expect(bar(page)).toContainText('2 links copied');
	await expect(page.locator('[data-hyperfriend="live-region"]')).toHaveText(
		'2 links copied'
	);

	await test.step('the selection is cleared afterwards', async () => {
		await expect(bar(page)).toBeHidden();
		await expect(rowButton(page, FIRST)).not.toHaveAttribute(
			'data-selected'
		);
		await expect(rowButton(page, THIRD)).not.toHaveAttribute(
			'data-selected'
		);
	});
});

test('should keep the result in the bar until it clears the selection and not rescan in a loop', async ({
	page,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST, SECOND]);

	// The announcement of the last click is written after a short delay: wait for it first
	await expect(page.locator('[data-hyperfriend="live-region"]')).toHaveText(
		'Added to the selection, 2 selected'
	);

	await test.step('while items are selected the page is left alone', async () => {
		// The bar's own text writes must not make the page observer rescan again and again
		const mutations = await page.evaluate(
			() =>
				new Promise<number>((resolve) => {
					let count = 0;
					const observer = new MutationObserver((records) => {
						count += records.length;
					});
					observer.observe(document.documentElement, {
						childList: true,
						subtree: true,
					});
					setTimeout(() => {
						observer.disconnect();
						resolve(count);
					}, 800);
				})
		);
		expect(mutations).toBe(0);
	});

	await test.step('the result stays on screen after Copy', async () => {
		await bar(page)
			.getByRole('button', { name: 'Copy links', exact: true })
			.click();
		await expect(bar(page)).toContainText('2 links copied');
		// Sampled on every frame for most of the time the result is shown
		const seen = await page.evaluate(
			() =>
				new Promise<string[]>((resolve) => {
					const texts = new Set<string>();
					const end = performance.now() + 900;
					const tick = (): void => {
						texts.add(
							document.querySelector(
								'[data-hyperfriend="selection-bar"]'
							)?.textContent ?? ''
						);
						if (performance.now() < end) {
							requestAnimationFrame(tick);
							return;
						}
						resolve([...texts]);
					};
					tick();
				})
		);
		expect(seen).toEqual(['2 links copiedCopy linksClear']);
	});
});

test('should copy the selected items as Markdown lines in plain text only when the format is Markdown', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await storage.seedConfig({ format: LinkFormat.Markdown });
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: markdown list');
	await select(page, [FIRST, SECOND]);

	await bar(page)
		.getByRole('button', { name: 'Copy links', exact: true })
		.click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: '',
			text: `- [PR ${FIRST.number}](${urlOf(FIRST.number)}): ${FIRST.title}\n- [PR ${SECOND.number}](${urlOf(SECOND.number)}): ${SECOND.title}`,
		});
});

test('should copy one selected item as a one-item list', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: one item list');
	await select(page, [SECOND]);

	await bar(page)
		.getByRole('button', { name: 'Copy link', exact: true })
		.click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<ul><li><a href="${urlOf(SECOND.number)}">PR ${SECOND.number}</a>: ${SECOND.title}</li></ul>`
			),
			text: `- PR ${SECOND.number}: ${SECOND.title} — ${urlOf(SECOND.number)}`,
		});
	await expect(bar(page)).toContainText('1 link copied');
});

test('should clear the selection with the Clear button and give the focus back to a selected row button', async ({
	page,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST, SECOND]);
	const clear = bar(page).getByRole('button', { name: 'Clear', exact: true });
	await clear.focus();

	await page.keyboard.press('Enter');

	await expect(bar(page)).toBeHidden();
	await expect(rowButton(page, FIRST)).not.toHaveAttribute('data-selected');
	await expect(rowButton(page, SECOND)).not.toHaveAttribute('data-selected');
	// The focus did not fall back to the page: it is on the last item that was selected
	await expect(rowButton(page, SECOND)).toBeFocused();
});

test('should clear the selection with Escape', async ({ page }) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST]);
	await expect(bar(page)).toBeVisible();
	await page.evaluate(() =>
		(document.activeElement as HTMLElement | null)?.blur()
	);

	await page.keyboard.press('Escape');

	await expect(bar(page)).toBeHidden();
	await expect(rowButton(page, FIRST)).not.toHaveAttribute('data-selected');
});

test('should keep the selection while Escape is pressed in a text field', async ({
	page,
	recordKeys,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST]);
	await page.evaluate(() => {
		const input = document.createElement('input');
		input.id = 'typing';
		document.body.append(input);
		input.focus();
	});
	await expect(page.locator('#typing')).toBeFocused();
	const readKeys = await recordKeys(page);

	await page.keyboard.press('Escape');

	// The key reached the page after the extension's own handler, which left the selection alone
	await expect
		.poll(readKeys)
		.toEqual([{ code: 'Escape', defaultPrevented: false }]);
	await expect(bar(page)).toContainText('1 selected');
	await expect(rowButton(page, FIRST)).toHaveAttribute('data-selected', '');

	await test.step('control: with the field left, the same key clears the selection', async () => {
		await page.evaluate(() =>
			(document.activeElement as HTMLElement | null)?.blur()
		);
		await page.keyboard.press('Escape');
		await expect(bar(page)).toBeHidden();
	});
});

test('should keep the selection while Escape belongs to an open modal dialog', async ({
	page,
	recordKeys,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST]);
	await page.evaluate(() => {
		const dialog = document.createElement('div');
		dialog.id = 'dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.textContent = 'A dialog of the page';
		document.body.append(dialog);
		(document.activeElement as HTMLElement | null)?.blur();
	});
	await expect(page.locator('#dialog')).toBeVisible();
	const readKeys = await recordKeys(page);

	await page.keyboard.press('Escape');

	await expect
		.poll(readKeys)
		.toEqual([{ code: 'Escape', defaultPrevented: false }]);
	await expect(bar(page)).toContainText('1 selected');
	await expect(rowButton(page, FIRST)).toHaveAttribute('data-selected', '');

	await test.step('control: once the dialog is gone, Escape clears the selection', async () => {
		await page.evaluate(() => document.querySelector('#dialog')?.remove());
		await page.keyboard.press('Escape');
		await expect(bar(page)).toBeHidden();
	});
});

test('should still copy a single item with a plain click and keep the selection', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST]);
	await writeClipboardSentinel(page, 'sentinel: plain click');

	await rowButton(page, SECOND).click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${urlOf(SECOND.number)}">PR ${SECOND.number}</a>: ${SECOND.title}`
			),
			text: `PR ${SECOND.number}: ${SECOND.title} — ${urlOf(SECOND.number)}`,
		});
	await expect(bar(page)).toContainText('1 selected');
	await expect(rowButton(page, FIRST)).toHaveAttribute('data-selected', '');
});

test('should toggle the selection from the keyboard with Shift+Enter on a focused button', async ({
	page,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await rowButton(page, FIRST).focus();

	await page.keyboard.press('Shift+Enter');

	await expect(bar(page)).toContainText('1 selected');
	await expect(rowButton(page, FIRST)).toHaveAttribute('data-selected', '');

	await page.keyboard.press('Shift+Enter');
	await expect(bar(page)).toBeHidden();
	await expect(rowButton(page, FIRST)).not.toHaveAttribute('data-selected');
});

test('should keep an item selected when GitHub replaces its row', async ({
	page,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST, SECOND]);

	await test.step('the title link of the first item is replaced by a copy of itself, as React can do', async () => {
		await page.evaluate((title) => {
			const link = [...document.querySelectorAll('a')].find(
				(anchor) => anchor.textContent?.trim() === title
			);
			link?.replaceWith(link.cloneNode(true));
		}, FIRST.title);
	});

	// A new button belongs to the replaced link; it shows the selection again, and the count stays
	await expect(rowButton(page, FIRST)).toHaveAttribute('data-selected', '');
	await expect(rowButton(page, FIRST)).toHaveCount(1);
	await expect(bar(page)).toContainText('2 selected');
});

test('should drop an item whose row is gone from the page', async ({
	page,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST, SECOND]);

	await page.evaluate((title) => {
		const link = [...document.querySelectorAll('a')].find(
			(anchor) => anchor.textContent?.trim() === title
		);
		link?.closest('li')?.remove();
	}, FIRST.title);

	await expect(bar(page)).toContainText('1 selected');
	await expect(rowButton(page, SECOND)).toHaveAttribute('data-selected', '');
});

test('should drop the selection when GitHub navigates to another page in place', async ({
	page,
}) => {
	test.skip(PLAIN.length < 3, NOT_ENOUGH);
	await page.goto(snapshotUrl(PAGES.pullList));
	await select(page, [FIRST]);
	await expect(bar(page)).toBeVisible();

	await page.evaluate((path) => {
		history.pushState({}, '', path);
		document.dispatchEvent(new Event('turbo:load'));
	}, `${PAGES.pullList}?q=is%3Aclosed`);

	await expect(bar(page)).toBeHidden();
	await expect(rowButton(page, FIRST)).not.toHaveAttribute('data-selected');
});

test('should treat Shift+click on the title button of a detail page like a click', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	const url = `https://github.com${REPOSITORY}/issues/${ISSUE.number}`;
	await page.goto(snapshotUrl(PAGES.issue));
	await writeClipboardSentinel(page, 'sentinel: detail shift click');

	await titleButton(page, `Copy link to issue #${ISSUE.number}`).click({
		modifiers: ['Shift'],
	});

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${url}">Issue ${ISSUE.number}</a>: ${ISSUE.title}`
			),
			text: `Issue ${ISSUE.number}: ${ISSUE.title} — ${url}`,
		});
	await expect(bar(page)).toBeHidden();
});

test('should select discussions and copy them as a list', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	// The first item is the pinned card, whose discussion is also a row of the list
	const rows = snapshotItems(PAGES.discussionList)
		.slice(1)
		.filter(({ title }) => !/[&<>"']/.test(title));
	test.skip(rows.length < 2, 'fewer than two discussions with plain titles');
	const [one, two] = rows;
	const url = (number: number): string =>
		`https://github.com${DISCUSSIONS_REPOSITORY}/discussions/${number}`;
	const button = (item: SnapshotItem): Locator =>
		rowOf(page, item.title).getByRole('button', {
			name: `Copy link to discussion #${item.number}`,
			exact: true,
		});
	await page.goto(snapshotUrl(PAGES.discussionList));
	await writeClipboardSentinel(page, 'sentinel: discussions list');

	await button(one).click({ modifiers: ['Shift'] });
	await button(two).click({ modifiers: ['Shift'] });
	await bar(page)
		.getByRole('button', { name: 'Copy links', exact: true })
		.click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<ul><li><a href="${url(one.number)}">Discussion ${one.number}</a>: ${one.title}</li><li><a href="${url(two.number)}">Discussion ${two.number}</a>: ${two.title}</li></ul>`
			),
			text: `- Discussion ${one.number}: ${one.title} — ${url(one.number)}\n- Discussion ${two.number}: ${two.title} — ${url(two.number)}`,
		});
});
