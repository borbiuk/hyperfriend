import { LinkType } from '@shared/models';

import { expect, readyForShortcut, test } from './fixtures/extension';
import {
	elementBeforeTitleButton,
	PAGES,
	REPOSITORY,
	snapshotItems,
	snapshotUrl,
	titleButton,
} from './fixtures/github';

// Workflow run page (the first finished, named run of the react/react run list at capture time):
// the title button, Shift+C and the details of the header.

const [RUN] = snapshotItems(PAGES.runPage);
const URL = `https://github.com${REPOSITORY}/actions/runs/${RUN.runId}`;
const BUTTON_NAME = `Copy link to workflow run ${RUN.workflow} #${RUN.number}`;

/** HTML-escapes a text for the expected payload (the product has its own escape, which is under test) */
const escapeText = (text: string): string =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test.beforeAll(() => {
	// The page and the list are captured apart and read with different cues (the header, the row's
	// visible texts): they must agree on the run, and the run must have a name of its own
	const [listed] = snapshotItems(PAGES.runList).filter(
		(item) => item.runId === RUN.runId
	);
	expect(RUN).toEqual(listed);
	expect(RUN.title).not.toBe(RUN.workflow);
	expect(RUN.workflow && RUN.status && RUN.branch).toBeTruthy();
});

test('should add the copy button right after the run number', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.runPage));

	await expect(titleButton(page, BUTTON_NAME)).toHaveCount(1);
	await expect(elementBeforeTitleButton(page, BUTTON_NAME)).toHaveText(
		`#${RUN.number}`
	);
});

test('should copy the rich link with the title button, with the workflow and the run number', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await page.goto(snapshotUrl(PAGES.runPage));
	await writeClipboardSentinel(page, 'sentinel: run button');

	await titleButton(page, BUTTON_NAME).click();

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${URL}">${escapeText(`${RUN.workflow} #${RUN.number}`)}</a>: ${escapeText(RUN.title)}`
			),
			text: `${RUN.workflow} #${RUN.number}: ${RUN.title} — ${URL}`,
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
	await page.goto(snapshotUrl(PAGES.runPage));
	const button = titleButton(page, BUTTON_NAME);
	await expect(button).toHaveAttribute('aria-keyshortcuts', 'Shift+C');
	// Snapshots have no GitHub CSS, so the header starts below the fold; the tooltip needs the button in view
	await button.scrollIntoViewIfNeeded();
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: run shortcut');

	await page.keyboard.press('Shift+C');

	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${URL}">${escapeText(`${RUN.workflow} #${RUN.number}`)}</a>: ${escapeText(RUN.title)}`
			),
			text: `${RUN.workflow} #${RUN.number}: ${RUN.title} — ${URL}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should fill the workflow, status and branch placeholders from the header', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	await storage.seedConfig({
		templates: {
			[LinkType.WorkflowRun]:
				'{{run_number}} | {{workflow}} | {{status}} | {{branch}}',
		},
	});
	await page.goto(snapshotUrl(PAGES.runPage));
	await readyForShortcut(page);
	await writeClipboardSentinel(page, 'sentinel: run page placeholders');

	await page.keyboard.press('Shift+C');

	const text = `${RUN.number} | ${RUN.workflow} | ${RUN.status} | ${RUN.branch}`;
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${URL}">${escapeText(text)}</a>`
			),
			text: `${text} — ${URL}`,
		});
});
